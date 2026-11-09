import secrets

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView

from .esquema import ErrorDatos
from .models import Caso
from .tipos import TIPOS

User = get_user_model()

MAX_CASOS_POR_USUARIO = 100
COSTO_MAXIMO = 1e27


# ---------- Usuarios ----------

class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    email = serializers.EmailField(max_length=254)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_email(self, valor):
        valor = valor.strip().lower()
        if User.objects.filter(email__iexact=valor).exists():
            raise serializers.ValidationError("Ya existe una cuenta con ese correo")
        return valor

    def validate(self, attrs):
        user = User(username=attrs.get("username", ""), email=attrs.get("email", ""))
        try:
            validate_password(attrs["password"], user)
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class RegistroView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registro"

    def post(self, request):
        ser = RegistroSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response({"id": user.id, "username": user.username}, status=status.HTTP_201_CREATED)


class LoginThrottle(AnonRateThrottle):
    scope = "login"
    rate = "20/min"


class LoginView(TokenObtainPairView):
    throttle_classes = [LoginThrottle]


# ---------- Historial de casos ----------

class CasoSerializer(serializers.ModelSerializer):
    costo_total = serializers.DecimalField(
        max_digits=30, decimal_places=2, coerce_to_string=False, read_only=True
    )

    tipo = serializers.ChoiceField(choices=list(TIPOS), default="ubicacion")

    class Meta:
        model = Caso
        fields = ("id", "tipo", "nombre", "datos", "resultado", "costo_total", "token_publico", "creado", "actualizado")
        read_only_fields = ("resultado", "costo_total", "token_publico", "creado", "actualizado")

    def validate_nombre(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("El nombre no puede estar vacío")
        return valor

    def validate(self, attrs):
        if self.instance is not None and "tipo" in attrs and attrs["tipo"] != self.instance.tipo:
            raise serializers.ValidationError({"tipo": ["No se puede cambiar el tipo de un caso guardado"]})
        # Solo se vuelve a resolver cuando llegan datos nuevos
        if "datos" in attrs:
            tipo = TIPOS[self.instance.tipo if self.instance is not None else attrs.get("tipo", "ubicacion")]
            try:
                problema = tipo.parsear(attrs["datos"])
                resultado = tipo.resolver(problema)
            except ErrorDatos as e:
                raise serializers.ValidationError({"datos": e.mensajes})
            if resultado["costo_total"] >= COSTO_MAXIMO:
                raise serializers.ValidationError({"datos": ["Los valores son demasiado grandes"]})
            attrs["datos"] = problema.model_dump()
            attrs["resultado"] = resultado
            attrs["costo_total"] = resultado["costo_total"]
        return attrs


class CasoResumenSerializer(serializers.ModelSerializer):
    costo_total = serializers.DecimalField(
        max_digits=30, decimal_places=2, coerce_to_string=False, read_only=True
    )
    almacenes_abiertos = serializers.SerializerMethodField()
    resumen = serializers.SerializerMethodField()

    class Meta:
        model = Caso
        fields = ("id", "tipo", "nombre", "costo_total", "resumen", "almacenes_abiertos", "token_publico", "creado", "actualizado")

    def get_almacenes_abiertos(self, obj):
        return (obj.resultado or {}).get("almacenes_abiertos", [])

    def get_resumen(self, obj):
        return TIPOS[obj.tipo].resumen(obj.resultado) if obj.tipo in TIPOS else ""


class PaginaCasos(PageNumberPagination):
    page_size = 20
    page_size_query_param = "tam"
    max_page_size = 100


ACCIONES_CON_SOLVER = {"create", "update", "partial_update"}


class CasoViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    pagination_class = PaginaCasos
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def get_queryset(self):
        return Caso.objects.filter(usuario=self.request.user)

    def get_serializer_class(self):
        return CasoResumenSerializer if self.action == "list" else CasoSerializer

    def get_throttles(self):
        if self.action in ACCIONES_CON_SOLVER:
            return super().get_throttles()
        return []

    def _verificar_limite(self):
        if self.get_queryset().count() >= MAX_CASOS_POR_USUARIO:
            raise serializers.ValidationError(
                {"detail": [f"Alcanzaste el límite de {MAX_CASOS_POR_USUARIO} casos guardados"]}
            )

    def perform_create(self, serializer):
        self._verificar_limite()
        serializer.save(usuario=self.request.user)

    @action(detail=True, methods=["post", "delete"])
    def compartir(self, request, pk=None):
        """POST: activa (o devuelve) el enlace público de solo lectura. DELETE: lo desactiva."""
        caso = self.get_object()
        if request.method == "DELETE":
            if caso.token_publico:
                caso.token_publico = None
                caso.save(update_fields=["token_publico"])
            return Response(status=status.HTTP_204_NO_CONTENT)
        if not caso.token_publico:
            caso.token_publico = secrets.token_urlsafe(16)
            caso.save(update_fields=["token_publico"])
        return Response({"token": caso.token_publico})

    @action(detail=True, methods=["post"])
    def duplicar(self, request, pk=None):
        original = self.get_object()
        self._verificar_limite()
        copia = Caso.objects.create(
            usuario=request.user,
            tipo=original.tipo,
            nombre=f"{original.nombre} (copia)"[:120],
            datos=original.datos,
            resultado=original.resultado,
            costo_total=original.costo_total,
        )
        return Response(CasoSerializer(copia).data, status=status.HTTP_201_CREATED)
