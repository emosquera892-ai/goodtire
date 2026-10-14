from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from models import Problema
from solver import resolver

app = FastAPI(title="Good Tire - Ubicación de almacenes")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/salud")
def salud():
    return {"ok": True}


@app.get("/ejemplo")
def ejemplo():
    # Datos ilustrativos inventados, solo para probar la API
    return {
        "plantas": ["P1", "P2"],
        "almacenes": ["A1", "A2", "A3"],
        "clientes": ["C1", "C2", "C3", "C4"],
        "capacidad_plantas": [500, 400],
        "capacidad_almacenes": [400, 350, 300],
        "demanda": [150, 200, 120, 180],
        "costo_fijo": [10000, 8000, 7000],
        "costo_planta_almacen": [[4, 6, 5], [7, 3, 6]],
        "costo_almacen_cliente": [[2, 5, 4, 6], [5, 2, 3, 4], [6, 4, 2, 3]],
    }


@app.post("/resolver")
def post_resolver(problema: Problema):
    try:
        return resolver(problema)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
