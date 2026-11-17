import { pedir } from "./api";
import { OBLIGATORIO } from "./formulario";

export type TipoNodo = "origen" | "intermedio" | "destino";

export type ProblemaB = {
  nodos: { nombre: string; tipo: TipoNodo; cantidad: number | null }[];
  costos: (number | null)[][];
};

export type SolucionB = {
  estado: string;
  costo_total: number;
  oferta_total: number;
  demanda_total: number;
  balanceado: boolean;
  entregado_total?: number;
  faltante_total?: number;
  cubierta?: boolean;
  flujos: { desde: string; hasta: string; unidades: number; costo_unitario: number; costo: number }[];
  detalle_nodos: { nombre: string; tipo: TipoNodo; cantidad: number | null; entra: number; sale: number; faltante?: number }[];
};

export type CasoB = {
  id: number;
  tipo: string;
  nombre: string;
  datos: ProblemaB;
  resultado: SolucionB | null;
  costo_total: number | null;
  creado: string;
  actualizado: string;
};

export const LIMITES_B = { nodos: 30, nombre: 60, valorMax: 1e12 } as const;
export const ETIQUETA_TIPO: Record<TipoNodo, string> = { origen: "Origen", intermedio: "Intermedio", destino: "Destino" };

export type EstadoB = {
  nodos: { nombre: string; tipo: TipoNodo; cantidad: string }[];
  costos: string[][]; // N×N; vacío = sin ruta; la diagonal se ignora
};
export type ErroresB = { celdas: Record<string, string>; globales: string[] };

/* ---------- API ---------- */

export const resolverB = (d: ProblemaB) =>
  pedir<SolucionB>("/problemas/transbordo/resolver", { method: "POST", body: JSON.stringify(d) });
export const crearCasoB = (nombre: string, datos: ProblemaB) =>
  pedir<CasoB>("/casos", { method: "POST", body: JSON.stringify({ tipo: "transbordo", nombre, datos }) }, true);
