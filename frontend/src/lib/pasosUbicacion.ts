import { pedir, type Problema } from "./api";

export type EnvioPA = { planta: string; almacen: string; unidades: number };
export type EnvioAC = { almacen: string; cliente: string; unidades: number };
export type Evaluacion = {
  n: number;
  almacenes: string[];
  detalle_fijo: { almacen: string; costo: number }[];
  costo_fijo: number;
  costo_transporte: number;
  costo_total: number;
  envios_planta_almacen: EnvioPA[];
  envios_almacen_cliente: EnvioAC[];
  mejor_previo: number | null;
  mejora: boolean;
  es_optima: boolean;
};
export type PasosU = {
  factor_unidades: number;
  demanda_total: number;
  modelo: { variables: string[]; objetivo: string; restricciones: string[]; idea: string };
  descartes: { almacenes: string[]; motivo: string }[];
  evaluaciones: Evaluacion[];
  resultado: {
    almacenes: string[];
    costo_fijo: number;
    costo_transporte: number;
    costo_total: number;
    peor: number;
    evaluadas: number;
    descartadas: number;
  };
};

export const pasosU = (datos: Problema) =>
  pedir<PasosU>("/problemas/ubicacion/pasos", { method: "POST", body: JSON.stringify({ datos }) });
