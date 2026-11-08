import { pedir } from "./api";
import { OBLIGATORIO } from "./formulario";

export type Objetivo = "minimizar" | "maximizar";

export type ProblemaA = {
  agentes: string[];
  tareas: string[];
  costos: (number | null)[][];
  objetivo: Objetivo;
};

export type SolucionA = {
  estado: string;
  objetivo: Objetivo;
  costo_total: number;
  equilibrado: boolean;
  asignaciones: { agente: string; tarea: string; costo: number }[];
  agentes_sin_tarea: string[];
  tareas_sin_agente: string[];
};

export type CasoA = {
  id: number;
  tipo: string;
  nombre: string;
  datos: ProblemaA;
  resultado: SolucionA | null;
  costo_total: number | null;
  creado: string;
  actualizado: string;
};

export const LIMITES_A = { agentes: 50, tareas: 50, nombre: 60, valorMax: 1e12 } as const;

export type EstadoA = {
  agentes: string[];
  tareas: string[];
  costos: string[][]; // filas: agentes; vacío = asignación prohibida
  objetivo: Objetivo;
};
export type ErroresA = { celdas: Record<string, string>; globales: string[] };

/* ---------- API ---------- */

export const resolverA = (d: ProblemaA) =>
  pedir<SolucionA>("/problemas/asignacion/resolver", { method: "POST", body: JSON.stringify(d) });
export const crearCasoA = (nombre: string, datos: ProblemaA) =>
  pedir<CasoA>("/casos", { method: "POST", body: JSON.stringify({ tipo: "asignacion", nombre, datos }) }, true);
export const actualizarCasoA = (id: number, cambios: { nombre?: string; datos?: ProblemaA }) =>
  pedir<CasoA>(`/casos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }, true);
export const obtenerCasoA = (id: number) => pedir<CasoA>(`/casos/${id}`, {}, true);

/* ---------- Casos de partida ---------- */

// Machineco (Winston): tiempos de preparación; valor mínimo conocido 15
const EJEMPLO_A: ProblemaA = {
  agentes: ["Máquina 1", "Máquina 2", "Máquina 3", "Máquina 4"],
  tareas: ["Trabajo 1", "Trabajo 2", "Trabajo 3", "Trabajo 4"],
  costos: [
    [14, 5, 8, 7],
    [2, 12, 6, 5],
    [7, 8, 3, 9],
    [2, 4, 6, 10],
  ],
  objetivo: "minimizar",
};

export function desdeProblemaA(p: ProblemaA): EstadoA {
  return {
    agentes: [...p.agentes],
    tareas: [...p.tareas],
    costos: p.costos.map((f) => f.map((c) => (c === null ? "" : String(c)))),
    objetivo: p.objetivo,
  };
}

export const ejemploMachineco = () => desdeProblemaA(EJEMPLO_A);

export const casoVacioA = (): EstadoA => ({
  agentes: ["Agente 1", "Agente 2"],
  tareas: ["Tarea 1", "Tarea 2"],
  costos: [
    ["", ""],
    ["", ""],
  ],
  objetivo: "minimizar",
});

/* ---------- Validación ---------- */

function revisar(texto: string): { valor?: number; error?: string } {
  const t = texto.trim().replace(",", ".");
  if (t === "") return {}; // vacío = prohibida
  if (t.startsWith("-")) return { error: "No se permiten negativos" };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { error: "Debe ser un número" };
  const v = Number(t);
  if (v > LIMITES_A.valorMax) return { error: `Máximo ${LIMITES_A.valorMax.toLocaleString("es-CO")}` };
  return { valor: v };
}

export function validarA(e: EstadoA): ErroresA {
  const celdas: Record<string, string> = {};
  const globales: string[] = [];

  const nombres = (prefijo: string, lista: string[]) => {
    const cuenta = new Map<string, number>();
    lista.forEach((n) => cuenta.set(n.trim(), (cuenta.get(n.trim()) ?? 0) + 1));
    lista.forEach((n, i) => {
      const t = n.trim();
      if (!t) celdas[`${prefijo}.${i}.n`] = OBLIGATORIO;
      else if (t.length > LIMITES_A.nombre) celdas[`${prefijo}.${i}.n`] = `Máximo ${LIMITES_A.nombre} caracteres`;
      else if ((cuenta.get(t) ?? 0) > 1) celdas[`${prefijo}.${i}.n`] = "Nombre repetido";
    });
  };
  nombres("a", e.agentes);
  nombres("t", e.tareas);

  e.costos.forEach((f, i) =>
    f.forEach((t, j) => {
      const x = revisar(t);
      if (x.error) celdas[`c.${i}.${j}`] = x.error;
    }),
  );

  const A = e.agentes.length;
  const T = e.tareas.length;
  const vacio = (t: string) => t.trim() === "";
  if (A <= T) {
    e.costos.forEach((f, i) => {
      if (f.every(vacio)) {
        globales.push(`«${e.agentes[i].trim() || `agente ${i + 1}`}» no tiene ninguna tarea permitida: toda su fila está vacía. Pon un valor en al menos una (campos en rojo).`);
        f.forEach((_, j) => {
          celdas[`c.${i}.${j}`] ??= "Pon un valor en al menos una de estas casillas";
        });
      }
    });
  }
  if (T <= A) {
    e.tareas.forEach((n, j) => {
      if (e.costos.every((f) => vacio(f[j]))) {
        globales.push(`«${n.trim() || `tarea ${j + 1}`}» no puede ser hecha por nadie: toda su columna está vacía. Pon un valor en al menos una (campos en rojo).`);
        e.costos.forEach((_, i) => {
          celdas[`c.${i}.${j}`] ??= "Pon un valor en al menos una de estas casillas";
        });
      }
    });
  }
  return { celdas, globales };
}

export const hayErroresA = (er: ErroresA) => Object.keys(er.celdas).length > 0 || er.globales.length > 0;

const num = (t: string) => Number(t.trim().replace(",", "."));

export function aProblemaA(e: EstadoA): ProblemaA {
  return {
    agentes: e.agentes.map((n) => n.trim()),
    tareas: e.tareas.map((n) => n.trim()),
    costos: e.costos.map((f) => f.map((c) => (c.trim() === "" ? null : num(c)))),
    objetivo: e.objetivo,
  };
}

/* ---------- Agregar y quitar filas ---------- */

function nombreLibre(base: string, usados: string[]) {
  let i = usados.length + 1;
  while (usados.includes(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export function agregarAgente(e: EstadoA): EstadoA {
  if (e.agentes.length >= LIMITES_A.agentes) return e;
  const c = structuredClone(e);
  c.agentes.push(nombreLibre("Agente", c.agentes));
  c.costos.push(c.tareas.map(() => ""));
  return c;
}
export function quitarAgente(e: EstadoA, i: number): EstadoA {
  if (e.agentes.length <= 1) return e;
  const c = structuredClone(e);
  c.agentes.splice(i, 1);
  c.costos.splice(i, 1);
  return c;
}
export function agregarTarea(e: EstadoA): EstadoA {
  if (e.tareas.length >= LIMITES_A.tareas) return e;
  const c = structuredClone(e);
  c.tareas.push(nombreLibre("Tarea", c.tareas));
  c.costos.forEach((f) => f.push(""));
  return c;
}
export function quitarTarea(e: EstadoA, j: number): EstadoA {
  if (e.tareas.length <= 1) return e;
  const c = structuredClone(e);
  c.tareas.splice(j, 1);
  c.costos.forEach((f) => f.splice(j, 1));
  return c;
}
