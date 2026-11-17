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
