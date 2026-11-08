"""Programación lineal general: método gráfico (2 variables), simplex tabular y algebraico.

Todo se calcula con fracciones exactas. Se usa el método de dos fases:
fase 1 busca una solución factible (variables artificiales) y fase 2 optimiza.
"""
from fractions import Fraction as F
from typing import Annotated, List, Literal

from pydantic import BaseModel, Field, model_validator

from .comun import nombres_unicos, parsear_con
from .esquema import ErrorDatos

Nombre = Annotated[str, Field(min_length=1, max_length=20)]
Coef = Annotated[float, Field(ge=-1e9, le=1e9)]
MAX_ITER = 200


class Restriccion(BaseModel):
    a: List[Coef] = Field(min_length=1, max_length=8)
    signo: Literal["<=", ">=", "="]
    b: Coef


class LP(BaseModel):
    objetivo: Literal["maximizar", "minimizar"] = "maximizar"
    variables: List[Nombre] = Field(min_length=1, max_length=8)
    c: List[Coef]
    restricciones: List[Restriccion] = Field(min_length=1, max_length=10)

    @model_validator(mode="after")
    def validar(self):
        n = len(self.variables)
        nombres_unicos(variables=self.variables)
        if len(self.c) != n:
            raise ValueError("c debe tener un coeficiente por variable")
        for i, r in enumerate(self.restricciones):
            if len(r.a) != n:
                raise ValueError(f"La restricción {i + 1} debe tener {n} coeficientes")
        return self


def parsear(datos) -> LP:
    return parsear_con(LP, datos)


def _f(x) -> F:
    return F(str(x))


def _s(x: F) -> str:
    return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"


def _flt(x: F) -> float:
    return float(x)


# ------------------------------------------------------------------ simplex tabular / algebraico

class _Tab:
    def __init__(self, lp: LP):
        n = len(lp.variables)
        self.lp = lp
        self.maximizar = lp.objetivo == "maximizar"
        self.n = n
        c = [_f(v) for v in lp.c]
        self.c_max = c if self.maximizar else [-v for v in c]
        filas = []
        for r in lp.restricciones:
            a, b, s = [_f(v) for v in r.a], _f(r.b), r.signo
            if b < 0:
                a, b = [-v for v in a], -b
                s = {"<=": ">=", ">=": "<=", "=": "="}[s]
            filas.append((a, s, b))
        self.m = len(filas)
        self.nombres = list(lp.variables)
        n_h = sum(1 for _, s, _ in filas if s == "<=")
        n_e = sum(1 for _, s, _ in filas if s == ">=")
        n_a = sum(1 for _, s, _ in filas if s in (">=", "="))
        N = n + n_h + n_e + n_a
        self.N = N
        self.A = [[F(0)] * N for _ in range(self.m)]
        self.b = []
        self.basis = []
        ih, ie, ia = n, n + n_h, n + n_h + n_e
        self.art = []  # índices de artificiales
        h = e = a_ = 0
        self.nombres += [f"h{k + 1}" for k in range(n_h)] + [f"e{k + 1}" for k in range(n_e)] + [f"a{k + 1}" for k in range(n_a)]
        for i, (a, s, b) in enumerate(filas):
            for j in range(n):
                self.A[i][j] = a[j]
            self.b.append(b)
            if s == "<=":
                self.A[i][ih + h] = F(1)
                self.basis.append(ih + h)
                h += 1
            elif s == ">=":
                self.A[i][ie + e] = F(-1)
                self.A[i][ia + a_] = F(1)
                self.basis.append(ia + a_)
                self.art.append(ia + a_)
                e += 1
                a_ += 1
            else:
                self.A[i][ia + a_] = F(1)
                self.basis.append(ia + a_)
                self.art.append(ia + a_)
                a_ += 1

    # fila 0 (zj - cj) y valor z para un vector de costos (de maximización)
    def fila0(self, cost, cols):
        z = sum((cost[self.basis[i]] * self.b[i] for i in range(self.m)), F(0))
        r0 = {}
        for j in cols:
            r0[j] = sum((cost[self.basis[i]] * self.A[i][j] for i in range(self.m)), F(0)) - cost[j]
        return r0, z

    def pivotar(self, i, j):
        p = self.A[i][j]
        self.A[i] = [v / p for v in self.A[i]]
        self.b[i] = self.b[i] / p
        for k in range(self.m):
            if k != i and self.A[k][j] != 0:
                f = self.A[k][j]
                self.A[k] = [x - f * y for x, y in zip(self.A[k], self.A[i])]
                self.b[k] = self.b[k] - f * self.b[i]
        self.basis[i] = j


def _terminos(coefs):
    return [{"coef": _s(c), "var": v} for v, c in coefs if c != 0]


