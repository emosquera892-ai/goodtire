import { pedir } from "./api";
import { OBLIGATORIO } from "./formulario";

export type ProblemaT = {
  origenes: string[];
  destinos: string[];
  oferta: number[];
  demanda: number[];
  costos: (number | null)[][];
};

export type SolucionT = {
  estado: string;
  costo_total: number;
  oferta_total: number;
  demanda_total: number;
  balanceado: boolean;
  entregado_total?: number;
  faltante_total?: number;
  cubierta?: boolean;
  envios: { origen: string; destino: string; unidades: number; costo_unitario: number; costo: number }[];
  detalle_origenes: { origen: string; oferta: number; uso: number; sobrante: number }[];
  detalle_destinos: { destino: string; demanda: number; recibido: number; faltante?: number }[];
};

export type CasoT = {
  id: number;
  tipo: string;
  nombre: string;
  datos: ProblemaT;
  resultado: SolucionT | null;
  costo_total: number | null;
  creado: string;
  actualizado: string;
};

export const LIMITES_T = { origenes: 50, destinos: 50, nombre: 60, valorMax: 1e12 } as const;

export type EstadoT = {
  origenes: { nombre: string; oferta: string }[];
  destinos: { nombre: string; demanda: string }[];
  costos: string[][]; // filas: origenes; vacío = ruta no disponible
};
export type ErroresT = { celdas: Record<string, string>; globales: string[] };

/* ---------- API ---------- */

export const resolverT = (d: ProblemaT) =>
  pedir<SolucionT>("/problemas/transporte/resolver", { method: "POST", body: JSON.stringify(d) });
export const crearCasoT = (nombre: string, datos: ProblemaT) =>
  pedir<CasoT>("/casos", { method: "POST", body: JSON.stringify({ tipo: "transporte", nombre, datos }) }, true);
