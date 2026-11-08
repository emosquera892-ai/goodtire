from typing import Annotated, List, Literal, Optional

import pulp
from pydantic import BaseModel, Field, model_validator

from .comun import nombres_unicos, parsear_con
from .esquema import ErrorDatos

NoNeg = Annotated[float, Field(ge=0, le=1e12)]
Nombre = Annotated[str, Field(min_length=1, max_length=60)]
TIEMPO_LIMITE = 30


class Nodo(BaseModel):
    nombre: Nombre
    tipo: Literal["origen", "intermedio", "destino"]
    # origen: oferta; destino: demanda; intermedio: capacidad máxima de paso (None = ilimitada)
    cantidad: Optional[NoNeg] = None


class Transbordo(BaseModel):
    nodos: List[Nodo] = Field(min_length=2, max_length=30)
    # costos[i][j]: costo por unidad de enviar del nodo i al nodo j; None = no hay ruta
    costos: List[List[Optional[NoNeg]]]

    @model_validator(mode="after")
    def validar(self):
        N = len(self.nodos)
        nombres_unicos(nodos=[n.nombre for n in self.nodos])
        if len(self.costos) != N or any(len(f) != N for f in self.costos):
            raise ValueError(f"costos debe ser una matriz de {N} x {N} (todos los nodos contra todos)")
        for n in self.nodos:
            if n.tipo in ("origen", "destino") and n.cantidad is None:
                et = "la oferta" if n.tipo == "origen" else "la demanda"
                raise ValueError(f"'{n.nombre}' necesita {et}")
        origenes = [n for n in self.nodos if n.tipo == "origen"]
        destinos = [n for n in self.nodos if n.tipo == "destino"]
        if not origenes:
            raise ValueError("Debe haber al menos un origen")
        if not destinos:
            raise ValueError("Debe haber al menos un destino")
        for j, n in enumerate(self.nodos):
            if n.tipo == "destino" and n.cantidad > 0:
                if all(self.costos[i][j] is None for i in range(N) if i != j):
                    raise ValueError(f"Ninguna ruta llega a '{n.nombre}'")
        return self


def parsear(datos) -> Transbordo:
    return parsear_con(Transbordo, datos)


def _modelo(d: Transbordo, arcos, sentido, cobertura=None):
    N = range(len(d.nodos))
    m = pulp.LpProblem("Transbordo", sentido)
    x = {a: pulp.LpVariable(f"x_{a[0]}_{a[1]}", lowBound=0) for a in arcos}
    neto = []  # lo que realmente se queda en cada destino
    for k in N:
        sale = pulp.lpSum(x[k, j] for j in N if (k, j) in x)
        entra = pulp.lpSum(x[i, k] for i in N if (i, k) in x)
        nodo = d.nodos[k]
        if nodo.tipo == "origen":
            m += sale - entra <= nodo.cantidad
            m += sale - entra >= 0
        elif nodo.tipo == "destino":
            m += entra - sale <= nodo.cantidad
            m += entra - sale >= 0
            neto.append(entra - sale)
        else:
            m += entra - sale == 0
            if nodo.cantidad is not None:
                m += entra <= nodo.cantidad
    entregado = pulp.lpSum(neto)
    if cobertura is None:
        m += entregado  # fase 1: entregar lo máximo posible
    else:
        m += pulp.lpSum(d.costos[i][j] * x[i, j] for i, j in arcos)  # fase 2: al menor costo
        m += entregado >= cobertura - 1e-6
    m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=TIEMPO_LIMITE))
    return m, x


