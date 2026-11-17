"""Sensibilidad de Transporte, Transbordo y Asignación: se vuelve a resolver con datos modificados y se compara con la solución actual."""
import copy
import time

from . import asignacion, transbordo, transporte
from .esquema import ErrorDatos

VARIACIONES = [-30, -20, -10, 10, 20, 30]
LIMITE_SEGUNDOS = 25


def _cambiar(matriz, k):
    return [[None if v is None else v * k for v in fila] for fila in matriz]


# ---------- Transporte ----------

def _t_decision(r):
    return frozenset((e["origen"], e["destino"]) for e in r["envios"])


def _t_variar(datos, parametro, pct):
    k, d = 1 + pct / 100, copy.deepcopy(datos)
    if parametro == "costos":
        d["costos"] = _cambiar(d["costos"], k)
    elif parametro == "oferta":
        d["oferta"] = [v * k for v in d["oferta"]]
    else:
        d["demanda"] = [v * k for v in d["demanda"]]
    return d


def _t_prohibir(datos, base):
    O, D = datos["origenes"], datos["destinos"]
    for e in base["envios"]:
        d = copy.deepcopy(datos)
        d["costos"][O.index(e["origen"])][D.index(e["destino"])] = None
        yield f"{e['origen']} → {e['destino']}", e["costo_unitario"], d


# ---------- Transbordo ----------

def _b_decision(r):
    return frozenset((f["desde"], f["hasta"]) for f in r["flujos"])


def _b_variar(datos, parametro, pct):
    k, d = 1 + pct / 100, copy.deepcopy(datos)
    if parametro == "costos":
        d["costos"] = _cambiar(d["costos"], k)
        return d
    tipo = {"oferta": "origen", "demanda": "destino", "capacidad": "intermedio"}[parametro]
    for n in d["nodos"]:
        if n["tipo"] == tipo and n["cantidad"] is not None:
            n["cantidad"] = n["cantidad"] * k
    return d


def _b_prohibir(datos, base):
    nombres = [n["nombre"] for n in datos["nodos"]]
    for f in base["flujos"]:
        d = copy.deepcopy(datos)
        d["costos"][nombres.index(f["desde"])][nombres.index(f["hasta"])] = None
        yield f"{f['desde']} → {f['hasta']}", f["costo_unitario"], d


# ---------- Asignación ----------

def _a_decision(r):
    return frozenset((a["agente"], a["tarea"]) for a in r["asignaciones"])


def _a_prohibir(datos, base):
    A, T = datos["agentes"], datos["tareas"]
    for a in base["asignaciones"]:
        d = copy.deepcopy(datos)
        d["costos"][A.index(a["agente"])][T.index(a["tarea"])] = None
        yield f"{a['agente']} → {a['tarea']}", a["costo"], d


def _tiene_capacidad(datos):
    return any(n["tipo"] == "intermedio" and n["cantidad"] is not None for n in datos["nodos"])


TIPOS = {
    "transporte": {
        "modulo": transporte,
        "decision": _t_decision,
        "parametros": lambda d: [("costos", "Costos de envío"), ("oferta", "Oferta"), ("demanda", "Demanda")],
        "variar": _t_variar,
        "prohibir": _t_prohibir,
        "ruta": "ruta",
    },
    "transbordo": {
        "modulo": transbordo,
        "decision": _b_decision,
        "parametros": lambda d: [("costos", "Costos de envío"), ("oferta", "Oferta"), ("demanda", "Demanda")]
        + ([("capacidad", "Capacidad de intermedios")] if _tiene_capacidad(d) else []),
        "variar": _b_variar,
        "prohibir": _b_prohibir,
        "ruta": "ruta",
    },
    "asignacion": {
        "modulo": asignacion,
        "decision": _a_decision,
        "parametros": lambda d: [],  # escalar todos los costos nunca cambia la asignación: solo se analiza cada pareja
        "variar": None,
        "prohibir": _a_prohibir,
        "ruta": "pareja",
    },
}


def _intentar(modulo, datos):
    try:
        return modulo.resolver(modulo.parsear(datos))
    except ErrorDatos:
        return None


