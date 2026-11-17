"""Análisis de sensibilidad del problema de ubicación: se vuelve a resolver el modelo con datos modificados
(costos fijos, transporte, demanda y capacidad ±%, y forzar abrir/cerrar cada almacén) y se compara con la solución base."""
import time

from pydantic import ValidationError

from . import solver
from .esquema import ErrorDatos, Problema

VARIACIONES = [-30, -20, -10, 10, 20, 30]
PARAMETROS = [
    ("costo_fijo", "Costos fijos"),
    ("transporte", "Costos de transporte"),
    ("demanda", "Demanda"),
    ("capacidad", "Capacidad de almacenes"),
]
LIMITE_SEGUNDOS = 25


def _resolver(d: Problema):
    m, y, x, z, estado = solver._construir(d)
    if estado != "Optimal":
        return None
    abiertos, fijo, transporte = solver._costos(d, y, x, z)
    return {"costo_total": round(fijo + transporte, 2), "abiertos": [d.almacenes[w] for w in abiertos]}


def _variar(d: Problema, parametro: str, pct: float):
    k = 1 + pct / 100
    datos = d.model_dump()
    if parametro == "costo_fijo":
        datos["costo_fijo"] = [v * k for v in d.costo_fijo]
    elif parametro == "transporte":
        datos["costo_planta_almacen"] = [[v * k for v in f] for f in d.costo_planta_almacen]
        datos["costo_almacen_cliente"] = [[v * k for v in f] for f in d.costo_almacen_cliente]
    elif parametro == "demanda":
        datos["demanda"] = [v * k for v in d.demanda]
    else:
        datos["capacidad_almacenes"] = [v * k for v in d.capacidad_almacenes]
    return datos


def _intentar(datos):
    try:
        return _resolver(Problema(**datos))
    except (ValidationError, ValueError, ErrorDatos):
        return None


def _fila(base, res, extra=None):
    fila = dict(extra or {})
    if res is None:
        fila.update({"factible": False, "costo_total": None, "cambio": None, "cambio_pct": None, "abiertos": [], "cambia_decision": False})
        return fila
    cambio = round(res["costo_total"] - base["costo_total"], 2)
    fila.update(
        {
            "factible": True,
            "costo_total": res["costo_total"],
            "cambio": cambio,
            "cambio_pct": round(100 * cambio / base["costo_total"], 1) if base["costo_total"] else 0.0,
            "abiertos": res["abiertos"],
            "cambia_decision": set(res["abiertos"]) != set(base["abiertos"]),
        }
    )
    return fila


def analizar(d: Problema) -> dict:
    inicio = time.monotonic()
    base = _resolver(d)
    if base is None:
        raise ErrorDatos(["No se pudo resolver el caso base"])
    incompleto = False

    def agotado():
        return time.monotonic() - inicio > LIMITE_SEGUNDOS

    escenarios = []
    for parametro, etiqueta in PARAMETROS:
        filas = []
        for pct in VARIACIONES:
            if agotado():
                incompleto = True
                filas.append({"pct": pct, "omitido": True, "factible": False, "costo_total": None, "cambio": None, "cambio_pct": None, "abiertos": [], "cambia_decision": False})
                continue
            filas.append(_fila(base, _intentar(_variar(d, parametro, pct)), {"pct": pct}))
        escenarios.append({"parametro": parametro, "etiqueta": etiqueta, "variaciones": filas})

    almacenes = []
    for w, nombre in enumerate(d.almacenes):
        abierto = nombre in base["abiertos"]
        if (abierto and nombre in d.forzar_abiertos) or (not abierto and nombre in d.forzar_cerrados):
            continue
        accion = "cerrar" if abierto else "abrir"
        if agotado():
            incompleto = True
            continue
        datos = d.model_dump()
        if abierto:
            datos["forzar_cerrados"] = [*d.forzar_cerrados, nombre]
        else:
            datos["forzar_abiertos"] = [*d.forzar_abiertos, nombre]
        almacenes.append(_fila(base, _intentar(datos), {"almacen": nombre, "abierto_base": abierto, "accion": accion}))

    return {
        "base": base,
        "escenarios": escenarios,
        "almacenes": almacenes,
        "lectura": _lectura(base, escenarios, almacenes),
        "incompleto": incompleto,
    }


def _lectura(base, escenarios, almacenes):
    frases = []
    for esc in escenarios:
        cambios = [v for v in esc["variaciones"] if v.get("cambia_decision")]
        infact = [v for v in esc["variaciones"] if not v["factible"] and not v.get("omitido")]
        if cambios:
            primero = min(cambios, key=lambda v: abs(v["pct"]))
            frases.append(
                f"{esc['etiqueta']}: la decisión cambia desde {primero['pct']:+d} % (abriría {', '.join(primero['abiertos'])})."
            )
        else:
            frases.append(f"{esc['etiqueta']}: los mismos almacenes siguen siendo los mejores en todo el rango de ±30 %.")
        if infact:
            frases[-1] += " Con " + ", ".join(f"{v['pct']:+d} %" for v in infact) + " el problema no tiene solución."
    obligados = [a for a in almacenes if a["accion"] == "cerrar" and not a["factible"]]
    if obligados:
        nombres = ", ".join(a["almacen"] for a in obligados)
        if len(obligados) == 1:
            frases.append(f"Sin {nombres} no se alcanza a cubrir la demanda: es indispensable.")
        else:
            frases.append(f"Sin cada uno de estos almacenes no se alcanza a cubrir la demanda: {nombres}. Son indispensables.")
    caros = [a for a in almacenes if a["factible"]]
    if caros:
        mas = max(caros, key=lambda a: a["cambio"])
        verbo = "cerrar" if mas["accion"] == "cerrar" else "abrir"
        frases.append(f"El cambio más costoso sería {verbo} {mas['almacen']}: +${mas['cambio']:,.0f}.".replace(",", "."))
    return frases


def analizar_datos(datos) -> dict:
    from .esquema import parsear

    return analizar(parsear(datos))
