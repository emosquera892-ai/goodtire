"""Registro de tipos de problema: cada uno sabe validar, resolver y resumir."""
from collections import namedtuple

from . import asignacion, esquema, solver, transbordo, transporte

Tipo = namedtuple("Tipo", "parsear resolver resumen ejemplo")


def _resumen_ubicacion(resultado):
    abiertos = (resultado or {}).get("almacenes_abiertos", [])
    return "Abre: " + ", ".join(abiertos) if abiertos else ""


def _ejemplo_ubicacion():
    from .views import EJEMPLO_GOOD_TIRE

    return EJEMPLO_GOOD_TIRE


TIPOS = {
    "ubicacion": Tipo(esquema.parsear, solver.resolver, _resumen_ubicacion, _ejemplo_ubicacion),
    "transporte": Tipo(transporte.parsear, transporte.resolver, transporte.resumen, lambda: transporte.EJEMPLO),
    "asignacion": Tipo(asignacion.parsear, asignacion.resolver, asignacion.resumen, lambda: asignacion.EJEMPLO),
    "transbordo": Tipo(transbordo.parsear, transbordo.resolver, transbordo.resumen, lambda: transbordo.EJEMPLO),
}