def resolver(d: Transbordo) -> dict:
    """Entrega la mayor cantidad posible (toda la demanda si alcanza) y, entre esos
    planes, el de menor costo. Si no alcanza, informa el faltante por destino."""
    N = range(len(d.nodos))
    arcos = [(i, j) for i in N for j in N if i != j and d.costos[i][j] is not None]

    x = {}
    estado = "Optimal"
    if arcos:
        m1, _ = _modelo(d, arcos, pulp.LpMaximize)
        if pulp.LpStatus[m1.status] != "Optimal":
            raise ErrorDatos([f"No se encontró solución óptima (estado: {pulp.LpStatus[m1.status]})"])
        cobertura = round(m1.objective.value() or 0, 6)
        m, x = _modelo(d, arcos, pulp.LpMinimize, cobertura)
        estado = pulp.LpStatus[m.status]
        if estado != "Optimal":
            raise ErrorDatos([f"No se encontró solución óptima (estado: {estado})"])

    val = lambda a: round(x[a].value() or 0, 4) if a in x else 0
    flujos = [
        {
            "desde": d.nodos[i].nombre,
            "hasta": d.nodos[j].nombre,
            "unidades": val((i, j)),
            "costo_unitario": d.costos[i][j],
            "costo": round(val((i, j)) * d.costos[i][j], 2),
        }
        for i, j in arcos
        if val((i, j)) > 1e-6
    ]
    entra = {k: sum(val((i, k)) for i in N if (i, k) in x) for k in N}
    sale = {k: sum(val((k, j)) for j in N if (k, j) in x) for k in N}
    oferta = sum(n.cantidad for n in d.nodos if n.tipo == "origen")
    demanda = sum(n.cantidad for n in d.nodos if n.tipo == "destino")
    faltante = {
        k: round(max(0.0, d.nodos[k].cantidad - (entra[k] - sale[k])), 4) if d.nodos[k].tipo == "destino" else 0
        for k in N
    }
    falta = round(sum(faltante.values()), 4)
    return {
        "estado": estado,
        "costo_total": round(sum(f["costo"] for f in flujos), 2),
        "oferta_total": oferta,
        "demanda_total": demanda,
        "entregado_total": round(demanda - falta, 4),
        "faltante_total": falta,
        "cubierta": falta < 1e-6,
        "balanceado": abs(oferta - demanda) < 1e-9,
        "flujos": flujos,
        "detalle_nodos": [
            {
                "nombre": d.nodos[k].nombre,
                "tipo": d.nodos[k].tipo,
                "cantidad": d.nodos[k].cantidad,
                "entra": round(entra[k], 4),
                "sale": round(sale[k], 4),
                "faltante": faltante[k],
            }
            for k in N
        ],
    }


def resumen(resultado) -> str:
    n = len((resultado or {}).get("flujos", []))
    return f"{n} rutas activas" if n != 1 else "1 ruta activa"


def _matriz(nombres, arcos):
    n = len(nombres)
    m = [[None] * n for _ in range(n)]
    for (a, b), c in arcos.items():
        m[nombres.index(a)][nombres.index(b)] = c
    return m


_NOMBRES = ["Fábrica 1", "Fábrica 2", "Bodega A", "Bodega B", "Cliente 1", "Cliente 2", "Cliente 3"]
EJEMPLO = {
    # Fábricas -> bodegas (transbordo) -> clientes, con algunas rutas directas
    "nodos": [
        {"nombre": "Fábrica 1", "tipo": "origen", "cantidad": 150},
        {"nombre": "Fábrica 2", "tipo": "origen", "cantidad": 200},
        {"nombre": "Bodega A", "tipo": "intermedio", "cantidad": None},
        {"nombre": "Bodega B", "tipo": "intermedio", "cantidad": None},
        {"nombre": "Cliente 1", "tipo": "destino", "cantidad": 130},
        {"nombre": "Cliente 2", "tipo": "destino", "cantidad": 130},
        {"nombre": "Cliente 3", "tipo": "destino", "cantidad": 90},
    ],
    "costos": _matriz(_NOMBRES, {
        ("Fábrica 1", "Bodega A"): 8, ("Fábrica 1", "Bodega B"): 15,
        ("Fábrica 2", "Bodega A"): 15, ("Fábrica 2", "Bodega B"): 12,
        ("Bodega A", "Cliente 1"): 6, ("Bodega A", "Cliente 2"): 10, ("Bodega A", "Cliente 3"): 7,
        ("Bodega B", "Cliente 1"): 12, ("Bodega B", "Cliente 2"): 5, ("Bodega B", "Cliente 3"): 9,
        ("Fábrica 1", "Cliente 3"): 30,
    }),
}
