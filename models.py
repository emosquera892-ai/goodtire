from typing import List, Annotated, Optional
from pydantic import BaseModel, Field, model_validator

NoNeg = Annotated[float, Field(ge=0, le=1e12)]
Nombre = Annotated[str, Field(min_length=1, max_length=60)]


class Problema(BaseModel):
    planta: Nombre = "Akron"
    almacenes: List[Nombre] = Field(min_length=1, max_length=20)
    clientes: List[Nombre] = Field(min_length=1, max_length=100)
    capacidad_almacenes: List[NoNeg]
    costo_planta_almacen: List[NoNeg]
    costo_fijo: List[NoNeg]
    demanda: List[NoNeg]
    costo_almacen_cliente: List[List[NoNeg]]
    factor_unidades: float = Field(default=1000, gt=0, le=1e9)
    min_almacenes: int = Field(default=0, ge=0)
    max_almacenes: Optional[int] = Field(default=None, ge=1)
    forzar_abiertos: List[str] = []
    forzar_cerrados: List[str] = []

    @model_validator(mode="after")
    def validar(self):
        W, C = len(self.almacenes), len(self.clientes)
        for nombre, lista in [("almacenes", self.almacenes), ("clientes", self.clientes)]:
            if len(set(lista)) != len(lista):
                raise ValueError(f"Hay nombres repetidos en {nombre}")
        if len(self.capacidad_almacenes) != W:
            raise ValueError("capacidad_almacenes debe tener un valor por almacén")
        if len(self.costo_planta_almacen) != W:
            raise ValueError("costo_planta_almacen debe tener un valor por almacén")
        if len(self.costo_fijo) != W:
            raise ValueError("costo_fijo debe tener un valor por almacén")
        if len(self.demanda) != C:
            raise ValueError("demanda debe tener un valor por cliente")
        if len(self.costo_almacen_cliente) != W or any(len(f) != C for f in self.costo_almacen_cliente):
            raise ValueError(f"costo_almacen_cliente debe ser una matriz de {W} filas (almacenes) x {C} columnas (clientes)")
        for nombre in self.forzar_abiertos + self.forzar_cerrados:
            if nombre not in self.almacenes:
                raise ValueError(f"El almacén '{nombre}' no existe en la lista de almacenes")
        if set(self.forzar_abiertos) & set(self.forzar_cerrados):
            raise ValueError("Un almacén no puede estar a la vez en forzar_abiertos y forzar_cerrados")
        if self.max_almacenes is not None:
            if self.max_almacenes > W:
                raise ValueError("max_almacenes no puede ser mayor que el número de almacenes")
            if self.min_almacenes > self.max_almacenes:
                raise ValueError("min_almacenes no puede ser mayor que max_almacenes")
            if len(self.forzar_abiertos) > self.max_almacenes:
                raise ValueError("forzar_abiertos excede max_almacenes")
        if self.min_almacenes > W - len(self.forzar_cerrados):
            raise ValueError("min_almacenes es mayor que los almacenes disponibles")
        demanda_total = sum(self.demanda)
        disponible = sum(c for n, c in zip(self.almacenes, self.capacidad_almacenes) if n not in self.forzar_cerrados)
        if disponible < demanda_total:
            raise ValueError(
                f"Capacidad disponible ({disponible:g}) menor que la demanda total ({demanda_total:g})"
            )
        return self
