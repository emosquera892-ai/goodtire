import { pedir, type Problema } from "./api";

export type FilaSens = {
  pct: number;
  factible: boolean;
  omitido?: boolean;
  costo_total: number | null;
  cambio: number | null;
  cambio_pct: number | null;
  abiertos: string[];
  cambia_decision: boolean;
};
export type EscenarioSens = { parametro: string; etiqueta: string; variaciones: FilaSens[] };
export type AlmacenSens = FilaSens & { almacen: string; abierto_base: boolean; accion: "abrir" | "cerrar" };
export type Sensibilidad = {
  base: { costo_total: number; abiertos: string[] };
  escenarios: EscenarioSens[];
  almacenes: AlmacenSens[];
  lectura: string[];
  incompleto: boolean;
};

export const analizarSensibilidad = (p: Problema) =>
  pedir<Sensibilidad>("/problemas/ubicacion/sensibilidad", { method: "POST", body: JSON.stringify(p) });

/* ---------- Transporte, Transbordo y Asignación ---------- */

export type TipoSensRedes = "transporte" | "transbordo" | "asignacion";
export type FilaRedes = {
  pct?: number;
  factible: boolean;
  nota: string;
  costo_total: number | null;
  cambio: number | null;
  cambio_pct: number | null;
  cambia_decision: boolean;
  etiqueta?: string;
  costo_actual?: number;
  limite?: number | null;
};
export type SensibilidadRedes = {
  tipo: TipoSensRedes;
  base: { costo_total: number; cubierta: boolean; objetivo: string | null };
  escenarios: { parametro: string; etiqueta: string; variaciones: FilaRedes[] }[];
  alternativas: FilaRedes[];
  lectura: string[];
  incompleto: boolean;
};

export const analizarSensibilidadRedes = (tipo: TipoSensRedes, datos: unknown) =>
  pedir<SensibilidadRedes>(`/problemas/${tipo}/sensibilidad`, { method: "POST", body: JSON.stringify(datos) });
