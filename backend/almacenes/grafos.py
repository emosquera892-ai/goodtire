"""Problemas de redes: ruta más corta (Dijkstra), flujo máximo (Edmonds-Karp) y árbol de expansión mínima (Kruskal)."""
from collections import deque
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from .comun import nombres_unicos, parsear_con

Nombre = Annotated[str, Field(min_length=1, max_length=12)]
Valor = Annotated[float, Field(ge=0, le=1e9)]
EPS = 1e-9


class Arista(BaseModel):
    de: Nombre
    a: Nombre
    valor: Valor


class Grafo(BaseModel):
    algoritmo: Literal["ruta", "flujo", "arbol"]
    nodos: List[Nombre] = Field(min_length=2, max_length=20)
    aristas: List[Arista] = Field(min_length=1, max_length=60)
    origen: Optional[Nombre] = None
    destino: Optional[Nombre] = None
    dirigido: bool = False

    @model_validator(mode="after")
    def validar(self):
        nombres_unicos(nodos=self.nodos)
        existentes = set(self.nodos)
        for i, x in enumerate(self.aristas, 1):
            if x.de not in existentes or x.a not in existentes:
                raise ValueError(f"la conexión {i} usa un nodo que no está en la lista")
            if x.de == x.a:
                raise ValueError(f"la conexión {i} une un nodo consigo mismo")
        if self.algoritmo in ("ruta", "flujo"):
            for campo in ("origen", "destino"):
                if getattr(self, campo) not in existentes:
                    raise ValueError(f"{campo} debe ser uno de los nodos")
            if self.origen == self.destino:
                raise ValueError("origen y destino deben ser distintos")
        if self.algoritmo == "flujo":
            self.dirigido = True
        if self.algoritmo == "arbol":
            self.dirigido = False
        return self


def parsear(datos) -> Grafo:
    return parsear_con(Grafo, datos)


def _r(x):
    return round(float(x), 6)


def _ruta(d: Grafo):
    dist = {n: float("inf") for n in d.nodos}
    previa = {n: None for n in d.nodos}
    dist[d.origen] = 0.0
    fijos = []
    while True:
        mejor = None
        for n in d.nodos:
            if n not in fijos and dist[n] < float("inf") and (mejor is None or dist[n] < dist[mejor]):
                mejor = n
        if mejor is None:
            break
        fijos.append(mejor)
        for i, x in enumerate(d.aristas):
            if x.de == mejor:
                otro = x.a
            elif not d.dirigido and x.a == mejor:
                otro = x.de
            else:
                continue
            if otro in fijos:
                continue
            nueva = dist[mejor] + x.valor
            if nueva < dist[otro]:
                dist[otro] = nueva
                previa[otro] = i
        if mejor == d.destino:
            break
    if d.destino not in fijos:
        return {"algoritmo": "ruta", "costo_total": 0.0, "hay_ruta": False, "camino": [], "mensaje": f"Sin ruta de {d.origen} a {d.destino}"}
    camino, n = [d.destino], d.destino
    while previa[n] is not None:
        x = d.aristas[previa[n]]
        n = x.de if x.a == n else x.a
        camino.insert(0, n)
    return {"algoritmo": "ruta", "costo_total": _r(dist[d.destino]), "hay_ruta": True, "camino": camino, "mensaje": " → ".join(camino)}


def _flujo(d: Grafo):
    res = []
    salidas = {n: [] for n in d.nodos}
    for i, x in enumerate(d.aristas):
        res += [x.valor, 0.0]
        salidas[x.de].append(2 * i)
        salidas[x.a].append(2 * i + 1)

    def fin(arco):
        x = d.aristas[arco >> 1]
        return x.a if arco % 2 == 0 else x.de

    total = 0.0
    caminos = 0
    while caminos < 5000:
        via = {d.origen: None}
        cola = deque([d.origen])
        while cola and d.destino not in via:
            u = cola.popleft()
            for arco in salidas[u]:
                v = fin(arco)
                if res[arco] > EPS and v not in via:
                    via[v] = arco
                    cola.append(v)
        if d.destino not in via:
            break
        arcos, n = [], d.destino
        while via[n] is not None:
            arcos.append(via[n])
            n = d.aristas[via[n] >> 1].de if via[n] % 2 == 0 else d.aristas[via[n] >> 1].a
        cuello = min(res[a] for a in arcos)
        for a in arcos:
            res[a] -= cuello
            res[a ^ 1] += cuello
        total += cuello
        caminos += 1
    flujos = [{"de": x.de, "a": x.a, "flujo": _r(res[2 * i + 1]), "capacidad": x.valor} for i, x in enumerate(d.aristas)]
    return {
        "algoritmo": "flujo",
        "costo_total": _r(total),
        "caminos": caminos,
        "flujos": flujos,
        "mensaje": f"Flujo máximo {_r(total):g} de {d.origen} a {d.destino}",
    }


def _arbol(d: Grafo):
    padre = {n: n for n in d.nodos}

    def raiz(n):
        while padre[n] != n:
            padre[n] = padre[padre[n]]
            n = padre[n]
        return n

    orden = sorted(range(len(d.aristas)), key=lambda i: (d.aristas[i].valor, i))
    elegidas, total = [], 0.0
    for i in orden:
        if len(elegidas) >= len(d.nodos) - 1:
            break
        x = d.aristas[i]
        a, b = raiz(x.de), raiz(x.a)
        if a != b:
            padre[a] = b
            total += x.valor
            elegidas.append(i)
    grupos = len({raiz(n) for n in d.nodos})
    return {
        "algoritmo": "arbol",
        "costo_total": _r(total),
        "elegidas": [{"de": d.aristas[i].de, "a": d.aristas[i].a, "valor": d.aristas[i].valor} for i in elegidas],
        "conexo": grupos == 1,
        "mensaje": f"{len(elegidas)} conexiones" + ("" if grupos == 1 else f", {grupos} grupos separados"),
    }


def resolver(d: Grafo) -> dict:
    return {"ruta": _ruta, "flujo": _flujo, "arbol": _arbol}[d.algoritmo](d)


def resumen(resultado) -> str:
    r = resultado or {}
    nombre = {"ruta": "Ruta más corta", "flujo": "Flujo máximo", "arbol": "Árbol mínimo"}.get(r.get("algoritmo"), "Grafo")
    msg = r.get("mensaje", "")
    return msg if msg.startswith(nombre) else f"{nombre}: {msg}".strip(": ")


EJEMPLO = {
    "algoritmo": "ruta",
    "nodos": ["Cleveland", "Chicago", "Detroit", "Columbus", "Pittsburgh", "Louisville"],
    "aristas": [
        {"de": "Cleveland", "a": "Detroit", "valor": 170},
        {"de": "Cleveland", "a": "Columbus", "valor": 140},
        {"de": "Cleveland", "a": "Pittsburgh", "valor": 135},
        {"de": "Detroit", "a": "Chicago", "valor": 280},
        {"de": "Columbus", "a": "Chicago", "valor": 355},
        {"de": "Columbus", "a": "Louisville", "valor": 210},
        {"de": "Pittsburgh", "a": "Columbus", "valor": 185},
        {"de": "Louisville", "a": "Chicago", "valor": 300},
    ],
    "origen": "Cleveland",
    "destino": "Chicago",
    "dirigido": False,
}
