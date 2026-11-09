"""Enlace público de solo lectura para un caso guardado."""
import re

from django.http import Http404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .casos import MAX_CASOS_POR_USUARIO, CasoSerializer
from .models import Caso

FORMATO_TOKEN = re.compile(r"^[A-Za-z0-9_-]{10,64}$")


def _caso_compartido(token):
    if not FORMATO_TOKEN.match(token):
        raise Http404
    try:
        return Caso.objects.get(token_publico=token)
    except Caso.DoesNotExist:
        raise Http404 from None


class CompartidoView(APIView):
    """Cualquiera con el enlace ve el caso (sin dueño, sin poder editar)."""

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "compartido"

    def get(self, request, token):
        caso = _caso_compartido(token)
        resp = Response(
            {
                "tipo": caso.tipo,
                "nombre": caso.nombre,
                "datos": caso.datos,
                "resultado": caso.resultado,
                "costo_total": caso.costo_total,
                "actualizado": caso.actualizado,
            }
        )
        resp["X-Robots-Tag"] = "noindex, nofollow"
        resp["Cache-Control"] = "no-store"
        return resp


class CopiarCompartidoView(APIView):
    """Guarda una copia del caso compartido en los casos del usuario con sesión."""

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "compartido"

    def post(self, request, token):
        origen = _caso_compartido(token)
        if Caso.objects.filter(usuario=request.user).count() >= MAX_CASOS_POR_USUARIO:
            return Response(
                {"detail": [f"Alcanzaste el límite de {MAX_CASOS_POR_USUARIO} casos guardados"]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        copia = Caso.objects.create(
            usuario=request.user,
            tipo=origen.tipo,
            nombre=f"{origen.nombre} (copia)"[:120],
            datos=origen.datos,
            resultado=origen.resultado,
            costo_total=origen.costo_total,
        )
        return Response(CasoSerializer(copia).data, status=status.HTTP_201_CREATED)
