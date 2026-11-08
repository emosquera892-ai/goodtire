"""Solución paso a paso del problema de ubicación de almacenes (Good Tire).

Como el costo fijo solo se paga si el almacén se abre, se evalúa cada combinación de
almacenes: se pagan sus costos fijos y se resuelve el problema de transporte
(planta → almacén → cliente) con solo esos almacenes. La combinación de menor costo total gana.
"""
from itertools import combinations

from .esquema import ErrorDatos, Problema
from .solver import MAX_W_COMPARAR, _construir, _costos, _valor


def _n(x):
    x = round(float(x), 4)
    return int(x) if x == int(x) else x


def _modelo(d: Problema) -> dict:
    return {
        "variables": [
            "yⱼ = 1 si se abre el almacén j, 0 si no.",
            "xᵢⱼ = unidades enviadas de la planta i al almacén j.",
            "zⱼₖ = unidades enviadas del almacén j al cliente k.",
        ],
        "objetivo": "Minimizar: costos fijos de los almacenes abiertos + factor × (costo de envío planta→almacén + costo de envío almacén→cliente).",
        "restricciones": [
            "Cada cliente recibe exactamente su demanda.",
            "Lo que entra a un almacén es lo que sale de él.",
            "Un almacén solo envía si está abierto y hasta su capacidad.",
            "Cada planta envía como máximo su capacidad (si tiene).",
        ]
        + (["Se abren como mínimo %d almacenes." % d.min_almacenes] if d.min_almacenes > 0 else [])
        + (["Se abren como máximo %d almacenes." % d.max_almacenes] if d.max_almacenes is not None else [])
        + (["Obligatorios abiertos: " + ", ".join(d.forzar_abiertos) + "."] if d.forzar_abiertos else [])
        + (["Obligatorios cerrados: " + ", ".join(d.forzar_cerrados) + "."] if d.forzar_cerrados else []),
        "idea": (
            "El costo fijo hace que el problema no se pueda resolver como un transporte simple: hay que decidir QUÉ almacenes abrir. "
            f"Con {len(d.almacenes)} almacenes hay {2 ** len(d.almacenes) - 1} combinaciones posibles. Para cada una "
            "se suma el costo fijo y se resuelve el transporte con solo esos almacenes; gana la más barata."
        ),
    }


def generar(d: Problema) -> dict:
    W = len(d.almacenes)
    if W > MAX_W_COMPARAR:
        raise ErrorDatos([f"Para ver los pasos usa hasta {MAX_W_COMPARAR} almacenes (hay {W})."])
    P, C = range(len(d.plantas)), range(len(d.clientes))
    demanda = sum(d.demanda)

    descartes, evaluaciones = [], []
    mejor = None
    for k in range(1, W + 1):
        for combo in combinations(range(W), k):
            nombres = [d.almacenes[w] for w in combo]
            motivo = None
            if k < d.min_almacenes:
                motivo = f"Abre {k} almacén(es) y se exigen al menos {d.min_almacenes}."
            elif d.max_almacenes is not None and k > d.max_almacenes:
                motivo = f"Abre {k} almacenes y se permiten como máximo {d.max_almacenes}."
            elif any(n not in nombres for n in d.forzar_abiertos):
                motivo = "No incluye un almacén que debe estar abierto."
            elif any(n in nombres for n in d.forzar_cerrados):
                motivo = "Incluye un almacén que debe estar cerrado."
            else:
                cap = sum(d.capacidad_almacenes[w] for w in combo)
                if cap < demanda:
                    motivo = f"Capacidad insuficiente: {_n(cap)} < demanda {_n(demanda)}."
            if motivo:
                descartes.append({"almacenes": nombres, "motivo": motivo})
                continue
            m, y, x, z, estado = _construir(d, fijar=set(combo))
            if estado != "Optimal":
                descartes.append({"almacenes": nombres, "motivo": "No se puede abastecer a todos los clientes con esta combinación."})
                continue
            _, fijo, transp = _costos(d, y, x, z)
            total = fijo + transp
            mejora = mejor is None or total < mejor - 1e-9
            previo = mejor
            if mejora:
                mejor = total
            evaluaciones.append({
                "n": len(evaluaciones) + 1,
                "almacenes": nombres,
                "detalle_fijo": [{"almacen": d.almacenes[w], "costo": _n(d.costo_fijo[w])} for w in combo],
                "costo_fijo": _n(fijo),
                "costo_transporte": _n(round(transp, 2)),
                "costo_total": _n(round(total, 2)),
                "envios_planta_almacen": [
                    {"planta": d.plantas[p], "almacen": d.almacenes[w], "unidades": _n(_valor(x[p, w]))}
                    for p in P for w in combo if _valor(x[p, w]) > 1e-6
                ],
                "envios_almacen_cliente": [
                    {"almacen": d.almacenes[w], "cliente": d.clientes[c], "unidades": _n(_valor(z[w, c]))}
                    for w in combo for c in C if _valor(z[w, c]) > 1e-6
                ],
                "mejor_previo": None if previo is None else _n(round(previo, 2)),
                "mejora": mejora,
            })
    if not evaluaciones:
        raise ErrorDatos(["Ninguna combinación de almacenes es factible con las restricciones dadas."])
    totales = [e["costo_total"] for e in evaluaciones]
    ganadora = min(range(len(evaluaciones)), key=lambda i: (totales[i], i))
    for i, e in enumerate(evaluaciones):
        e["es_optima"] = i == ganadora
    g = evaluaciones[ganadora]
    return {
        "plantas": d.plantas,
        "almacenes": d.almacenes,
        "clientes": d.clientes,
        "factor_unidades": _n(d.factor_unidades),
        "capacidad_almacenes": [_n(c) for c in d.capacidad_almacenes],
        "costo_fijo": [_n(c) for c in d.costo_fijo],
        "demanda_total": _n(demanda),
        "modelo": _modelo(d),
        "descartes": descartes,
        "evaluaciones": evaluaciones,
        "resultado": {
            "almacenes": g["almacenes"],
            "costo_fijo": g["costo_fijo"],
            "costo_transporte": g["costo_transporte"],
            "costo_total": g["costo_total"],
            "peor": max(totales),
            "evaluadas": len(evaluaciones),
            "descartadas": len(descartes),
        },
    }
