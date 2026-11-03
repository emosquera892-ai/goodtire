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

from .esquema import ErrorDatos, parsear
from .models import Caso
from .solver import resolver

User = get_user_model()

MAX_CASOS_POR_USUARIO = 100
COSTO_MAXIMO = 1e27


# ---------- Usuarios ----------

class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)

    class Meta:
        model = User
        fields = ("username", "email", "password")

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

    class Meta:
        model = Caso
        fields = ("id", "nombre", "datos", "resultado", "costo_total", "creado", "actualizado")
        read_only_fields = ("resultado", "costo_total", "creado", "actualizado")

    def validate_nombre(self, valor):
        valor = valor.strip()
        if not valor:
            raise serializers.ValidationError("El nombre no puede estar vacío")
        return valor

    def validate(self, attrs):
        # Solo se vuelve a resolver cuando llegan datos nuevos
        if "datos" in attrs:
            try:
                problema = parsear(attrs["datos"])
                resultado = resolver(problema)
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

    class Meta:
        model = Caso
        fields = ("id", "nombre", "costo_total", "almacenes_abiertos", "creado", "actualizado")

    def get_almacenes_abiertos(self, obj):
        return (obj.resultado or {}).get("almacenes_abiertos", [])


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

    @action(detail=True, methods=["post"])
    def duplicar(self, request, pk=None):
        original = self.get_object()
        self._verificar_limite()
        copia = Caso.objects.create(
            usuario=request.user,
            nombre=f"{original.nombre} (copia)"[:120],
            datos=original.datos,
            resultado=original.resultado,
            costo_total=original.costo_total,
        )
        return Response(CasoSerializer(copia).data, status=status.HTTP_201_CREATED)
