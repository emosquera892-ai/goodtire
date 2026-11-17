import { pedir } from "./api";
import type { Algoritmo, DatosG } from "./grafos";

export type CasoG = {
  id: number;
  tipo: string;
  nombre: string;
  datos: DatosG;
  resultado: { algoritmo: Algoritmo; costo_total: number; mensaje: string } | null;
  costo_total: number | null;
  creado: string;
  actualizado: string;
};


export const crearCasoG = (nombre: string, datos: DatosG) =>
  pedir<CasoG>("/casos", { method: "POST", body: JSON.stringify({ tipo: "grafos", nombre, datos }) }, true);
export const actualizarCasoG = (id: number, cambios: { nombre?: string; datos?: DatosG }) =>
  pedir<CasoG>(`/casos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }, true);
export const obtenerCasoG = (id: number) => pedir<CasoG>(`/casos/${id}`, {}, true);

