from typing import Annotated, List, Literal, Optional

import pulp
from pydantic import BaseModel, Field, model_validator

from .comun import nombres_unicos, parsear_con
from .esquema import ErrorDatos

NoNeg = Annotated[float, Field(ge=0, le=1e12)]
Nombre = Annotated[str, Field(min_length=1, max_length=60)]
TIEMPO_LIMITE = 30


class Asignacion(BaseModel):
    agentes: List[Nombre] = Field(min_length=1, max_length=50)
    tareas: List[Nombre] = Field(min_length=1, max_length=50)
    # None = asignación prohibida
    costos: List[List[Optional[NoNeg]]]
    objetivo: Literal["minimizar", "maximizar"] = "minimizar"

    @model_validator(mode="after")
    def validar(self):
        A, T = len(self.agentes), len(self.tareas)
        nombres_unicos(agentes=self.agentes, tareas=self.tareas)
        if len(self.costos) != A or any(len(f) != T for f in self.costos):
            raise ValueError(f"costos debe ser una matriz de {A} filas (agentes) x {T} columnas (tareas)")
        if A <= T:
            for i in range(A):
                if all(c is None for c in self.costos[i]):
                    raise ValueError(f"'{self.agentes[i]}' no tiene ninguna tarea permitida (toda su fila está vacía)")
        if T <= A:
            for j in range(T):
                if all(self.costos[i][j] is None for i in range(A)):
                    raise ValueError(f"'{self.tareas[j]}' no puede ser hecha por nadie (toda su columna está vacía)")
        return self


def parsear(datos) -> Asignacion:
    return parsear_con(Asignacion, datos)


def resolver(d: Asignacion) -> dict:
    A, T = range(len(d.agentes)), range(len(d.tareas))
    pares = [(i, j) for i in A for j in T if d.costos[i][j] is not None]

    m = pulp.LpProblem("Asignacion", pulp.LpMinimize if d.objetivo == "minimizar" else pulp.LpMaximize)
    x = {p: pulp.LpVariable(f"x_{p[0]}_{p[1]}", cat="Binary") for p in pares}
    m += pulp.lpSum(d.costos[i][j] * x[i, j] for i, j in pares)
    for i in A:
        fila = pulp.lpSum(x[i, j] for j in T if (i, j) in x)
        m += (fila == 1) if len(d.agentes) <= len(d.tareas) else (fila <= 1)
    for j in T:
        col = pulp.lpSum(x[i, j] for i in A if (i, j) in x)
        m += (col == 1) if len(d.tareas) <= len(d.agentes) else (col <= 1)
    m.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=TIEMPO_LIMITE))
    estado = pulp.LpStatus[m.status]
    if estado == "Infeasible":
        raise ErrorDatos(["No existe una asignación posible con las combinaciones permitidas"])
    if estado != "Optimal":
        raise ErrorDatos([f"No se encontró solución óptima (estado: {estado})"])

    elegidos = [(i, j) for i, j in pares if (x[i, j].value() or 0) > 0.5]
    asignaciones = [{"agente": d.agentes[i], "tarea": d.tareas[j], "costo": d.costos[i][j]} for i, j in elegidos]
    usados_a = {i for i, _ in elegidos}
    usados_t = {j for _, j in elegidos}
    return {
        "estado": estado,
        "objetivo": d.objetivo,
        "costo_total": round(sum(a["costo"] for a in asignaciones), 2),
        "equilibrado": len(d.agentes) == len(d.tareas),
        "asignaciones": asignaciones,
        "agentes_sin_tarea": [d.agentes[i] for i in A if i not in usados_a],
        "tareas_sin_agente": [d.tareas[j] for j in T if j not in usados_t],
    }


def resumen(resultado) -> str:
    n = len((resultado or {}).get("asignaciones", []))
    return f"{n} asignaciones" if n != 1 else "1 asignación"


EJEMPLO = {
    # Machineco (Winston): tiempos de preparación de 4 máquinas para 4 trabajos. Óptimo conocido: 15
    "agentes": ["Máquina 1", "Máquina 2", "Máquina 3", "Máquina 4"],
    "tareas": ["Trabajo 1", "Trabajo 2", "Trabajo 3", "Trabajo 4"],
    "costos": [
        [14, 5, 8, 7],
        [2, 12, 6, 5],
        [7, 8, 3, 9],
        [2, 4, 6, 10],
    ],
    "objetivo": "minimizar",
}
