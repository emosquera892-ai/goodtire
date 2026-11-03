from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from models import Problema
from solver import resolver

app = FastAPI(title="Good Tire - Ubicación de almacenes")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def errores_validacion(request: Request, exc: RequestValidationError):
    errores = []
    for e in exc.errors():
        campo = ".".join(str(p) for p in e["loc"] if p != "body")
        msg = str(e["msg"]).removeprefix("Value error, ")
        errores.append(f"{campo}: {msg}" if campo else msg)
    return JSONResponse(status_code=422, content={"detail": errores})


@app.get("/salud")
def salud():
    return {"ok": True}


@app.get("/reglas")
def reglas():
    return {
        "limites": {
            "almacenes": "1 a 20, nombres únicos de 1 a 60 caracteres",
            "clientes": "1 a 100, nombres únicos de 1 a 60 caracteres",
            "numeros": "mayores o iguales a 0 (no se permiten negativos)",
            "factor_unidades": "mayor que 0 (1000 si capacidades y demanda están en miles)",
        },
        "campos": {
            "capacidad_almacenes": "un valor por almacén (en miles de unidades/mes)",
            "costo_planta_almacen": "$/unidad desde la planta a cada almacén",
            "costo_fijo": "$/mes de operación de cada almacén",
            "demanda": "un valor por cliente (en miles de unidades/mes)",
            "costo_almacen_cliente": "matriz almacenes x clientes, $/unidad",
            "min_almacenes / max_almacenes": "opcional: límites de almacenes abiertos",
            "forzar_abiertos / forzar_cerrados": "opcional: nombres de almacenes",
        },
        "validaciones": [
            "La capacidad disponible debe cubrir la demanda total",
            "Las listas y matrices deben tener las dimensiones correctas",
            "Un almacén no puede estar forzado abierto y cerrado a la vez",
            "El problema debe ser factible con las restricciones dadas",
        ],
    }


@app.get("/ejemplo")
def ejemplo():
    # Caso de estudio: Good Tire, Inc. (Tablas 9.23 y 9.24)
    return {
        "planta": "Akron",
        "almacenes": ["Cleveland", "Harrisburg", "Chicago", "Trenton", "Louisville"],
        "clientes": ["Cleveland", "Cincinnati", "Dayton", "Indianápolis", "Chicago",
                     "Búfalo", "Pittsburgh", "Filadelfia", "Nashville", "Boston"],
        "capacidad_almacenes": [80, 60, 60, 60, 60],
        "costo_planta_almacen": [0.25, 0.50, 0.75, 0.75, 0.75],
        "costo_fijo": [40000, 20000, 30000, 25000, 20000],
        "demanda": [30, 20, 18, 16, 38, 22, 27, 32, 19, 26],
        "costo_almacen_cliente": [
            [0.25, 1.25, 0.75, 1.63, 1.75, 1.00, 0.63, 2.13, 2.63, 3.25],
            [0.63, 1.50, 1.38, 1.75, 2.38, 1.13, 0.88, 0.63, 2.88, 2.75],
            [1.75, 1.50, 1.38, 1.00, 0.25, 2.75, 2.38, 3.88, 2.38, 5.00],
            [2.13, 2.75, 2.38, 3.50, 3.88, 1.88, 1.75, 0.50, 4.25, 1.25],
            [1.75, 0.50, 1.00, 0.50, 1.50, 2.75, 2.00, 3.50, 0.88, 4.88],
        ],
        "factor_unidades": 1000,
        "min_almacenes": 0,
        "max_almacenes": None,
        "forzar_abiertos": [],
        "forzar_cerrados": [],
    }


@app.post("/resolver")
def post_resolver(problema: Problema):
    try:
        return resolver(problema)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
