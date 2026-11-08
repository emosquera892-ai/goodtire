"""Solución paso a paso del problema de transbordo.

Se convierte en un problema de transporte (método de Winston): todos los nodos pasan a ser
origen y destino a la vez, con un «colchón» B que representa lo que puede pasar por cada
nodo. La celda de la diagonal (nodo → él mismo, costo 0) guarda lo que NO pasa por el nodo.
Luego se resuelve con el mismo paso a paso del transporte.
"""
from .esquema import ErrorDatos
from .pasos_transporte import MAX_LADO, generar as generar_transporte
from .transbordo import Transbordo
from .transporte import Transporte

ETIQ = {"origen": "origen", "intermedio": "intermedio", "destino": "destino"}


def _n(x):
    x = round(float(x), 6)
    return int(x) if x == int(x) else x


def generar(d: Transbordo, metodo: str) -> dict:
    N = len(d.nodos)
    if N > MAX_LADO:
        raise ErrorDatos([f"Para ver los pasos usa hasta {MAX_LADO} nodos (hay {N})."])
    S = sum(n.cantidad for n in d.nodos if n.tipo == "origen")
    D = sum(n.cantidad for n in d.nodos if n.tipo == "destino")
    buffer = S if S > 0 else 1

    nombres = [n.nombre for n in d.nodos]
    oferta, demanda, info = [], [], []
    for n in d.nodos:
        if n.tipo == "origen":
            o, dm, b = n.cantidad + buffer, buffer, buffer
        elif n.tipo == "destino":
            o, dm, b = buffer, n.cantidad + buffer, buffer
        else:
            b = min(n.cantidad, buffer) if n.cantidad is not None else buffer
            o, dm = b, b
        oferta.append(o)
        demanda.append(dm)
        info.append({"nombre": n.nombre, "tipo": n.tipo, "oferta": _n(o), "demanda": _n(dm), "colchon": _n(b)})

    costos = [[0 if i == j else d.costos[i][j] for j in range(N)] for i in range(N)]
    cols = list(nombres)
    if S > D:
        # el sobrante solo puede quedarse en los orígenes: columna ficticia con costo 0 solo desde ellos
        for i, n in enumerate(d.nodos):
            costos[i].append(0 if n.tipo == "origen" else None)
        cols.append("Sobrante (ficticio)")
        demanda.append(S - D)

    t = Transporte.model_construct(origenes=nombres, destinos=cols, oferta=oferta, demanda=demanda, costos=costos)
    r = generar_transporte(t, metodo)

    # flujos reales: celdas fuera de la diagonal y sin columnas ficticias
    flujos = [
        {
            "desde": nombres[i],
            "hasta": nombres[j],
            "unidades": r_["unidades"],
            "costo_unitario": r_["costo_unitario"],
        }
        for r_ in r["resultado"]["envios"]
        for i, j in [(nombres.index(r_["origen"]), nombres.index(r_["destino"]) if r_["destino"] in nombres else -1)]
        if j >= 0 and i != j
    ]
    for f in flujos:
        f["costo"] = _n(f["unidades"] * f["costo_unitario"])
    total = sum(f["costo"] for f in flujos)
    r["resultado"]["envios"] = [
        {"origen": f["desde"], "destino": f["hasta"], "unidades": f["unidades"], "costo_unitario": f["costo_unitario"]} for f in flujos
    ]
    r["resultado"]["costo_total"] = _n(total)

    texto_ini = (
        f"En un transbordo los nodos intermedios reciben y reenvían. Para usar el método de transporte, TODOS los nodos se vuelven origen y destino a la vez. "
        f"A cada uno se le suma un colchón B = {_n(buffer)} (la oferta total, el máximo que puede pasar por un nodo"
        + (", o su capacidad de paso si es menor" if any(n.tipo == "intermedio" and n.cantidad is not None for n in d.nodos) else "")
        + "). Un origen tiene oferta = su oferta + B y demanda = B; un destino, oferta = B y demanda = su demanda + B; un intermedio, oferta = demanda = B. "
        "La diagonal (nodo → mismo nodo, costo 0) representa lo que NO pasa por ese nodo. Las rutas que no existen llevan costo M."
    )
    if S > D:
        texto_ini += f" Como sobra oferta ({_n(S)} > {_n(D)}), se agrega una columna ficticia de {_n(S - D)} que solo pueden usar los orígenes."
    if S < D:
        texto_ini += f" Como falta oferta ({_n(S)} < {_n(D)}), el método agrega una fila ficticia con costo M; lo que reciba queda sin cubrir."
    r["extra"] = {
        "intro": {"titulo": "Paso 0 · Convertir el transbordo en transporte", "texto": texto_ini, "nodos": info},
        "final": {
            "titulo": "Interpretar la solución",
            "texto": "Se ignoran las celdas de la diagonal (lo que no pasa por cada nodo) y las ficticias. Las demás celdas con unidades son los envíos reales de la red:",
            "flujos": flujos,
            "costo_total": _n(total),
        },
    }
    return r
