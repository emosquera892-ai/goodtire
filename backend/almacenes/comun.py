from pydantic import ValidationError

from .esquema import ErrorDatos


def parsear_con(modelo, datos):
    """Convierte un dict en el modelo dado o lanza ErrorDatos con mensajes cortos."""
    if not isinstance(datos, dict):
        raise ErrorDatos(["Los datos deben ser un objeto JSON"])
    try:
        return modelo(**datos)
    except ValidationError as e:
        mensajes = []
        for err in e.errors():
            campo = ".".join(str(p) for p in err["loc"])
            msg = str(err["msg"]).removeprefix("Value error, ")
            mensajes.append(f"{campo}: {msg}" if campo else msg)
        raise ErrorDatos(mensajes)


def nombres_unicos(**listas):
    for nombre, lista in listas.items():
        if len(set(lista)) != len(lista):
            raise ValueError(f"Hay nombres repetidos en {nombre}")