export const actualizarCasoB = (id: number, cambios: { nombre?: string; datos?: ProblemaB }) =>
  pedir<CasoB>(`/casos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }, true);
export const obtenerCasoB = (id: number) => pedir<CasoB>(`/casos/${id}`, {}, true);

/* ---------- Casos de partida ---------- */

const EJEMPLO_B: ProblemaB = {
  nodos: [
    { nombre: "Fábrica 1", tipo: "origen", cantidad: 150 },
    { nombre: "Fábrica 2", tipo: "origen", cantidad: 200 },
    { nombre: "Bodega A", tipo: "intermedio", cantidad: null },
    { nombre: "Bodega B", tipo: "intermedio", cantidad: null },
    { nombre: "Cliente 1", tipo: "destino", cantidad: 130 },
    { nombre: "Cliente 2", tipo: "destino", cantidad: 130 },
    { nombre: "Cliente 3", tipo: "destino", cantidad: 90 },
  ],
  costos: [],
};

export function desdeProblemaB(p: ProblemaB): EstadoB {
  return {
    nodos: p.nodos.map((n) => ({ nombre: n.nombre, tipo: n.tipo, cantidad: n.cantidad === null ? "" : String(n.cantidad) })),
    costos: p.costos.map((f) => f.map((c) => (c === null ? "" : String(c)))),
  };
}

// Matriz del ejemplo (la misma que el servidor): costo óptimo 5800
export function ejemploRed(): EstadoB {
  const n = EJEMPLO_B.nodos.length;
  const costos = Array.from({ length: n }, () => Array<string>(n).fill(""));
  const puesta: [number, number, number][] = [
    [0, 2, 8], [0, 3, 15], [1, 2, 15], [1, 3, 12],
    [2, 4, 6], [2, 5, 10], [2, 6, 7],
    [3, 4, 12], [3, 5, 5], [3, 6, 9],
    [0, 6, 30],
  ];
  for (const [i, j, c] of puesta) costos[i][j] = String(c);
  return desdeProblemaB({ ...EJEMPLO_B, costos: costos.map((f) => f.map((c) => (c === "" ? null : Number(c)))) });
}

/* Good Tire como red de transbordo: Akron → almacenes que abre la solución óptima → clientes.
   Costos de la Tabla 9.23 y 9.24 ($ por llanta); cantidades en llantas (los datos del caso están en miles). */
const GT_ALMACENES = [
  { nombre: "Cleveland", capacidad: 80000, desdeAkron: 0.25, aClientes: [0.25, 1.25, 0.75, 1.63, 1.75, 1.0, 0.63, 2.13, 2.63, 3.25] },
  { nombre: "Chicago", capacidad: 60000, desdeAkron: 0.75, aClientes: [1.75, 1.5, 1.38, 1.0, 0.25, 2.75, 2.38, 3.88, 2.38, 5.0] },
  { nombre: "Trenton", capacidad: 60000, desdeAkron: 0.75, aClientes: [2.13, 2.75, 2.38, 3.5, 3.88, 1.88, 1.75, 0.5, 4.25, 1.25] },
  { nombre: "Louisville", capacidad: 60000, desdeAkron: 0.75, aClientes: [1.75, 0.5, 1.0, 0.5, 1.5, 2.75, 2.0, 3.5, 0.88, 4.88] },
];
const GT_CLIENTES = [
  ["Cleveland", 30000], ["Cincinnati", 20000], ["Dayton", 18000], ["Indianápolis", 16000], ["Chicago", 38000],
  ["Búfalo", 22000], ["Pittsburgh", 27000], ["Filadelfia", 32000], ["Nashville", 19000], ["Boston", 26000],
] as const;

export function ejemploGoodTire(): EstadoB {
  const nodos: EstadoB["nodos"] = [
    { nombre: "Akron", tipo: "origen", cantidad: String(GT_CLIENTES.reduce((s, c) => s + c[1], 0)) },
    ...GT_ALMACENES.map((a) => ({ nombre: `Almacén ${a.nombre}`, tipo: "intermedio" as const, cantidad: String(a.capacidad) })),
    ...GT_CLIENTES.map((c) => ({ nombre: `Cliente ${c[0]}`, tipo: "destino" as const, cantidad: String(c[1]) })),
  ];
  const n = nodos.length;
  const costos = Array.from({ length: n }, () => Array<string>(n).fill(""));
  GT_ALMACENES.forEach((a, k) => {
    costos[0][1 + k] = String(a.desdeAkron);
    a.aClientes.forEach((c, j) => (costos[1 + k][1 + GT_ALMACENES.length + j] = String(c)));
  });
  return { nodos, costos };
}

export const casoVacioB = (): EstadoB => ({
  nodos: [
    { nombre: "Origen 1", tipo: "origen", cantidad: "" },
    { nombre: "Intermedio 1", tipo: "intermedio", cantidad: "" },
    { nombre: "Destino 1", tipo: "destino", cantidad: "" },
  ],
  costos: [
    ["", "", ""],
    ["", "", ""],
    ["", "", ""],
  ],
});

/* ---------- Validación ---------- */

function revisar(texto: string, opcional = false): { valor?: number; error?: string } {
  const t = texto.trim().replace(",", ".");
  if (t === "") return opcional ? {} : { error: OBLIGATORIO };
  if (t.startsWith("-")) return { error: "No se permiten negativos" };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { error: "Debe ser un número" };
  const v = Number(t);
  if (v > LIMITES_B.valorMax) return { error: `Máximo ${LIMITES_B.valorMax.toLocaleString("es-CO")}` };
  return { valor: v };
}

export function validarB(e: EstadoB): ErroresB {
  const celdas: Record<string, string> = {};
  const globales: string[] = [];

  const cuenta = new Map<string, number>();
  e.nodos.forEach((n) => cuenta.set(n.nombre.trim(), (cuenta.get(n.nombre.trim()) ?? 0) + 1));
  e.nodos.forEach((n, i) => {
    const t = n.nombre.trim();
    if (!t) celdas[`n.${i}.n`] = OBLIGATORIO;
    else if (t.length > LIMITES_B.nombre) celdas[`n.${i}.n`] = `Máximo ${LIMITES_B.nombre} caracteres`;
    else if ((cuenta.get(t) ?? 0) > 1) celdas[`n.${i}.n`] = "Nombre repetido";
  });

  const cant = e.nodos.map((n, i) => {
    const x = revisar(n.cantidad, n.tipo === "intermedio");
    if (x.error) celdas[`n.${i}.q`] = x.error;
    return x.valor;
  });
  e.costos.forEach((f, i) =>
    f.forEach((t, j) => {
      if (i === j) return;
      const x = revisar(t, true);
      if (x.error) celdas[`c.${i}.${j}`] = x.error;
    }),
  );

  if (!e.nodos.some((n) => n.tipo === "origen")) globales.push("Agrega al menos un origen.");
  if (!e.nodos.some((n) => n.tipo === "destino")) globales.push("Agrega al menos un destino.");

  const ok = e.nodos.every((n, i) => n.tipo === "intermedio" || cant[i] !== undefined);
  if (ok) {
    e.nodos.forEach((n, j) => {
      if (n.tipo !== "destino" || !((cant[j] ?? 0) > 0)) return;
      const llega = e.costos.some((f, i) => i !== j && f[j].trim() !== "");
      if (!llega) {
        globales.push(`Ninguna ruta llega a «${n.nombre.trim() || `nodo ${j + 1}`}»: toda su columna está vacía. Pon un costo en al menos una (campos en rojo).`);
        e.costos.forEach((_, i) => {
          if (i !== j) celdas[`c.${i}.${j}`] ??= "Pon un costo en al menos una de estas rutas";
        });
      }
    });
  }
  return { celdas, globales };
}

export function totalesB(e: EstadoB): { oferta: number; demanda: number } | null {
  let oferta = 0;
  let demanda = 0;
  for (const n of e.nodos) {
    if (n.tipo === "intermedio") continue;
    const v = revisar(n.cantidad).valor;
    if (v === undefined) return null;
    if (n.tipo === "origen") oferta += v;
    else demanda += v;
  }
  return { oferta, demanda };
}

export const hayErroresB = (er: ErroresB) => Object.keys(er.celdas).length > 0 || er.globales.length > 0;

const num = (t: string) => Number(t.trim().replace(",", "."));

export function aProblemaB(e: EstadoB): ProblemaB {
  return {
    nodos: e.nodos.map((n) => ({
      nombre: n.nombre.trim(),
      tipo: n.tipo,
      cantidad: n.cantidad.trim() === "" ? null : num(n.cantidad),
    })),
    costos: e.costos.map((f, i) => f.map((c, j) => (i === j || c.trim() === "" ? null : num(c)))),
  };
}

/* ---------- Agregar y quitar nodos ---------- */

export function agregarNodo(e: EstadoB, tipo: TipoNodo): EstadoB {
  if (e.nodos.length >= LIMITES_B.nodos) return e;
  const c = structuredClone(e);
  const usados = c.nodos.map((n) => n.nombre);
  let k = c.nodos.filter((n) => n.tipo === tipo).length + 1;
  while (usados.includes(`${ETIQUETA_TIPO[tipo]} ${k}`)) k++;
  c.nodos.push({ nombre: `${ETIQUETA_TIPO[tipo]} ${k}`, tipo, cantidad: "" });
  c.costos.forEach((f) => f.push(""));
  c.costos.push(c.nodos.map(() => ""));
  return c;
}

export function quitarNodo(e: EstadoB, i: number): EstadoB {
  if (e.nodos.length <= 2) return e;
  const c = structuredClone(e);
  c.nodos.splice(i, 1);
  c.costos.splice(i, 1);
  c.costos.forEach((f) => f.splice(i, 1));
  return c;
}
