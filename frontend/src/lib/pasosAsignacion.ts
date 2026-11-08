import { pedir } from "./api";
import type { ProblemaA } from "./asignacion";

export type MatrizA = (number | null)[][];
export type PasoA = {
  tipo: "preparar" | "filas" | "columnas" | "cubrir" | "ajustar" | "final";
  titulo: string;
  texto: string;
  matriz: MatrizA;
  minimos?: number[];
  minimos_col?: number[];
  cobertura?: { filas: number[]; columnas: number[] };
  optimo?: boolean;
  delta?: number;
  elegidas?: [number, number][];
};
export type PasosAsig = {
  filas: string[];
  columnas: string[];
  objetivo: "minimizar" | "maximizar";
  n_agentes: number;
  n_tareas: number;
  originales: MatrizA;
  pasos: PasoA[];
  resultado: {
    asignaciones: { agente: string; tarea: string; costo: number }[];
    costo_total: number;
    agentes_sin_tarea: string[];
    tareas_sin_agente: string[];
  };
};

export const pasosA = (datos: ProblemaA) =>
  pedir<PasosAsig>("/problemas/asignacion/pasos", { method: "POST", body: JSON.stringify({ datos }) });
