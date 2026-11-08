from typing import Annotated, List, Optional

import pulp
from pydantic import BaseModel, Field, model_validator

from .comun import nombres_unicos, parsear_con
from .esquema import ErrorDatos

NoNeg = Annotated[float, Field(ge=0, le=1e12)]
Nombre = Annotated[str, Field(min_length=1, max_length=60)]
TIEMPO_LIMITE = 30


class Transporte(BaseModel):
    origenes: List[Nombre] = Field(min_length=1, max_length=50)
    destinos: List[Nombre] = Field(min_length=1, max_length=50)
    oferta: List[NoNeg]
    demanda: List[NoNeg]
    # None = ruta no disponible
    costos: List[List[Optional[NoNeg]]]

    @model_validator(mode="after")
    def validar(self):
        O, D = len(self.origenes), len(self.destinos)
        nombres_unicos(origenes=self.origenes, destinos=self.destinos)
        if len(self.oferta) != O:
            raise ValueError("oferta debe tener un valor por origen")
        if len(self.demanda) != D:
            raise ValueError("demanda debe tener un valor por destino")
        if len(self.costos) != O or any(len(f) != D for f in self.costos):
            raise ValueError(f"costos debe ser una matriz de {O} filas (origenes) x {D} columnas (destinos)")
        for j in range(D):
            if self.demanda[j] > 0 and all(self.costos[i][j] is None for i in range(O)):
                raise ValueError(f"Ningún origen puede abastecer a '{self.destinos[j]}' (todas sus rutas están bloqueadas)")
        return self


def parsear(datos) -> Transporte:
    return parsear_con(Transporte, datos)


def _modelo(d: Transporte, rutas, sentido, cobertura=None):
    O, D = range(len(d.origenes)), range(len(d.destinos))
    m = pulp.LpProblem("Transporte", sentido)
    x = {r: pulp.LpVariable(f"x_{r[0]}_{r[1]}", lowBound=0) for r in rutas}
    recibido = {j: pulp.lpSum(x[i, j] for i in O if (i, j) in x) for j in D}
    for i in O:
        m += pulp.lpSum(x[i, j] for j in D if (i, j) in x) <= d.oferta[i]
    for j in D:
        m += recibido[j] <= d.demanda[j]
    entregado = pulp.lpSum(recibido.values())
    if cobertura is None:
        m += entregado  # fase 1: entregar lo máximo posible
    else:
        m += pulp.lpSum(d.costos[i][j] * x[i, j] for i, j in rutas)  # fase 2: al menor costo
        m += entregado >= cobertura - 1e-6
    m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=TIEMPO_LIMITE))
    return m, x


def resolver(d: Transporte) -> dict:
    """Entrega la mayor cantidad posible (toda la demanda si alcanza) y, entre esos
    planes, el de menor costo. Si la oferta no alcanza, informa el faltante."""
    O, D = range(len(d.origenes)), range(len(d.destinos))
    rutas = [(i, j) for i in O for j in D if d.costos[i][j] is not None]

    x = {}
    estado = "Optimal"
    if rutas:
        m1, _ = _modelo(d, rutas, pulp.LpMaximize)
        if pulp.LpStatus[m1.status] != "Optimal":
            raise ErrorDatos([f"No se encontró solución óptima (estado: {pulp.LpStatus[m1.status]})"])
        cobertura = round(m1.objective.value() or 0, 6)
        m, x = _modelo(d, rutas, pulp.LpMinimize, cobertura)
        estado = pulp.LpStatus[m.status]
        if estado != "Optimal":
            raise ErrorDatos([f"No se encontró solución óptima (estado: {estado})"])

    val = lambda r: round(x[r].value() or 0, 4) if r in x else 0
    envios = [
        {
            "origen": d.origenes[i],
            "destino": d.destinos[j],
            "unidades": val((i, j)),
            "costo_unitario": d.costos[i][j],
            "costo": round(val((i, j)) * d.costos[i][j], 2),
        }
        for i, j in rutas
        if val((i, j)) > 1e-6
    ]
    total = round(sum(e["costo"] for e in envios), 2)
    uso = [sum(val((i, j)) for j in D) for i in O]
    recibido = [sum(val((i, j)) for i in O) for j in D]
    faltante = [round(max(0.0, d.demanda[j] - recibido[j]), 4) for j in D]
    return {
        "estado": estado,
        "costo_total": total,
        "oferta_total": sum(d.oferta),
        "demanda_total": sum(d.demanda),
        "entregado_total": round(sum(recibido), 4),
        "faltante_total": round(sum(faltante), 4),
        "cubierta": sum(faltante) < 1e-6,
        "balanceado": abs(sum(d.oferta) - sum(d.demanda)) < 1e-9,
        "envios": envios,
        "detalle_origenes": [
            {
                "origen": d.origenes[i],
                "oferta": d.oferta[i],
                "uso": round(uso[i], 4),
                "sobrante": round(d.oferta[i] - uso[i], 4),
            }
            for i in O
        ],
        "detalle_destinos": [
            {
                "destino": d.destinos[j],
                "demanda": d.demanda[j],
                "recibido": round(recibido[j], 4),
                "faltante": faltante[j],
            }
            for j in D
        ],
    }


def resumen(resultado) -> str:
    n = len((resultado or {}).get("envios", []))
    return f"{n} rutas activas" if n != 1 else "1 ruta activa"


EJEMPLO = {
    # Powerco (Winston): 3 plantas, 4 ciudades. Costo mínimo conocido: 1020
    "origenes": ["Planta 1", "Planta 2", "Planta 3"],
    "destinos": ["Ciudad 1", "Ciudad 2", "Ciudad 3", "Ciudad 4"],
    "oferta": [35, 50, 40],
    "demanda": [45, 20, 30, 30],
    "costos": [
        [8, 6, 10, 9],
        [9, 12, 13, 7],
        [14, 9, 16, 5],
    ],
}