def _snapshot(t: _Tab, cost, cols, n_it, etiqueta_z, convertir_z):
    """Foto del estado actual (antes de elegir el pivote)."""
    r0, z = t.fila0(cost, cols)
    nobasicas = [j for j in cols if j not in t.basis]
    z_mostrar = -z if convertir_z else z
    # forma algebraica: Z = z - Σ r0_j x_j (máx); x_B = b - Σ a_ij x_j
    if convertir_z:
        z_term = [(t.nombres[j], r0[j]) for j in nobasicas]
        z_const = z_mostrar
    else:
        z_term = [(t.nombres[j], -r0[j]) for j in nobasicas]
        z_const = z_mostrar
    alg = {
        "z": {"const": _s(z_const), "terminos": _terminos(z_term)},
        "filas": [
            {
                "basica": t.nombres[t.basis[i]],
                "const": _s(t.b[i]),
                "terminos": _terminos([(t.nombres[j], -t.A[i][j]) for j in nobasicas]),
            }
            for i in range(t.m)
        ],
        "no_basicas": [t.nombres[j] for j in nobasicas],
    }
    valores = {t.nombres[t.basis[i]]: _s(t.b[i]) for i in range(t.m)}
    snap = {
        "n": n_it,
        "columnas": [t.nombres[j] for j in cols],
        "base": [t.nombres[t.basis[i]] for i in range(t.m)],
        "cb": [_s(cost[t.basis[i]]) for i in range(t.m)],
        "costos": [_s(cost[j]) for j in cols],
        "tabla": [[_s(t.A[i][j]) for j in cols] for i in range(t.m)],
        "rhs": [_s(v) for v in t.b],
        "fila_z": [_s(r0[j]) for j in cols],
        "z": _s(z_mostrar),
        "algebraico": alg,
        "valores_base": valores,
    }
    return snap, r0, z


def _fase(t: _Tab, cost, cols, etiqueta, convertir_z, texto_inicial):
    iteraciones = []
    resultado = None
    for it in range(1, MAX_ITER + 1):
        snap, r0, z = _snapshot(t, cost, cols, it, etiqueta, convertir_z)
        # variable que entra: la más negativa en zj - cj (empate: menor índice; Bland tras muchas iteraciones)
        neg = [(r0[j], j) for j in cols if r0[j] < 0]
        if not neg:
            snap.update(optimo=True, entra=None, sale=None, pivote=None, razones=[None] * t.m)
            snap["texto"] = "Todos los valores de la fila Z son ≥ 0: no se puede mejorar. Solución óptima."
            alt = [t.nombres[j] for j in cols if j not in t.basis and r0[j] == 0]
            snap["alternativos"] = alt
            iteraciones.append(snap)
            resultado = "optimo"
            break
        if it > 50:
            j = min(j for _, j in neg)
        else:
            j = min(neg)[1]
        razones, mejor = [], None
        for i in range(t.m):
            if t.A[i][j] > 0:
                r = t.b[i] / t.A[i][j]
                razones.append(r)
                if mejor is None or r < mejor[0] or (r == mejor[0] and t.basis[i] < t.basis[mejor[1]]):
                    mejor = (r, i)
            else:
                razones.append(None)
        snap["razones"] = [None if r is None else _s(r) for r in razones]
        snap["optimo"] = False
        if mejor is None:
            snap.update(entra=t.nombres[j], sale=None, pivote=None, ilimitado=True)
            snap["entra_idx"] = cols.index(j)
            snap["texto"] = (
                f"Entra {t.nombres[j]} (el valor más negativo de la fila Z, {_s(r0[j])}), pero ningún elemento de su columna es positivo: "
                "la variable puede crecer sin límite. El problema es no acotado."
            )
            iteraciones.append(snap)
            resultado = "ilimitado"
            break
        r, i = mejor
        snap.update(
            entra=t.nombres[j],
            entra_idx=cols.index(j),
            sale=t.nombres[t.basis[i]],
            sale_idx=i,
            pivote=[i, cols.index(j)],
        )
        snap["texto"] = (
            f"Entra {t.nombres[j]}: es la que más mejora (valor más negativo en la fila Z: {_s(r0[j])}). "
            f"Razón mínima = {_s(r)} en la fila de {t.nombres[t.basis[i]]}, que sale de la base. "
            f"Pivote = {_s(t.A[i][j])}."
        )
        iteraciones.append(snap)
        t.pivotar(i, j)
    else:
        raise ErrorDatos(["El simplex no terminó en un número razonable de pasos."])
    return {"nombre": etiqueta, "texto": texto_inicial, "iteraciones": iteraciones, "resultado": resultado}


