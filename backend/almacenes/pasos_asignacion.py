"""Solución paso a paso del problema de asignación con el método húngaro.

1) Se prepara la matriz (maximizar → se convierte; rectangular → fila/columna ficticia;
   asignaciones prohibidas → costo M).
2) Se resta el mínimo de cada fila y luego el de cada columna.
3) Se cubren los ceros con el mínimo de líneas. Si son n líneas, ya hay asignación óptima;
   si no, se resta el menor valor no cubierto a lo no cubierto y se suma a las intersecciones.
4) Se escoge un cero por fila y columna.
Todo con fracciones exactas.
"""
from fractions import Fraction as F

from .asignacion import Asignacion
from .esquema import ErrorDatos

MAX_LADO = 15
MAX_ITERACIONES = 200


def _num(x: F):
    v = float(x)
    return int(v) if v == int(v) else round(v, 6)


class _Mod:
    pass


def _preparar(d: Asignacion):
    A, T = len(d.agentes), len(d.tareas)
    n = max(A, T)
    mod = _Mod()
    mod.filas = list(d.agentes) + [f"Ficticio {k + 1}" for k in range(n - A)]
    mod.cols = list(d.tareas) + [f"Ficticia {k + 1}" for k in range(n - T)]
    mod.A, mod.T, mod.n = A, T, n
    orig = [[None if c is None else F(str(c)) for c in f] for f in d.costos]
    finitos = [c for f in orig for c in f if c is not None]
    mx = max(finitos) if finitos else F(0)
    mod.maximizar = d.objetivo == "maximizar"
    base = max(mx, F(0))
    mod.M = (base + 1) * (n + 1) * 10
    mod.es_m = [[False] * n for _ in range(n)]
    c = [[F(0)] * n for _ in range(n)]
    for i in range(A):
        for j in range(T):
            v = orig[i][j]
            if v is None:
                c[i][j] = mod.M
                mod.es_m[i][j] = True
            else:
                c[i][j] = (mx - v) if mod.maximizar else v
    mod.c = c
    mod.orig = orig
    mod.mx = mx
    return mod


def _mat(mod, c):
    """Matriz para mostrar; las celdas prohibidas aparecen como null (M) mientras sigan siendo enormes."""
    return [[None if (mod.es_m[i][j] and c[i][j] > 0) else _num(c[i][j]) for j in range(mod.n)] for i in range(mod.n)]


def _ceros(c, n):
    return [[j for j in range(n) if c[i][j] == 0] for i in range(n)]


def _emparejar(c, n):
    """Máximo emparejamiento sobre los ceros (Kuhn). Devuelve (match_col→fila, match_fila→col)."""
    adj = _ceros(c, n)
    mc = [-1] * n

    def probar(i, vis):
        for j in adj[i]:
            if j in vis:
                continue
            vis.add(j)
            if mc[j] == -1 or probar(mc[j], vis):
                mc[j] = i
                return True
        return False

    for i in range(n):
        probar(i, set())
    mf = [-1] * n
    for j, i in enumerate(mc):
        if i != -1:
            mf[i] = j
    return mc, mf


def _cobertura(c, n):
    """Mínimo de líneas que cubren todos los ceros (König)."""
    adj = _ceros(c, n)
    mc, mf = _emparejar(c, n)
    z_f, z_c = set(), set()
    pila = [i for i in range(n) if mf[i] == -1]
    z_f.update(pila)
    while pila:
        i = pila.pop()
        for j in adj[i]:
            if j not in z_c:
                z_c.add(j)
                k = mc[j]
                if k != -1 and k not in z_f:
                    z_f.add(k)
                    pila.append(k)
    filas = sorted(set(range(n)) - z_f)
    cols = sorted(z_c)
    return filas, cols, mf


