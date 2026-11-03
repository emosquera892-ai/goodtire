from typing import List, Annotated, Optional
from pydantic import BaseModel, Field, ValidationError, model_validator

NoNeg = Annotated[float, Field(ge=0, le=1e12)]
Nombre = Annotated[str, Field(min_length=1, max_length=60)]


class ErrorDatos(Exception):
    """Errores de validación legibles para el usuario."""

    def __init__(self, mensajes):
        self.mensajes = list(mensajes)
        super().__init__("; ".join(self.mensajes))


class Problema(BaseModel):
    plantas: List[Nombre] = Field(min_length=1, max_length=30)
    almacenes: List[Nombre] = Field(min_length=1, max_length=20)
    clientes: List[Nombre] = Field(min_length=1, max_length=100)
    # None = capacidad ilimitada
    capacidad_plantas: List[Optional[NoNeg]]
    capacidad_almacenes: List[NoNeg]
    costo_fijo: List[NoNeg]
    demanda: List[NoNeg]
    costo_planta_almacen: List[List[NoNeg]]
    costo_almacen_cliente: List[List[NoNeg]]
    factor_unidades: float = Field(default=1000, gt=0, le=1e9)
    min_almacenes: int = Field(default=0, ge=0)
    max_almacenes: Optional[int] = Field(default=None, ge=1)
    forzar_abiertos: List[str] = []
    forzar_cerrados: List[str] = []

    @model_validator(mode="after")
    def validar(self):
        P, W, C = len(self.plantas), len(self.almacenes), len(self.clientes)
        for nombre, lista in [("plantas", self.plantas), ("almacenes", self.almacenes), ("clientes", self.clientes)]:
            if len(set(lista)) != len(lista):
                raise ValueError(f"Hay nombres repetidos en {nombre}")
        if len(self.capacidad_plantas) != P:
            raise ValueError("capacidad_plantas debe tener un valor por planta (null = ilimitada)")
        if len(self.capacidad_almacenes) != W:
            raise ValueError("capacidad_almacenes debe tener un valor por almacén")
        if len(self.costo_fijo) != W:
            raise ValueError("costo_fijo debe tener un valor por almacén")
        if len(self.demanda) != C:
            raise ValueError("demanda debe tener un valor por cliente")
        if len(self.costo_planta_almacen) != P or any(len(f) != W for f in self.costo_planta_almacen):
            raise ValueError(f"costo_planta_almacen debe ser una matriz de {P} filas (plantas) x {W} columnas (almacenes)")
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
        disponible_alm = sum(
            c for n, c in zip(self.almacenes, self.capacidad_almacenes) if n not in self.forzar_cerrados
        )
        if disponible_alm < demanda_total:
            raise ValueError(
                f"Capacidad de almacenes disponible ({disponible_alm:g}) menor que la demanda total ({demanda_total:g})"
            )
        if all(c is not None for c in self.capacidad_plantas):
            cap_plantas = sum(self.capacidad_plantas)
            if cap_plantas < demanda_total:
                raise ValueError(
                    f"Capacidad total de plantas ({cap_plantas:g}) menor que la demanda total ({demanda_total:g})"
                )
        return self


def parsear(datos) -> Problema:
    """Convierte un dict en Problema o lanza ErrorDatos con mensajes cortos."""
    if not isinstance(datos, dict):
        raise ErrorDatos(["Los datos deben ser un objeto JSON"])
    try:
        return Problema(**datos)
    except ValidationError as e:
        mensajes = []
        for err in e.errors():
            campo = ".".join(str(p) for p in err["loc"])
            msg = str(err["msg"]).removeprefix("Value error, ")
            mensajes.append(f"{campo}: {msg}" if campo else msg)
        raise ErrorDatos(mensajes)