def _simplex(lp: LP):
    t = _Tab(lp)
    fases = []
    todas = list(range(t.N))
    reales = [j for j in todas if j not in t.art]
    convertir = not t.maximizar
    if t.art:
        cost1 = [F(0)] * t.N
        for j in t.art:
            cost1[j] = F(-1)
        f1 = _fase(
            t, cost1, todas, "Fase 1",
            False,
            "Hay restricciones ≥ o =: se agregan variables artificiales (a) y la Fase 1 maximiza −(suma de artificiales) para encontrar una solución factible. Si el máximo no llega a 0, el problema es infactible.",
        )
        # en fase 1 la «Z» mostrada es la suma negativa de artificiales
        fases.append(f1)
        ult = f1["iteraciones"][-1]
        suma_art = sum((t.b[i] for i in range(t.m) if t.basis[i] in t.art), F(0))
        if suma_art > 0:
            return t, fases, "infactible", None
        # sacar artificiales de la base (nivel 0)
        extra = []
        for i in range(t.m):
            if t.basis[i] in t.art:
                cand = [j for j in reales if t.A[i][j] != 0]
                if cand:
                    j = cand[0]
                    t.pivotar(i, j)
                    extra.append(f"La artificial de la fila {i + 1} quedó en la base con valor 0; se reemplaza por {t.nombres[j]}.")
        if extra:
            fases[-1]["nota"] = " ".join(extra)
        # filas redundantes (artificial atrapada): se eliminan
        i = 0
        while i < t.m:
            if t.basis[i] in t.art:
                del t.A[i], t.b[i], t.basis[i]
                t.m -= 1
                fases[-1]["nota"] = (fases[-1].get("nota", "") + " Una restricción era redundante y se eliminó.").strip()
            else:
                i += 1
    cost2 = [F(0)] * t.N
    for j in range(t.n):
        cost2[j] = t.c_max[j]
    texto2 = (
        "Se optimiza la función objetivo real partiendo de la solución factible encontrada."
        if t.art
        else "Todas las restricciones son ≤ con lado derecho ≥ 0: la base inicial son las variables de holgura (h)."
    )
    if convertir:
        texto2 += " Como es una minimización, se maximiza −Z (la fila Z corresponde a ese problema) y al final se cambia el signo."
    f2 = _fase(t, cost2, reales, "Fase 2" if t.art else "Simplex", convertir, texto2)
    fases.append(f2)
    if f2["resultado"] == "ilimitado":
        return t, fases, "ilimitado", None
    sol = {t.nombres[t.basis[i]]: t.b[i] for i in range(t.m)}
    x = [sol.get(t.nombres[j], F(0)) for j in range(t.n)]
    z = sum((_f(lp.c[j]) * x[j] for j in range(t.n)), F(0))
    return t, fases, "optimo", (x, z)


# ------------------------------------------------------------------ gráfico (2 variables)

