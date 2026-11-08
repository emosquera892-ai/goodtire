"""Recuperación de cuenta: enlace por correo para elegir una contraseña nueva."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

User = get_user_model()

MENSAJE_ENVIO = "Si el correo está registrado, te enviamos un enlace para elegir una contraseña nueva. Revisa también el spam."
ENLACE_INVALIDO = "El enlace no es válido o ya venció. Pide uno nuevo."


def _enviar_enlace(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    enlace = f"{settings.FRONTEND_URL.rstrip('/')}/restablecer?uid={uid}&token={token}"
    minutos = settings.PASSWORD_RESET_TIMEOUT // 60
    if settings.EMAIL_BACKEND.endswith("console.EmailBackend"):
        # Sin servidor de correo configurado: deja el enlace limpio en el log del backend
        print(f"[recuperación] {user.get_username()}: {enlace}", flush=True)
    send_mail(
        "Recupera tu cuenta de Good Tire",
        (
            f"Hola {user.get_username()},\n\n"
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta.\n"
            f"Tu usuario es: {user.get_username()}\n\n"
            f"Para elegir una contraseña nueva abre este enlace (sirve una sola vez y vence en {minutos} minutos):\n"
            f"{enlace}\n\n"
            "Si no fuiste tú, ignora este mensaje: tu contraseña no cambia."
        ),
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
    )


class RecuperarSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class RecuperarView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recuperar"

    def post(self, request):
        ser = RecuperarSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        correo = ser.validated_data["email"].strip()
        # Misma respuesta exista o no el correo: así nadie puede averiguar quién tiene cuenta
        for user in User.objects.filter(email__iexact=correo, is_active=True):
            if user.has_usable_password():
                try:
                    _enviar_enlace(user)
                except Exception:  # un fallo de correo no debe revelar nada ni romper la respuesta
                    pass
        return Response({"detail": MENSAJE_ENVIO})


class RestablecerSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=64)
    token = serializers.CharField(max_length=128)
    password = serializers.CharField(min_length=8, max_length=128, write_only=True)


class RestablecerView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "restablecer"

    def post(self, request):
        ser = RestablecerSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(d["uid"])), is_active=True)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, d["token"]):
            return Response({"detail": [ENLACE_INVALIDO]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(d["password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        user.set_password(d["password"])
        user.save(update_fields=["password"])  # cambia el hash: el enlace deja de servir
        return Response({"detail": "Contraseña actualizada. Ya puedes iniciar sesión."})


# ---------- Mi cuenta (usuario con sesión) ----------

CLAVE_INCORRECTA = "La contraseña actual no es correcta."


class _ConClave(serializers.Serializer):
    password = serializers.CharField(max_length=128, write_only=True, trim_whitespace=False)

    def validate_password(self, valor):
        if not self.context["request"].user.check_password(valor):
            raise serializers.ValidationError(CLAVE_INCORRECTA)
        return valor


class CambiarClaveSerializer(_ConClave):
    nueva = serializers.CharField(min_length=8, max_length=128, write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        try:
            validate_password(attrs["nueva"], self.context["request"].user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"nueva": list(e.messages)})
        return attrs


class CambiarCorreoSerializer(_ConClave):
    email = serializers.EmailField(max_length=254)

    def validate_email(self, valor):
        valor = valor.strip().lower()
        if User.objects.filter(email__iexact=valor).exclude(pk=self.context["request"].user.pk).exists():
            raise serializers.ValidationError("Ya existe una cuenta con ese correo")
        return valor


class _VistaCuenta(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "cuenta"


class CuentaView(_VistaCuenta):
    def get(self, request):
        return Response({"username": request.user.get_username(), "email": request.user.email})


class CambiarClaveView(_VistaCuenta):
    def post(self, request):
        ser = CambiarClaveSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        request.user.set_password(ser.validated_data["nueva"])
        request.user.save(update_fields=["password"])
        return Response({"detail": "Contraseña actualizada."})


class CambiarCorreoView(_VistaCuenta):
    def post(self, request):
        ser = CambiarCorreoSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        request.user.email = ser.validated_data["email"]
        request.user.save(update_fields=["email"])
        return Response({"detail": "Correo actualizado.", "email": request.user.email})


class EliminarCuentaView(_VistaCuenta):
    def post(self, request):
        ser = _ConClave(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        if request.user.is_staff or request.user.is_superuser:
            return Response(
                {"detail": ["Las cuentas de administrador no se pueden eliminar desde aquí."]},
                status=status.HTTP_403_FORBIDDEN,
            )
        request.user.delete()  # sus casos se borran en cascada
        return Response(status=status.HTTP_204_NO_CONTENT)
