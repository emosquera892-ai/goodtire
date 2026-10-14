from typing import List, Annotated
from pydantic import BaseModel, Field, model_validator

NoNeg = Annotated[float, Field(ge=0)]
Nombre = Annotated[str, Field(min_length=1, max_length=60)]


class Problema(BaseModel):
    plantas: List[Nombre] = Field(min_length=1, max_length=30)
    almacenes: List[Nombre] = Field(min_length=1, max_length=30)
    clientes: List[Nombre] = Field(min_length=1, max_length=100)
    capacidad_plantas: List[NoNeg]
    capacidad_almacenes: List[NoNeg]
    demanda: List[NoNeg]
    costo_fijo: List[NoNeg]
    costo_planta_almacen: List[List[NoNeg]]
    costo_almacen_cliente: List[List[NoNeg]]

    @model_validator(mode="after")
    def validar(self):
        P, W, C = len(self.plantas), len(self.almacenes), len(self.clientes)
        for nombre, lista in [("plantas", self.plantas), ("almacenes", self.almacenes), ("clientes", self.clientes)]:
            if len(set(lista)) != len(lista):
                raise ValueError(f"Hay nombres repetidos en {nombre}")
        if len(self.capacidad_plantas) != P:
            raise ValueError("capacidad_plantas debe tener un valor por planta")
        if len(self.capacidad_almacenes) != W or len(self.costo_fijo) != W:
            raise ValueError("capacidad_almacenes y costo_fijo deben tener un valor por almacén")
        if len(self.demanda) != C:
            raise ValueError("demanda debe tener un valor por cliente")
        if len(self.costo_planta_almacen) != P or any(len(f) != W for f in self.costo_planta_almacen):
            raise ValueError(f"costo_planta_almacen debe ser matriz {P}x{W}")
        if len(self.costo_almacen_cliente) != W or any(len(f) != C for f in self.costo_almacen_cliente):
            raise ValueError(f"costo_almacen_cliente debe ser matriz {W}x{C}")
        if sum(self.capacidad_plantas) < sum(self.demanda):
            raise ValueError("Capacidad total de plantas menor que la demanda total")
        if sum(self.capacidad_almacenes) < sum(self.demanda):
            raise ValueError("Capacidad total de almacenes menor que la demanda total")
        return self