def _fila(cfg, base, res, extra):
    fila = dict(extra)
    if res is None:
        fila.update({"factible": False, "nota": "Sin solución", "costo_total": None, "cambio": None, "cambio_pct": None, "cambia_decision": False})
        return fila
    if not res.get("cubierta", True) and base.get("cubierta", True):
        fila.update({"factible": False, "nota": f"Faltan {res['faltante_total']:g} unidades", "costo_total": None, "cambio": None, "cambio_pct": None, "cambia_decision": False})
        return fila
    cambio = round(res["costo_total"] - base["costo_total"], 2)
    fila.update(
        {
            "factible": True,
            "nota": "",
            "costo_total": res["costo_total"],
            "cambio": cambio,
            "cambio_pct": round(100 * cambio / base["costo_total"], 1) if base["costo_total"] else 0.0,
            "cambia_decision": cfg["decision"](res) != cfg["decision"](base),
        }
    )
    return fila


def analizar(tipo, datos) -> dict:
    cfg = TIPOS[tipo]
    modulo = cfg["modulo"]
    d = modulo.parsear(datos)
    datos = d.model_dump()
    base = modulo.resolver(d)
    inicio = time.monotonic()
    incompleto = False

    escenarios = []
    for parametro, etiqueta in cfg["parametros"](datos):
        filas = []
        for pct in VARIACIONES:
            if time.monotonic() - inicio > LIMITE_SEGUNDOS:
                incompleto = True
                filas.append({"pct": pct, "factible": False, "nota": "Omitido", "costo_total": None, "cambio": None, "cambio_pct": None, "cambia_decision": False})
                continue
            filas.append(_fila(cfg, base, _intentar(modulo, cfg["variar"](datos, parametro, pct)), {"pct": pct}))
        escenarios.append({"parametro": parametro, "etiqueta": etiqueta, "variaciones": filas})

    alternativas = []
    for etiqueta, costo_actual, d2 in cfg["prohibir"](datos, base):
        if time.monotonic() - inicio > LIMITE_SEGUNDOS:
            incompleto = True
            break
        res = _intentar(modulo, d2)
        fila = _fila(cfg, base, res, {"etiqueta": etiqueta, "costo_actual": costo_actual})
        # Para asignación: hasta dónde puede cambiar el valor de esa pareja sin que cambie el plan
        fila["limite"] = round(costo_actual + (res["costo_total"] - base["costo_total"]), 4) if res is not None and tipo == "asignacion" else None
        alternativas.append(fila)

    return {
        "tipo": tipo,
        "base": {"costo_total": base["costo_total"], "cubierta": base.get("cubierta", True), "objetivo": base.get("objetivo")},
        "escenarios": escenarios,
        "alternativas": alternativas,
        "lectura": _lectura(tipo, base, escenarios, alternativas),
        "incompleto": incompleto,
    }


def _lectura(tipo, base, escenarios, alternativas):
    frases = []
    for esc in escenarios:
        cambios = [v for v in esc["variaciones"] if v["cambia_decision"]]
        malas = [v for v in esc["variaciones"] if not v["factible"] and v["nota"] != "Omitido"]
        if cambios:
            p = min(cambios, key=lambda v: abs(v["pct"]))
            frases.append(f"{esc['etiqueta']}: el plan de envíos cambia desde {p['pct']:+d} %.")
        else:
            frases.append(f"{esc['etiqueta']}: el mismo plan sigue siendo el mejor en todo el rango de ±30 %.")
        if malas:
            frases[-1] += " Con " + ", ".join(f"{v['pct']:+d} %" for v in malas) + " " + ("no hay solución." if tipo == "asignacion" else "no se cubre toda la demanda.")
    if tipo == "asignacion":
        con_limite = [a for a in alternativas if a["factible"] and a["limite"] is not None]
        if con_limite:
            frag = min(con_limite, key=lambda a: abs(a["cambio"]))
            sube = base.get("objetivo") != "maximizar"
            frases.append(
                f"La asignación más frágil es {frag['etiqueta']}: su valor ({frag['costo_actual']:g}) puede {'subir' if sube else 'bajar'} "
                f"hasta {frag['limite']:g}; si {'pasa de' if sube else 'baja de'} {frag['limite']:g}, deja de convenir."
            )
        firmes = [a for a in alternativas if not a["factible"]]
        if firmes:
            frases.append("Son indispensables (sin ellas no hay solución): " + ", ".join(a["etiqueta"] for a in firmes) + ".")
    else:
        ok = [a for a in alternativas if a["factible"]]
        if ok:
            mas = max(ok, key=lambda a: a["cambio"])
            monto = f"{mas['cambio']:,.0f}".replace(",", ".")
            frases.append(f"La ruta más costosa de perder es {mas['etiqueta']}: si se bloquea, el costo sube ${monto}.")
        firmes = [a for a in alternativas if not a["factible"]]
        if firmes:
            frases.append("Rutas indispensables para cubrir la demanda: " + ", ".join(a["etiqueta"] for a in firmes) + ".")
    return frases
