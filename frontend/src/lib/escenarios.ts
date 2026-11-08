import { dinero, numero, type Solucion } from "./api";
import type { SolucionA } from "./asignacion";
import type { SolucionB } from "./transbordo";
import type { SolucionT } from "./transporte";

export type ResumenEsc = {
  /** Valor principal (costo, o valor total si se maximiza) */
  valor: number;
  etiquetaValor: string;
  moneda: boolean;
  maximizar: boolean;
  metricas: { etiqueta: string; valor: string }[];
  /** Elementos del plan (para ver qué cambia entre escenarios) */
  items: string[];
  etiquetaItems: string;
};

export const resumenUbicacion = (s: Solucion): ResumenEsc => ({
  valor: s.costo_total,
  etiquetaValor: "Costo total",
  moneda: true,
  maximizar: false,
  metricas: [
    { etiqueta: "Costo fijo", valor: dinero(s.costo_fijo_total) },
    { etiqueta: "Costo de transporte", valor: dinero(s.costo_transporte_total) },
    { etiqueta: "Almacenes abiertos", valor: String(s.almacenes_abiertos.length) },
  ],
  items: s.almacenes_abiertos,
  etiquetaItems: "Almacenes",
});

export const resumenTransporte = (s: SolucionT): ResumenEsc => ({
  valor: s.costo_total,
  etiquetaValor: "Costo total",
  moneda: true,
  maximizar: false,
  metricas: [
    { etiqueta: "Unidades entregadas", valor: numero(s.entregado_total ?? s.demanda_total) },
    { etiqueta: "Demanda sin cubrir", valor: numero(s.faltante_total ?? 0) },
    { etiqueta: "Rutas usadas", valor: String(s.envios.length) },
  ],
  items: s.envios.map((e) => `${e.origen} → ${e.destino}`),
  etiquetaItems: "Rutas",
});

export const resumenTransbordo = (s: SolucionB): ResumenEsc => ({
  valor: s.costo_total,
  etiquetaValor: "Costo total",
  moneda: true,
  maximizar: false,
  metricas: [
    { etiqueta: "Unidades entregadas", valor: numero(s.entregado_total ?? s.demanda_total) },
    { etiqueta: "Demanda sin cubrir", valor: numero(s.faltante_total ?? 0) },
    { etiqueta: "Rutas usadas", valor: String(s.flujos.length) },
  ],
  items: s.flujos.map((f) => `${f.desde} → ${f.hasta}`),
  etiquetaItems: "Rutas",
});

export const resumenAsignacion = (s: SolucionA): ResumenEsc => ({
  valor: s.costo_total,
  etiquetaValor: s.objetivo === "minimizar" ? "Costo total" : "Valor total",
  moneda: false,
  maximizar: s.objetivo === "maximizar",
  metricas: [
    { etiqueta: "Asignaciones", valor: String(s.asignaciones.length) },
    { etiqueta: "Sin asignar", valor: String(s.agentes_sin_tarea.length + s.tareas_sin_agente.length) },
  ],
  items: s.asignaciones.map((a) => `${a.agente} → ${a.tarea}`),
  etiquetaItems: "Asignaciones",
});
