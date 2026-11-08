"""Solución paso a paso del problema de transporte.

1) Solución inicial: esquina noroeste, costo mínimo o Vogel.
2) Optimización con el método MODI (u-v): se calculan los costos reducidos, se mueve
   unidades por un ciclo y se repite hasta que ninguno sea negativo.

Se trabaja con fracciones exactas para que los pasos coincidan con lo que haría a mano.
"""
from fractions import Fraction as F
from typing import List, Optional

from .esquema import ErrorDatos
from .transporte import Transporte

METODOS = {
    "esquina_noroeste": "Esquina noroeste",
    "costo_minimo": "Costo mínimo",
    "vogel": "Aproximación de Vogel",
}
MAX_LADO = 15
MAX_ITERACIONES = 500


def _f(x) -> F:
    return F(str(x))


def _num(x: F):
    v = float(x)
    return int(v) if v == int(v) else round(v, 6)


class _Modelo:
    """Tabla de transporte ya balanceada (con fila o columna ficticia si hace falta)."""

    def __init__(self, d: Transporte):
        self.filas = list(d.origenes)
        self.cols = list(d.destinos)
        oferta = [_f(x) for x in d.oferta]
        demanda = [_f(x) for x in d.demanda]
        costos = [[None if c is None else _f(c) for c in f] for f in d.costos]
        finitos = [c for f in costos for c in f if c is not None]
        cmax = max(finitos) if finitos else F(0)
        m_, n_ = len(oferta), len(demanda)
        self.M = (cmax + 1) * (m_ + n_ + 1) * 10
        self.es_m = [[c is None for c in f] for f in costos]
        self.c = [[self.M if c is None else c for c in f] for f in costos]
        so, sd = sum(oferta), sum(demanda)
        self.so, self.sd = so, sd
        self.ficticio = None
        if so > sd:  # sobra oferta: destino ficticio (costo 0)
            self.cols.append("Excedente (ficticio)")
            demanda.append(so - sd)
            for i in range(m_):
                self.c[i].append(F(0))
                self.es_m[i].append(False)
            self.ficticio = ("destino", so - sd)
        elif so < sd:  # falta oferta: origen ficticio (costo M: se usa solo si no hay más remedio)
            self.filas.append("Faltante (ficticio)")
            oferta.append(sd - so)
            self.c.append([self.M] * len(demanda))
            self.es_m.append([True] * len(demanda))
            self.ficticio = ("origen", sd - so)
        self.s, self.dem = oferta, demanda
        self.m, self.n = len(oferta), len(demanda)

    def nombre_celda(self, i, j):
        return f"{self.filas[i]} → {self.cols[j]}"

    def costo_txt(self, i, j):
        return "M" if self.es_m[i][j] else f"{_num(self.c[i][j])}"


def _matriz(mod: _Modelo, x: dict) -> list:
    return [[_num(x[(i, j)]) if (i, j) in x else None for j in range(mod.n)] for i in range(mod.m)]


def _costo_real(mod: _Modelo, x: dict):
    real = sum((v * mod.c[i][j] for (i, j), v in x.items() if not mod.es_m[i][j]), F(0))
    en_m = sum((v for (i, j), v in x.items() if mod.es_m[i][j]), F(0))
    return real, en_m


# ---------------------------------------------------------------- solución inicial

