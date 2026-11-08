import { pedir } from "./api";

export type Signo = "<=" | ">=" | "=";
export type Objetivo = "maximizar" | "minimizar";

export type ProblemaS = {
  objetivo: Objetivo;
  variables: string[];
  c: number[];
  restricciones: { a: number[]; signo: Signo; b: number }[];
};

export type Termino = { coef: string; var: string };
export type Iteracion = {
  n: number;
  columnas: string[];
  base: string[];
  cb: string[];
  costos: string[];
  tabla: string[][];
  rhs: string[];
  fila_z: string[];
  z: string;
  razones: (string | null)[];
  optimo: boolean;
  ilimitado?: boolean;
  entra: string | null;
  entra_idx?: number;
  sale: string | null;
  sale_idx?: number;
  pivote: [number, number] | null;
  texto: string;
  alternativos?: string[];
  algebraico: {
    z: { const: string; terminos: Termino[] };
    filas: { basica: string; const: string; terminos: Termino[] }[];
    no_basicas: string[];
  };
  valores_base: Record<string, string>;
};
export type Fase = { nombre: string; texto: string; nota?: string; resultado: "optimo" | "ilimitado" | "infactible" | null; iteraciones: Iteracion[] };

export type Grafico = {
  variables: string[];
  vista: { xmax: number; ymax: number };
  rectas: { a: number; b: number; signo: Signo; c: number; nombre: string }[];
  poligono: [number, number][];
  segmento: [number, number][] | null;
  vertices: { x: number; y: number; z: number; factible: boolean; optimo: boolean }[];
  objetivo: { c1: number; c2: number; maximizar: boolean };
  optimo: { x: number; y: number; z: number } | null;
  acotada: boolean;
};

export type SolucionS = {
  estado: "optimo" | "ilimitado" | "infactible";
  objetivo_texto: string;
  variables: string[];
  fases: Fase[];
  grafico: Grafico | null;
  solucion: {
    z: string;
    z_num: number;
    valores: { variable: string; valor: string; num: number }[];
    alternativos: boolean;
    degenerada: boolean;
  } | null;
};

export const resolverS = (p: ProblemaS) => pedir<SolucionS>("/problemas/simplex/resolver", { method: "POST", body: JSON.stringify(p) });

/* ---------- Estado del formulario ---------- */

export type EstadoS = {
  objetivo: Objetivo;
  variables: string[];
  c: string[];
  restricciones: { a: string[]; signo: Signo; b: string }[];
};

export const LIMITES_S = { variables: 8, restricciones: 10, nombre: 20, valorMax: 1e9 } as const;

export const ejemploMax = (): EstadoS => ({
  objetivo: "maximizar",
  variables: ["x1", "x2"],
  c: ["3", "2"],
  restricciones: [
    { a: ["2", "1"], signo: "<=", b: "100" },
    { a: ["1", "1"], signo: "<=", b: "80" },
    { a: ["1", "0"], signo: "<=", b: "40" },
  ],
});

export const ejemploMin = (): EstadoS => ({
  objetivo: "minimizar",
  variables: ["x1", "x2"],
  c: ["50", "100"],
  restricciones: [
    { a: ["7", "2"], signo: ">=", b: "28" },
    { a: ["2", "12"], signo: ">=", b: "24" },
  ],
});

export const casoVacioS = (): EstadoS => ({
  objetivo: "maximizar",
  variables: ["x1", "x2"],
  c: ["", ""],
  restricciones: [{ a: ["", ""], signo: "<=", b: "" }],
});

const aNum = (t: string) => Number(t.trim().replace(",", "."));
const esNumero = (t: string) => /^-?(\d+\.?\d*|\.\d+)$/.test(t.trim().replace(",", "."));

export type ErroresS = { celdas: Record<string, string>; globales: string[] };

export function validarS(e: EstadoS): ErroresS {
  const celdas: Record<string, string> = {};
  const num = (k: string, t: string) => {
    if (t.trim() === "") celdas[k] = "Obligatorio";
    else if (!esNumero(t)) celdas[k] = "Debe ser un número";
    else if (Math.abs(aNum(t)) > LIMITES_S.valorMax) celdas[k] = "Número demasiado grande";
  };
  const cuenta = new Map<string, number>();
  e.variables.forEach((v) => cuenta.set(v.trim(), (cuenta.get(v.trim()) ?? 0) + 1));
  e.variables.forEach((v, j) => {
    const t = v.trim();
    if (!t) celdas[`v.${j}`] = "Obligatorio";
    else if (t.length > LIMITES_S.nombre) celdas[`v.${j}`] = `Máximo ${LIMITES_S.nombre} caracteres`;
    else if ((cuenta.get(t) ?? 0) > 1) celdas[`v.${j}`] = "Nombre repetido";
  });
  e.c.forEach((t, j) => num(`c.${j}`, t));
  e.restricciones.forEach((r, i) => {
    r.a.forEach((t, j) => num(`a.${i}.${j}`, t));
    num(`b.${i}`, r.b);
  });
  return { celdas, globales: [] };
}

export const hayErroresS = (er: ErroresS) => Object.keys(er.celdas).length > 0;

export const aProblemaS = (e: EstadoS): ProblemaS => ({
  objetivo: e.objetivo,
  variables: e.variables.map((v) => v.trim()),
  c: e.c.map(aNum),
  restricciones: e.restricciones.map((r) => ({ a: r.a.map(aNum), signo: r.signo, b: aNum(r.b) })),
});

export function agregarVariable(e: EstadoS): EstadoS {
  const n = e.variables.length;
  return {
    ...e,
    variables: [...e.variables, `x${n + 1}`],
    c: [...e.c, ""],
    restricciones: e.restricciones.map((r) => ({ ...r, a: [...r.a, ""] })),
  };
}
export function quitarVariable(e: EstadoS, j: number): EstadoS {
  return {
    ...e,
    variables: e.variables.filter((_, k) => k !== j),
    c: e.c.filter((_, k) => k !== j),
    restricciones: e.restricciones.map((r) => ({ ...r, a: r.a.filter((_, k) => k !== j) })),
  };
}
export const agregarRestriccion = (e: EstadoS): EstadoS => ({
  ...e,
  restricciones: [...e.restricciones, { a: e.variables.map(() => ""), signo: "<=", b: "" }],
});
export const quitarRestriccion = (e: EstadoS, i: number): EstadoS => ({ ...e, restricciones: e.restricciones.filter((_, k) => k !== i) });

export const formatear = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 3 });
