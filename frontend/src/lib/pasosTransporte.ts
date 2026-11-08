import { pedir } from "./api";
import type { ProblemaB } from "./transbordo";
import type { ProblemaT } from "./transporte";

export type MetodoInicial = "esquina_noroeste" | "costo_minimo" | "vogel";
export const METODOS: { id: MetodoInicial; nombre: string }[] = [
  { id: "vogel", nombre: "Vogel" },
  { id: "costo_minimo", nombre: "Costo mínimo" },
  { id: "esquina_noroeste", nombre: "Esquina noroeste" },
];

export type Matriz = (number | null)[][];
export type PasoInicial = {
  titulo: string;
  texto: string;
  celda: [number, number];
  cantidad: number;
  asignacion: Matriz;
  oferta_restante: number[];
  demanda_restante: number[];
  tachadas: { filas: number[]; columnas: number[] };
  penalizaciones?: { filas: Record<string, number | "M">; columnas: Record<string, number | "M"> };
  linea?: { tipo: "fila" | "columna"; indice: number };
};
export type Iteracion = {
  n: number;
  asignacion: Matriz;
  u: number[];
  v: number[];
  delta: Matriz;
  costo: number;
  unidades_m: number;
  optimo: boolean;
  texto: string;
  entrante?: [number, number];
  ciclo?: { celda: [number, number]; signo: "+" | "-" }[];
  theta?: number;
  saliente?: [number, number];
};
export type ExtraB = {
  intro: { titulo: string; texto: string; nodos: { nombre: string; tipo: string; oferta: number; demanda: number; colchon: number }[] };
  final: {
    titulo: string;
    texto: string;
    flujos: { desde: string; hasta: string; unidades: number; costo_unitario: number; costo: number }[];
    costo_total: number;
  };
};
export type PasosT = {
  extra?: ExtraB;
  metodo: MetodoInicial;
  metodo_nombre: string;
  filas: string[];
  columnas: string[];
  oferta: number[];
  demanda: number[];
  costos: Matriz; // null = M
  balanceo: { oferta: number; demanda: number; ficticio: "origen" | "destino" | null; cantidad?: number; texto: string };
  inicial: { pasos: PasoInicial[]; costo: number; unidades_m: number };
  optimizacion: { iteraciones: Iteracion[] };
  resultado: {
    asignacion: Matriz;
    costo_total: number;
    sin_cubrir: number;
    envios: { origen: string; destino: string; unidades: number; costo_unitario: number }[];
  };
};

export const pasosT = (datos: ProblemaT, metodo: MetodoInicial) =>
  pedir<PasosT>("/problemas/transporte/pasos", { method: "POST", body: JSON.stringify({ datos, metodo }) });

export const pasosB = (datos: ProblemaB, metodo: MetodoInicial) =>
  pedir<PasosT>("/problemas/transbordo/pasos", { method: "POST", body: JSON.stringify({ datos, metodo }) });