def _inicial(mod: _Modelo, metodo: str):
    s, dem = list(mod.s), list(mod.dem)
    filas, cols = list(range(mod.m)), list(range(mod.n))
    x: dict = {}
    pasos = []
    tachadas_f, tachadas_c = [], []

    def penalizaciones():
        pf, pc = {}, {}
        for i in filas:
            v = sorted(mod.c[i][j] for j in cols)
            pf[i] = v[1] - v[0] if len(v) > 1 else v[0]
        for j in cols:
            v = sorted(mod.c[i][j] for i in filas)
            pc[j] = v[1] - v[0] if len(v) > 1 else v[0]
        return pf, pc

    while filas and cols:
        extra = {}
        if metodo == "esquina_noroeste":
            i, j = filas[0], cols[0]
            razon = f"Esquina noroeste: se empieza por la celda de arriba a la izquierda que sigue disponible, {mod.nombre_celda(i, j)}."
        elif metodo == "costo_minimo":
            i, j = min(((a, b) for a in filas for b in cols), key=lambda t: (mod.c[t[0]][t[1]], t[0], t[1]))
            razon = f"Costo mínimo: la celda disponible más barata es {mod.nombre_celda(i, j)} (costo {mod.costo_txt(i, j)})."
        else:
            pf, pc = penalizaciones()
            mejor = max([(pf[i], 0, i) for i in filas] + [(pc[j], 1, j) for j in cols], key=lambda t: (t[0], -t[1], -t[2]))
            pen, es_col, k = mejor
            if es_col:
                j = k
                i = min(filas, key=lambda a: (mod.c[a][j], a))
                linea = f"la columna «{mod.cols[j]}»"
            else:
                i = k
                j = min(cols, key=lambda b: (mod.c[i][b], b))
                linea = f"la fila «{mod.filas[i]}»"
            razon = (
                f"Vogel: la mayor penalización es {'M' if pen >= mod.M else _num(pen)}, en {linea}. "
                f"Dentro de esa línea la celda más barata es {mod.nombre_celda(i, j)} (costo {mod.costo_txt(i, j)})."
            )
            extra = {
                "penalizaciones": {
                    "filas": {str(a): ("M" if pf[a] >= mod.M else _num(pf[a])) for a in filas},
                    "columnas": {str(b): ("M" if pc[b] >= mod.M else _num(pc[b])) for b in cols},
                },
                "linea": {"tipo": "columna" if es_col else "fila", "indice": k},
            }
        q = min(s[i], dem[j])
        x[(i, j)] = q
        s[i] -= q
        dem[j] -= q
        texto = f"{razon} Se asigna el mínimo entre la oferta restante ({_num(s[i] + q)}) y la demanda restante ({_num(dem[j] + q)}): {_num(q)} unidades."
        if s[i] == 0 and dem[j] == 0:
            if len(filas) > 1:
                filas.remove(i)
                tachadas_f.append(i)
                texto += f" Se agotan a la vez la oferta y la demanda: se tacha la fila «{mod.filas[i]}» y la columna queda con 0 (degeneración)."
            else:
                cols.remove(j)
                tachadas_c.append(j)
                texto += f" Se agota todo: se tacha la columna «{mod.cols[j]}»."
        elif s[i] == 0:
            filas.remove(i)
            tachadas_f.append(i)
            texto += f" Se agota la oferta de «{mod.filas[i]}»: se tacha la fila."
        else:
            cols.remove(j)
            tachadas_c.append(j)
            texto += f" Se satisface la demanda de «{mod.cols[j]}»: se tacha la columna."
        paso = {
            "titulo": f"Asignación {len(x)}",
            "texto": texto,
            "celda": [i, j],
            "cantidad": _num(q),
            "asignacion": _matriz(mod, x),
            "oferta_restante": [_num(v) for v in s],
            "demanda_restante": [_num(v) for v in dem],
            "tachadas": {"filas": list(tachadas_f), "columnas": list(tachadas_c)},
            **extra,
        }
        pasos.append(paso)
    return x, pasos


# ---------------------------------------------------------------- MODI

def _potenciales(mod: _Modelo, x: dict):
    u, v = {0: F(0)}, {}
    cola = [("f", 0)]
    while cola:
        tipo, k = cola.pop()
        if tipo == "f":
            for (i, j) in x:
                if i == k and j not in v:
                    v[j] = mod.c[i][j] - u[i]
                    cola.append(("c", j))
        else:
            for (i, j) in x:
                if j == k and i not in u:
                    u[i] = mod.c[i][j] - v[j]
                    cola.append(("f", i))
    if len(u) != mod.m or len(v) != mod.n:
        raise ErrorDatos(["No se pudo calcular el método MODI para este caso."])
    return u, v


def _ciclo(mod: _Modelo, x: dict, i0: int, j0: int):
    """Camino por celdas básicas desde la columna j0 hasta la fila i0."""
    padre = {("c", j0): None}
    cola = [("c", j0)]
    while cola:
        nodo = cola.pop(0)
        tipo, k = nodo
        for (i, j) in x:
            if tipo == "c" and j == k and ("f", i) not in padre:
                padre[("f", i)] = (nodo, (i, j))
                cola.append(("f", i))
            elif tipo == "f" and i == k and ("c", j) not in padre:
                padre[("c", j)] = (nodo, (i, j))
                cola.append(("c", j))
        if ("f", i0) in padre:
            break
    if ("f", i0) not in padre:
        raise ErrorDatos(["No se pudo formar el ciclo de MODI para este caso."])
    celdas = []
    nodo = ("f", i0)
    while padre[nodo] is not None:
        nodo, celda = padre[nodo]
        celdas.append(celda)
    return celdas[::-1]  # desde la columna j0 hacia la fila i0