export const actualizarCasoT = (id: number, cambios: { nombre?: string; datos?: ProblemaT }) =>
  pedir<CasoT>(`/casos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }, true);
export const obtenerCasoT = (id: number) => pedir<CasoT>(`/casos/${id}`, {}, true);

export const moneda = (n: number) => "$" + n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

/* ---------- Casos de partida ---------- */

// Powerco (Winston): costo mínimo conocido 1020
const EJEMPLO_T: ProblemaT = {
  origenes: ["Planta 1", "Planta 2", "Planta 3"],
  destinos: ["Ciudad 1", "Ciudad 2", "Ciudad 3", "Ciudad 4"],
  oferta: [35, 50, 40],
  demanda: [45, 20, 30, 30],
  costos: [
    [8, 6, 10, 9],
    [9, 12, 13, 7],
    [14, 9, 16, 5],
  ],
};

export function desdeProblemaT(p: ProblemaT): EstadoT {
  return {
    origenes: p.origenes.map((nombre, i) => ({ nombre, oferta: String(p.oferta[i]) })),
    destinos: p.destinos.map((nombre, j) => ({ nombre, demanda: String(p.demanda[j]) })),
    costos: p.costos.map((f) => f.map((c) => (c === null ? "" : String(c)))),
  };
}

export const ejemploPowerco = () => desdeProblemaT(EJEMPLO_T);

export const casoVacioT = (): EstadoT => ({
  origenes: [
    { nombre: "Origen 1", oferta: "" },
    { nombre: "Origen 2", oferta: "" },
  ],
  destinos: [
    { nombre: "Destino 1", demanda: "" },
    { nombre: "Destino 2", demanda: "" },
  ],
  costos: [
    ["", ""],
    ["", ""],
  ],
});

/* ---------- Validación ---------- */

function revisar(texto: string, opcional = false): { valor?: number; error?: string } {
  const t = texto.trim().replace(",", ".");
  if (t === "") return opcional ? {} : { error: OBLIGATORIO };
  if (t.startsWith("-")) return { error: "No se permiten negativos" };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { error: "Debe ser un número" };
  const v = Number(t);
  if (v > LIMITES_T.valorMax) return { error: `Máximo ${LIMITES_T.valorMax.toLocaleString("es-CO")}` };
  return { valor: v };
}

export function validarT(e: EstadoT): ErroresT {
  const celdas: Record<string, string> = {};
  const globales: string[] = [];

  const nombres = (prefijo: string, lista: string[]) => {
    const cuenta = new Map<string, number>();
    lista.forEach((n) => cuenta.set(n.trim(), (cuenta.get(n.trim()) ?? 0) + 1));
    lista.forEach((n, i) => {
      const t = n.trim();
      if (!t) celdas[`${prefijo}.${i}.n`] = OBLIGATORIO;
      else if (t.length > LIMITES_T.nombre) celdas[`${prefijo}.${i}.n`] = `Máximo ${LIMITES_T.nombre} caracteres`;
      else if ((cuenta.get(t) ?? 0) > 1) celdas[`${prefijo}.${i}.n`] = "Nombre repetido";
    });
  };
  nombres("o", e.origenes.map((o) => o.nombre));
  nombres("d", e.destinos.map((d) => d.nombre));

  const oferta = e.origenes.map((o, i) => {
    const x = revisar(o.oferta);
    if (x.error) celdas[`o.${i}.of`] = x.error;
    return x.valor;
  });
  const demanda = e.destinos.map((d, j) => {
    const x = revisar(d.demanda);
    if (x.error) celdas[`d.${j}.dem`] = x.error;
    return x.valor;
  });
  e.costos.forEach((f, i) =>
    f.forEach((t, j) => {
      const x = revisar(t, true);
      if (x.error) celdas[`c.${i}.${j}`] = x.error;
    }),
  );

  if (oferta.every((x) => x !== undefined) && demanda.every((x) => x !== undefined)) {
    e.destinos.forEach((d, j) => {
      if ((demanda[j] as number) > 0 && e.costos.every((f) => f[j].trim() === "")) {
        globales.push(
          `Ningún origen puede abastecer a «${d.nombre.trim() || `destino ${j + 1}`}»: todas sus rutas están vacías. Pon un costo en al menos una (campos en rojo).`,
        );
        e.costos.forEach((_, i) => {
          celdas[`c.${i}.${j}`] ??= "Pon un costo en al menos una de estas rutas";
        });
      }
    });
  }
  return { celdas, globales };
}

export function totalesT(e: EstadoT): { oferta: number; demanda: number } | null {
  const of = e.origenes.map((o) => revisar(o.oferta).valor);
  const de = e.destinos.map((d) => revisar(d.demanda).valor);
  if (of.some((x) => x === undefined) || de.some((x) => x === undefined)) return null;
  return {
    oferta: (of as number[]).reduce((s, x) => s + x, 0),
    demanda: (de as number[]).reduce((s, x) => s + x, 0),
  };
}

export const hayErroresT = (er: ErroresT) => Object.keys(er.celdas).length > 0 || er.globales.length > 0;

const num = (t: string) => Number(t.trim().replace(",", "."));

export function aProblemaT(e: EstadoT): ProblemaT {
  return {
    origenes: e.origenes.map((o) => o.nombre.trim()),
    destinos: e.destinos.map((d) => d.nombre.trim()),
    oferta: e.origenes.map((o) => num(o.oferta)),
    demanda: e.destinos.map((d) => num(d.demanda)),
    costos: e.costos.map((f) => f.map((c) => (c.trim() === "" ? null : num(c)))),
  };
}

/* ---------- Agregar y quitar filas ---------- */

function nombreLibre(base: string, usados: string[]) {
  let i = usados.length + 1;
  while (usados.includes(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export function agregarOrigen(e: EstadoT): EstadoT {
  if (e.origenes.length >= LIMITES_T.origenes) return e;
  const c = structuredClone(e);
  c.origenes.push({ nombre: nombreLibre("Origen", c.origenes.map((o) => o.nombre)), oferta: "" });
  c.costos.push(c.destinos.map(() => ""));
  return c;
}
export function quitarOrigen(e: EstadoT, i: number): EstadoT {
  if (e.origenes.length <= 1) return e;
  const c = structuredClone(e);
  c.origenes.splice(i, 1);
  c.costos.splice(i, 1);
  return c;
}
export function agregarDestino(e: EstadoT): EstadoT {
  if (e.destinos.length >= LIMITES_T.destinos) return e;
  const c = structuredClone(e);
  c.destinos.push({ nombre: nombreLibre("Destino", c.destinos.map((d) => d.nombre)), demanda: "" });
  c.costos.forEach((f) => f.push(""));
  return c;
}
export function quitarDestino(e: EstadoT, j: number): EstadoT {
  if (e.destinos.length <= 1) return e;
  const c = structuredClone(e);
  c.destinos.splice(j, 1);
  c.costos.forEach((f) => f.splice(j, 1));
  return c;
}