def _interseccion(l1, l2):
    a1, b1, c1 = l1
    a2, b2, c2 = l2
    det = a1 * b2 - a2 * b1
    if det == 0:
        return None
    return ((c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det)


def _recortar(poli, a, b, s, c):
    """Recorta un polígono con el semiplano a·x + b·y (s) c."""
    def dentro(p):
        v = a * p[0] + b * p[1]
        return v <= c if s == "<=" else (v >= c if s == ">=" else v == c)

    if s == "=":
        # la igualdad deja solo el segmento; se aproxima con una franja mínima
        return poli
    salida = []
    for k in range(len(poli)):
        p, q = poli[k], poli[(k + 1) % len(poli)]
        dp, dq = dentro(p), dentro(q)
        if dp:
            salida.append(p)
        if dp != dq:
            vp, vq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
            t = vp / (vp - vq)
            salida.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return salida


def _grafico(lp: LP, estado, resultado):
    rest = [(_f(r.a[0]), _f(r.a[1]), r.signo, _f(r.b)) for r in lp.restricciones]
    lineas = [(a, b, c) for a, b, _, c in rest] + [(F(1), F(0), F(0)), (F(0), F(1), F(0))]  # ejes x=0, y=0
    candidatos = []
    for i in range(len(lineas)):
        for j in range(i + 1, len(lineas)):
            p = _interseccion(lineas[i], lineas[j])
            if p is not None and p not in candidatos:
                candidatos.append(p)

    def factible(p):
        if p[0] < 0 or p[1] < 0:
            return False
        for a, b, s, c in rest:
            v = a * p[0] + b * p[1]
            if (s == "<=" and v > c) or (s == ">=" and v < c) or (s == "=" and v != c):
                return False
        return True

    c1, c2 = _f(lp.c[0]), _f(lp.c[1])
    maxi = lp.objetivo == "maximizar"
    verts = []
    pts = [p for p in candidatos if p[0] >= 0 and p[1] >= 0]
    for p in pts:
        verts.append({"x": _flt(p[0]), "y": _flt(p[1]), "z": _flt(c1 * p[0] + c2 * p[1]), "factible": factible(p),
                      "_p": p})
    # vista
    xs = [v["x"] for v in verts] + [1.0]
    ys = [v["y"] for v in verts] + [1.0]
    for a, b, _, c in rest:
        if a != 0 and c / a > 0:
            xs.append(float(c / a))
        if b != 0 and c / b > 0:
            ys.append(float(c / b))
    # con regiones no acotadas los vértices lejanos no deben dominar: se usa solo lo factible + cortes
    xmax = max(xs) * 1.2
    ymax = max(ys) * 1.2
    xm, ym = _f(round(xmax, 6)), _f(round(ymax, 6))
    poli = [(F(0), F(0)), (xm, F(0)), (xm, ym), (F(0), ym)]
    iguales = [(a, b, c) for a, b, s, c in rest if s == "="]
    for a, b, s, c in rest:
        if s != "=":
            poli = _recortar(poli, a, b, s, c)
            if not poli:
                break
    segmento = None
    if iguales:
        poli = []  # con una igualdad el conjunto factible es un segmento, no un área
        fe = [v["_p"] for v in verts if v["factible"]]
        if len(fe) >= 2:
            segmento = [[_flt(p[0]), _flt(p[1])] for p in (min(fe), max(fe))]
    opt = None
    if resultado:
        x, z = resultado
        opt = {"x": _flt(x[0]), "y": _flt(x[1]), "z": _flt(z)}
        for v in verts:
            v["optimo"] = abs(v["x"] - opt["x"]) < 1e-9 and abs(v["y"] - opt["y"]) < 1e-9
    for v in verts:
        v.setdefault("optimo", False)
        v.pop("_p")
    return {
        "variables": lp.variables[:2],
        "vista": {"xmax": float(xm), "ymax": float(ym)},
        "rectas": [
            {"a": _flt(a), "b": _flt(b), "signo": s, "c": _flt(c), "nombre": f"R{i + 1}"}
            for i, (a, b, s, c) in enumerate(rest)
        ],
        "poligono": [[_flt(p[0]), _flt(p[1])] for p in poli],
        "segmento": segmento,
        "vertices": verts,
        "objetivo": {"c1": _flt(c1), "c2": _flt(c2), "maximizar": maxi},
        "optimo": opt,
        "acotada": estado != "ilimitado",
    }


# ------------------------------------------------------------------ API

def resolver(lp: LP) -> dict:
    t, fases, estado, res = _simplex(lp)
    texto_obj = f"{'Maximizar' if lp.objetivo == 'maximizar' else 'Minimizar'} Z = " + " + ".join(
        f"{_s(_f(c))}{v}" for c, v in zip(lp.c, lp.variables)
    )
    out = {
        "estado": estado,
        "objetivo_texto": texto_obj.replace("+ -", "− "),
        "variables": lp.variables,
        "fases": fases,
        "grafico": _grafico(lp, estado, res) if len(lp.variables) == 2 else None,
        "solucion": None,
    }
    if res:
        x, z = res
        alt = []
        ult = fases[-1]["iteraciones"][-1]
        alt = ult.get("alternativos", [])
        out["solucion"] = {
            "z": _s(z),
            "z_num": _flt(z),
            "valores": [{"variable": v, "valor": _s(xi), "num": _flt(xi)} for v, xi in zip(lp.variables, x)],
            "alternativos": bool(alt),
            "degenerada": any(v.split("/")[0] == "0" for v in ult.get("rhs", [])),
        }
    return out


EJEMPLO = {
    # Giapetto (Winston): soldados y trenes de madera. Óptimo: x=20, y=60, Z=180
    "objetivo": "maximizar",
    "variables": ["x1", "x2"],
    "c": [3, 2],
    "restricciones": [
        {"a": [2, 1], "signo": "<=", "b": 100},
        {"a": [1, 1], "signo": "<=", "b": 80},
        {"a": [1, 0], "signo": "<=", "b": 40},
    ],
}

EJEMPLO_MIN = {
    # Dieta: minimizar costo con restricciones ≥ (usa la Fase 1). Óptimo: x1=18/5, x2=7/5, Z=320
    "objetivo": "minimizar",
    "variables": ["x1", "x2"],
    "c": [50, 100],
    "restricciones": [
        {"a": [7, 2], "signo": ">=", "b": 28},
        {"a": [2, 12], "signo": ">=", "b": 24},
    ],
}