def _optimizar(mod: _Modelo, x: dict):
    iteraciones = []
    for n_it in range(1, MAX_ITERACIONES + 1):
        u, v = _potenciales(mod, x)
        delta = {
            (i, j): mod.c[i][j] - u[i] - v[j]
            for i in range(mod.m)
            for j in range(mod.n)
            if (i, j) not in x
        }
        real, en_m = _costo_real(mod, x)
        base = {
            "n": n_it,
            "asignacion": _matriz(mod, x),
            "u": [_num(u[i]) for i in range(mod.m)],
            "v": [_num(v[j]) for j in range(mod.n)],
            "delta": [[_num(delta[(i, j)]) if (i, j) in delta else None for j in range(mod.n)] for i in range(mod.m)],
            "costo": _num(real),
            "unidades_m": _num(en_m),
        }
        negativos = {k: dv for k, dv in delta.items() if dv < 0}
        if not negativos:
            base.update(
                optimo=True,
                texto="Todos los costos reducidos (Δ) son mayores o iguales a 0: la solución es óptima."
                + (" Los costos de las celdas con 0 indican que existen otras soluciones con el mismo costo." if any(dv == 0 for dv in delta.values()) else ""),
            )
            iteraciones.append(base)
            return iteraciones
        entrante = min(negativos, key=lambda k: (negativos[k], k))
        i0, j0 = entrante
        camino = _ciclo(mod, x, i0, j0)
        signos = [("+", entrante)] + [("-" if k % 2 == 0 else "+", c) for k, c in enumerate(camino)]
        menos = [c for sg, c in signos if sg == "-"]
        theta = min(x[c] for c in menos)
        saliente = next(c for c in menos if x[c] == theta)
        for sg, c in signos:
            x[c] = x.get(c, F(0)) + (theta if sg == "+" else -theta)
        del x[saliente]
        base.update(
            optimo=False,
            entrante=[i0, j0],
            ciclo=[{"celda": list(c), "signo": sg} for sg, c in signos],
            theta=_num(theta),
            saliente=list(saliente),
            texto=(
                f"El costo reducido más negativo es Δ = {_num(negativos[entrante])} en {mod.nombre_celda(i0, j0)}: "
                f"conviene enviar por esa ruta. Se forma un ciclo con signos + y −; la cantidad que se mueve es el menor valor "
                f"de las celdas con − (θ = {_num(theta)}). Sale de la base {mod.nombre_celda(*saliente)}."
            ),
        )
        iteraciones.append(base)
    raise ErrorDatos(["El método MODI no terminó en un número razonable de pasos."])


# ---------------------------------------------------------------- API

def generar(d: Transporte, metodo: str) -> dict:
    if metodo not in METODOS:
        raise ErrorDatos([f"Método desconocido: {metodo}. Usa uno de: {', '.join(METODOS)}"])
    if len(d.origenes) > MAX_LADO or len(d.destinos) > MAX_LADO:
        raise ErrorDatos([f"Para ver los pasos usa hasta {MAX_LADO} orígenes y {MAX_LADO} destinos."])
    mod = _Modelo(d)
    x, pasos_ini = _inicial(mod, metodo)
    real_ini, m_ini = _costo_real(mod, x)
    its = _optimizar(mod, x)
    real, en_m = _costo_real(mod, x)

    balanceo = {"oferta": _num(mod.so), "demanda": _num(mod.sd), "ficticio": None}
    if mod.ficticio:
        tipo, q = mod.ficticio
        balanceo["ficticio"] = tipo
        balanceo["cantidad"] = _num(q)
        balanceo["texto"] = (
            f"La oferta total ({_num(mod.so)}) es mayor que la demanda ({_num(mod.sd)}): se agrega un destino ficticio con demanda {_num(q)} "
            "y costo 0 para absorber lo que sobra."
            if tipo == "destino"
            else f"La oferta total ({_num(mod.so)}) es menor que la demanda ({_num(mod.sd)}): se agrega un origen ficticio con oferta {_num(q)}. "
            "Sus rutas llevan un costo M (muy grande) para que solo se use cuando no hay otra opción; lo que reciba de él queda sin cubrir."
        )
    else:
        balanceo["texto"] = f"Oferta y demanda coinciden ({_num(mod.so)}): el problema ya está balanceado."
    if any(any(f) for f in mod.es_m[: len(d.origenes)]):
        balanceo["texto"] += " Las rutas no disponibles se representan con el costo M (muy grande) para que el método no las use."

    # unidades en celdas M = sin cubrir (faltante o ruta imposible)
    sin_cubrir = en_m
    envios = [
        {"origen": mod.filas[i], "destino": mod.cols[j], "unidades": _num(v), "costo_unitario": _num(mod.c[i][j])}
        for (i, j), v in sorted(x.items())
        if v > 0 and not mod.es_m[i][j] and i < len(d.origenes) and j < len(d.destinos)
    ]
    return {
        "metodo": metodo,
        "metodo_nombre": METODOS[metodo],
        "filas": mod.filas,
        "columnas": mod.cols,
        "oferta": [_num(v) for v in mod.s],
        "demanda": [_num(v) for v in mod.dem],
        "costos": [[_num(mod.c[i][j]) if not mod.es_m[i][j] else None for j in range(mod.n)] for i in range(mod.m)],
        "balanceo": balanceo,
        "inicial": {"pasos": pasos_ini, "costo": _num(real_ini), "unidades_m": _num(m_ini)},
        "optimizacion": {"iteraciones": its},
        "resultado": {
            "asignacion": _matriz(mod, x),
            "costo_total": _num(real),
            "sin_cubrir": _num(sin_cubrir),
            "envios": envios,
        },
    }
