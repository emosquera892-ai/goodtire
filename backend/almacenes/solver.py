from itertools import combinations
import pulp
from .esquema import Problema, ErrorDatos, parsear

MAX_W_COMPARAR = 8
TIEMPO_LIMITE = 30


def _construir(d: Problema, fijar=None):
    """Construye y resuelve el modelo. Si 'fijar' es un conjunto de índices,
    solo esos almacenes se abren (se usa para comparar combinaciones)."""
    P = range(len(d.plantas))
    W = range(len(d.almacenes))
    C = range(len(d.clientes))

    m = pulp.LpProblem("GoodTire", pulp.LpMinimize)
    y = {w: pulp.LpVariable(f"y_{w}", cat="Binary") for w in W}
    x = {(p, w): pulp.LpVariable(f"x_{p}_{w}", lowBound=0) for p in P for w in W}
    z = {(w, c): pulp.LpVariable(f"z_{w}_{c}", lowBound=0) for w in W for c in C}

    m += (
        pulp.lpSum(d.costo_fijo[w] * y[w] for w in W)
        + d.factor_unidades
        * (
            pulp.lpSum(d.costo_planta_almacen[p][w] * x[p, w] for p in P for w in W)
            + pulp.lpSum(d.costo_almacen_cliente[w][c] * z[w, c] for w in W for c in C)
        )
    )

    for p in P:
        if d.capacidad_plantas[p] is not None:
            m += pulp.lpSum(x[p, w] for w in W) <= d.capacidad_plantas[p]
    for c in C:
        m += pulp.lpSum(z[w, c] for w in W) == d.demanda[c]
    for w in W:
        m += pulp.lpSum(x[p, w] for p in P) == pulp.lpSum(z[w, c] for c in C)
        m += pulp.lpSum(z[w, c] for c in C) <= d.capacidad_almacenes[w] * y[w]
        for c in C:
            m += z[w, c] <= d.demanda[c] * y[w]

    for n in d.forzar_abiertos:
        m += y[d.almacenes.index(n)] == 1
    for n in d.forzar_cerrados:
        m += y[d.almacenes.index(n)] == 0
    m += pulp.lpSum(y.values()) >= d.min_almacenes
    if d.max_almacenes is not None:
        m += pulp.lpSum(y.values()) <= d.max_almacenes
    if fijar is not None:
        for w in W:
            m += y[w] == (1 if w in fijar else 0)

    m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=TIEMPO_LIMITE))
    return m, y, x, z, pulp.LpStatus[m.status]


def _valor(v):
    return v.value() or 0


def _costos(d: Problema, y, x, z):
    P = range(len(d.plantas))
    W = range(len(d.almacenes))
    C = range(len(d.clientes))
    abiertos = [w for w in W if _valor(y[w]) > 0.5]
    fijo = sum(d.costo_fijo[w] for w in abiertos)
    transporte = d.factor_unidades * (
        sum(d.costo_planta_almacen[p][w] * _valor(x[p, w]) for p in P for w in W)
        + sum(d.costo_almacen_cliente[w][c] * _valor(z[w, c]) for w in W for c in C)
    )
    return abiertos, fijo, transporte


def resolver(d: Problema) -> dict:
    m, y, x, z, estado = _construir(d)
    if estado == "Infeasible":
        raise ErrorDatos(["El problema es infactible con las restricciones dadas"])
    if estado != "Optimal":
        raise ErrorDatos([f"No se encontró solución óptima (estado: {estado})"])

    P = range(len(d.plantas))
    W = range(len(d.almacenes))
    C = range(len(d.clientes))
    abiertos, fijo, transporte = _costos(d, y, x, z)

    detalle = []
    for w in abiertos:
        uso = sum(_valor(z[w, c]) for c in C)
        cap = d.capacidad_almacenes[w]
        detalle.append({
            "almacen": d.almacenes[w],
            "capacidad": cap,
            "uso": round(uso, 4),
            "utilizacion_pct": round(100 * uso / cap, 1) if cap > 0 else 0,
            "costo_fijo": d.costo_fijo[w],
        })

    plantas = []
    for p in P:
        uso = sum(_valor(x[p, w]) for w in W)
        cap = d.capacidad_plantas[p]
        plantas.append({
            "planta": d.plantas[p],
            "capacidad": cap,
            "uso": round(uso, 4),
            "utilizacion_pct": round(100 * uso / cap, 1) if cap else None,
        })

    return {
        "estado": estado,
        "costo_total": round(fijo + transporte, 2),
        "costo_fijo_total": round(fijo, 2),
        "costo_transporte_total": round(transporte, 2),
        "almacenes_abiertos": [d.almacenes[w] for w in abiertos],
        "detalle_almacenes": detalle,
        "detalle_plantas": plantas,
        "envios_planta_almacen": [
            {
                "planta": d.plantas[p],
                "almacen": d.almacenes[w],
                "unidades": round(_valor(x[p, w]), 4),
                "costo_unitario": d.costo_planta_almacen[p][w],
            }
            for p in P
            for w in W
            if _valor(x[p, w]) > 1e-6
        ],
        "envios_almacen_cliente": [
            {
                "almacen": d.almacenes[w],
                "cliente": d.clientes[c],
                "unidades": round(_valor(z[w, c]), 4),
                "costo_unitario": d.costo_almacen_cliente[w][c],
            }
            for w in abiertos
            for c in C
            if _valor(z[w, c]) > 1e-6
        ],
        "comparacion": comparar(d),
    }


def comparar(d: Problema):
    """Costo de cada combinación factible de almacenes (como en el libro)."""
    W = len(d.almacenes)
    if W > MAX_W_COMPARAR:
        return None
    demanda = sum(d.demanda)
    filas = []
    for k in range(1, W + 1):
        if k < d.min_almacenes or (d.max_almacenes is not None and k > d.max_almacenes):
            continue
        for combo in combinations(range(W), k):
            nombres = [d.almacenes[w] for w in combo]
            if any(n not in nombres for n in d.forzar_abiertos):
                continue
            if any(n in nombres for n in d.forzar_cerrados):
                continue
            if sum(d.capacidad_almacenes[w] for w in combo) < demanda:
                continue
            m, y, x, z, estado = _construir(d, fijar=set(combo))
            if estado != "Optimal":
                continue
            _, fijo, transporte = _costos(d, y, x, z)
            filas.append({
                "almacenes": nombres,
                "costo_transporte": round(transporte, 2),
                "costo_fijo": round(fijo, 2),
                "costo_total": round(fijo + transporte, 2),
            })
    filas.sort(key=lambda f: f["costo_total"])
    return filas


def resolver_datos(datos) -> dict:
    """Valida un dict de entrada y devuelve la solución. Lanza ErrorDatos."""
    return resolver(parsear(datos))
