from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .esquema import ErrorDatos
from .solver import resolver_datos


@api_view(["GET"])
@permission_classes([AllowAny])
def salud(request):
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def reglas(request):
    return Response({
        "limites": {
            "plantas": "1 a 30, nombres únicos de 1 a 60 caracteres",
            "almacenes": "1 a 20, nombres únicos de 1 a 60 caracteres",
            "clientes": "1 a 100, nombres únicos de 1 a 60 caracteres",
            "numeros": "mayores o iguales a 0 (no se permiten negativos)",
            "factor_unidades": "mayor que 0 (1000 si capacidades y demanda están en miles)",
        },
        "campos": {
            "capacidad_plantas": "un valor por planta; null = capacidad ilimitada",
            "capacidad_almacenes": "un valor por almacén (en miles de unidades/mes)",
            "costo_fijo": "$/mes de operación de cada almacén",
            "demanda": "un valor por cliente (en miles de unidades/mes)",
            "costo_planta_almacen": "matriz plantas x almacenes, $/unidad",
            "costo_almacen_cliente": "matriz almacenes x clientes, $/unidad",
            "min_almacenes / max_almacenes": "opcional: límites de almacenes abiertos",
            "forzar_abiertos / forzar_cerrados": "opcional: nombres de almacenes",
        },
        "validaciones": [
            "La capacidad de los almacenes debe cubrir la demanda total",
            "Si todas las plantas tienen capacidad, deben cubrir la demanda total",
            "Las listas y matrices deben tener las dimensiones correctas",
            "Un almacén no puede estar forzado abierto y cerrado a la vez",
            "El problema debe ser factible con las restricciones dadas",
        ],
    })


EJEMPLO_GOOD_TIRE = {
    # Caso de estudio: Good Tire, Inc. (Tablas 9.23 y 9.24)
    "plantas": ["Akron"],
    "almacenes": ["Cleveland", "Harrisburg", "Chicago", "Trenton", "Louisville"],
    "clientes": ["Cleveland", "Cincinnati", "Dayton", "Indianápolis", "Chicago",
                 "Búfalo", "Pittsburgh", "Filadelfia", "Nashville", "Boston"],
    "capacidad_plantas": [None],
    "capacidad_almacenes": [80, 60, 60, 60, 60],
    "costo_fijo": [40000, 20000, 30000, 25000, 20000],
    "demanda": [30, 20, 18, 16, 38, 22, 27, 32, 19, 26],
    "costo_planta_almacen": [[0.25, 0.50, 0.75, 0.75, 0.75]],
    "costo_almacen_cliente": [
        [0.25, 1.25, 0.75, 1.63, 1.75, 1.00, 0.63, 2.13, 2.63, 3.25],
        [0.63, 1.50, 1.38, 1.75, 2.38, 1.13, 0.88, 0.63, 2.88, 2.75],
        [1.75, 1.50, 1.38, 1.00, 0.25, 2.75, 2.38, 3.88, 2.38, 5.00],
        [2.13, 2.75, 2.38, 3.50, 3.88, 1.88, 1.75, 0.50, 4.25, 1.25],
        [1.75, 0.50, 1.00, 0.50, 1.50, 2.75, 2.00, 3.50, 0.88, 4.88],
    ],
    "factor_unidades": 1000,
    "min_almacenes": 0,
    "max_almacenes": None,
    "forzar_abiertos": [],
    "forzar_cerrados": [],
}


@api_view(["GET"])
@permission_classes([AllowAny])
def ejemplo(request):
    return Response(EJEMPLO_GOOD_TIRE)


class ResolverView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request):
        try:
            return Response(resolver_datos(request.data))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)


def _tipo_o_404(tipo):
    from django.http import Http404

    from .tipos import TIPOS

    if tipo not in TIPOS:
        raise Http404
    return TIPOS[tipo]


@api_view(["GET"])
@permission_classes([AllowAny])
def ejemplo_tipo(request, tipo):
    return Response(_tipo_o_404(tipo).ejemplo())


class ResolverTipoView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request, tipo):
        t = _tipo_o_404(tipo)
        try:
            return Response(t.resolver(t.parsear(request.data)))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)


class PasosTransporteView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request):
        from . import pasos_transporte, transporte

        try:
            cuerpo = request.data if isinstance(request.data, dict) else {}
            datos = transporte.parsear(cuerpo.get("datos"))
            metodo = cuerpo.get("metodo") or "vogel"
            return Response(pasos_transporte.generar(datos, metodo))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)


class PasosUbicacionView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request):
        from . import esquema, pasos_ubicacion

        try:
            cuerpo = request.data if isinstance(request.data, dict) else {}
            return Response(pasos_ubicacion.generar(esquema.parsear(cuerpo.get("datos"))))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)


class PasosAsignacionView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request):
        from . import asignacion, pasos_asignacion

        try:
            cuerpo = request.data if isinstance(request.data, dict) else {}
            return Response(pasos_asignacion.generar(asignacion.parsear(cuerpo.get("datos"))))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)


class PasosTransbordoView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request):
        from . import pasos_transbordo, transbordo

        try:
            cuerpo = request.data if isinstance(request.data, dict) else {}
            datos = transbordo.parsear(cuerpo.get("datos"))
            return Response(pasos_transbordo.generar(datos, cuerpo.get("metodo") or "vogel"))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)


@api_view(["GET"])
@permission_classes([AllowAny])
def ejemplo_simplex(request):
    from . import simplex

    return Response({"max": simplex.EJEMPLO, "min": simplex.EJEMPLO_MIN})


class ResolverSimplexView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "resolver"

    def post(self, request):
        from . import simplex

        try:
            return Response(simplex.resolver(simplex.parsear(request.data)))
        except ErrorDatos as e:
            return Response({"detail": e.mensajes}, status=422)
