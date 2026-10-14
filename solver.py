import pulp
from models import Problema


def resolver(d: Problema) -> dict:
    P = list(range(len(d.plantas)))
    W = list(range(len(d.almacenes)))
    C = list(range(len(d.clientes)))

    m = pulp.LpProblem("GoodTire", pulp.LpMinimize)
    y = pulp.LpVariable.dicts("y", W, cat="Binary")
    x = pulp.LpVariable.dicts("x", (P, W), lowBound=0)
    z = pulp.LpVariable.dicts("z", (W, C), lowBound=0)

    m += (
        pulp.lpSum(d.costo_fijo[w] * y[w] for w in W)
        + pulp.lpSum(d.costo_planta_almacen[p][w] * x[p][w] for p in P for w in W)
        + pulp.lpSum(d.costo_almacen_cliente[w][c] * z[w][c] for w in W for c in C)
    )

    for p in P:
        m += pulp.lpSum(x[p][w] for w in W) <= d.capacidad_plantas[p]
    for c in C:
        m += pulp.lpSum(z[w][c] for w in W) == d.demanda[c]
    for w in W:
        m += pulp.lpSum(x[p][w] for p in P) == pulp.lpSum(z[w][c] for c in C)
        m += pulp.lpSum(z[w][c] for c in C) <= d.capacidad_almacenes[w] * y[w]

    m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=30))
    estado = pulp.LpStatus[m.status]
    if estado != "Optimal":
        raise ValueError(f"No se encontró solución óptima (estado: {estado})")

    return {
        "estado": estado,
        "costo_total": round(pulp.value(m.objective), 2),
        "almacenes_abiertos": [d.almacenes[w] for w in W if y[w].value() > 0.5],
        "envios_planta_almacen": [
            {"planta": d.plantas[p], "almacen": d.almacenes[w], "unidades": round(x[p][w].value(), 2)}
            for p in P for w in W if x[p][w].value() > 1e-6
        ],
        "envios_almacen_cliente": [
            {"almacen": d.almacenes[w], "cliente": d.clientes[c], "unidades": round(z[w][c].value(), 2)}
            for w in W for c in C if z[w][c].value() > 1e-6
        ],
    }