def generar(d: Asignacion) -> dict:
    if max(len(d.agentes), len(d.tareas)) > MAX_LADO:
        raise ErrorDatos([f"Para ver los pasos usa hasta {MAX_LADO} agentes y {MAX_LADO} tareas."])
    mod = _preparar(d)
    n = mod.n
    c = [f[:] for f in mod.c]
    pasos = []

    # --- preparar
    notas = []
    if mod.maximizar:
        notas.append(
            f"Es un problema de maximizar: se convierte a minimizar restando cada valor al mayor ({_num(mod.mx)}). Así, el valor más alto pasa a costar 0."
        )
    if n != mod.A or n != mod.T:
        notas.append(
            "La matriz no es cuadrada: se agrega una "
            + ("fila" if mod.A < n else "columna")
            + f" ficticia (×{abs(mod.A - mod.T)}) con ceros. Quien se asigne a ella queda sin tarea (o la tarea sin agente)."
        )
    if any(any(f) for f in mod.es_m):
        notas.append("Las asignaciones prohibidas llevan costo M (muy grande) para que no se escojan.")
    if not notas:
        notas.append("La matriz ya es cuadrada y es de minimizar: se puede aplicar el método directamente.")
    pasos.append({"tipo": "preparar", "titulo": "Paso 1 · Preparar la matriz", "texto": " ".join(notas), "matriz": _mat(mod, c)})

    # --- reducción por filas y columnas
    mins_f = [min(c[i]) for i in range(n)]
    for i in range(n):
        c[i] = [v - mins_f[i] for v in c[i]]
    pasos.append({
        "tipo": "filas",
        "titulo": "Paso 2 · Restar el mínimo de cada fila",
        "texto": "En cada fila se resta su valor más pequeño, así cada fila queda con al menos un cero.",
        "matriz": _mat(mod, c),
        "minimos": [_num(v) for v in mins_f],
    })
    mins_c = [min(c[i][j] for i in range(n)) for j in range(n)]
    for j in range(n):
        for i in range(n):
            c[i][j] -= mins_c[j]
    pasos.append({
        "tipo": "columnas",
        "titulo": "Paso 3 · Restar el mínimo de cada columna",
        "texto": "Ahora se resta el valor más pequeño de cada columna, para que también cada columna tenga un cero.",
        "matriz": _mat(mod, c),
        "minimos_col": [_num(v) for v in mins_c],
    })

    # --- cubrir ceros / ajustar
    mf = None
    for it in range(1, MAX_ITERACIONES + 1):
        filas, cols, mf = _cobertura(c, n)
        lineas = len(filas) + len(cols)
        if lineas == n:
            pasos.append({
                "tipo": "cubrir",
                "titulo": f"Cubrir los ceros (intento {it})",
                "texto": f"Se necesitan {lineas} líneas para cubrir todos los ceros, que es igual al tamaño de la matriz ({n}). Ya existe una asignación completa usando solo ceros.",
                "matriz": _mat(mod, c),
                "cobertura": {"filas": filas, "columnas": cols},
                "optimo": True,
            })
            break
        pasos.append({
            "tipo": "cubrir",
            "titulo": f"Cubrir los ceros (intento {it})",
            "texto": f"Con el menor número de líneas para tapar todos los ceros se usan {lineas}, menos que {n}. Todavía no alcanza para asignar: hay que crear más ceros.",
            "matriz": _mat(mod, c),
            "cobertura": {"filas": filas, "columnas": cols},
            "optimo": False,
        })
        nofil = [i for i in range(n) if i not in filas]
        nocol = [j for j in range(n) if j not in cols]
        delta = min(c[i][j] for i in nofil for j in nocol)
        for i in range(n):
            for j in range(n):
                cf, cc = i in filas, j in cols
                if not cf and not cc:
                    c[i][j] -= delta
                elif cf and cc:
                    c[i][j] += delta
        pasos.append({
            "tipo": "ajustar",
            "titulo": f"Crear nuevos ceros (intento {it})",
            "texto": f"Se muestra la matriz ya ajustada. El menor valor sin cubrir era {_num(delta)}: se restó a todas las celdas sin cubrir y se sumó a las que están en el cruce de dos líneas. Las celdas cubiertas por una sola línea no cambian.",
            "matriz": _mat(mod, c),
            "cobertura": {"filas": filas, "columnas": cols},
            "delta": _num(delta),
        })
    else:
        raise ErrorDatos(["El método húngaro no terminó en un número razonable de pasos."])

    # --- asignación final
    elegidas = [(i, mf[i]) for i in range(n)]
    if any(mod.es_m[i][j] for i, j in elegidas if i < mod.A and j < mod.T):
        raise ErrorDatos(["No existe una asignación posible con las combinaciones permitidas"])
    reales = [(i, j) for i, j in elegidas if i < mod.A and j < mod.T]
    asignaciones = [
        {"agente": d.agentes[i], "tarea": d.tareas[j], "costo": _num(mod.orig[i][j])} for i, j in reales
    ]
    total = sum((mod.orig[i][j] for i, j in reales), F(0))
    pasos.append({
        "tipo": "final",
        "titulo": "Paso final · Escoger los ceros",
        "texto": "Se elige un cero por cada fila y columna (empezando por las filas o columnas con un solo cero). Esas celdas son la asignación; el costo se calcula con los valores ORIGINALES."
        + (" Los valores originales se suman tal cual (no los convertidos)." if mod.maximizar else ""),
        "matriz": _mat(mod, c),
        "elegidas": [[i, j] for i, j in elegidas],
    })
    return {
        "filas": mod.filas,
        "columnas": mod.cols,
        "objetivo": d.objetivo,
        "n_agentes": mod.A,
        "n_tareas": mod.T,
        "originales": [[None if v is None else _num(v) for v in f] for f in mod.orig],
        "pasos": pasos,
        "resultado": {
            "asignaciones": asignaciones,
            "costo_total": _num(total),
            "agentes_sin_tarea": [d.agentes[i] for i in range(mod.A) if i not in {a for a, _ in reales}],
            "tareas_sin_agente": [d.tareas[j] for j in range(mod.T) if j not in {b for _, b in reales}],
        },
    }
