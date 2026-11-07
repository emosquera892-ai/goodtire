import type { Problema } from "./api";

export const LIMITES = { plantas: 30, almacenes: 20, clientes: 100, nombre: 60, valorMax: 1e12, factorMax: 1e9 } as const;
export const OBLIGATORIO = "Obligatorio";

export type Modo = "libre" | "abierto" | "cerrado";

export type Estado = {
  plantas: { nombre: string; capacidad: string }[];
  almacenes: { nombre: string; capacidad: string; fijo: string; modo: Modo }[];
  clientes: { nombre: string; demanda: string }[];
  cpa: string[][]; // costo planta -> almacén (filas: plantas)
  cac: string[][]; // costo almacén -> cliente (filas: almacenes)
  factor: string;
  min: string;
  max: string;
};

export type Errores = { celdas: Record<string, string>; globales: string[] };

/* ---------- Casos de partida ---------- */

const EJEMPLO: Problema = {
  plantas: ["Akron"],
  almacenes: ["Cleveland", "Harrisburg", "Chicago", "Trenton", "Louisville"],
  clientes: ["Cleveland", "Cincinnati", "Dayton", "Indianápolis", "Chicago", "Búfalo", "Pittsburgh", "Filadelfia", "Nashville", "Boston"],
  capacidad_plantas: [null],
  capacidad_almacenes: [80, 60, 60, 60, 60],
  costo_fijo: [40000, 20000, 30000, 25000, 20000],
  demanda: [30, 20, 18, 16, 38, 22, 27, 32, 19, 26],
  costo_planta_almacen: [[0.25, 0.5, 0.75, 0.75, 0.75]],
  costo_almacen_cliente: [
    [0.25, 1.25, 0.75, 1.63, 1.75, 1.0, 0.63, 2.13, 2.63, 3.25],
    [0.63, 1.5, 1.38, 1.75, 2.38, 1.13, 0.88, 0.63, 2.88, 2.75],
    [1.75, 1.5, 1.38, 1.0, 0.25, 2.75, 2.38, 3.88, 2.38, 5.0],
    [2.13, 2.75, 2.38, 3.5, 3.88, 1.88, 1.75, 0.5, 4.25, 1.25],
    [1.75, 0.5, 1.0, 0.5, 1.5, 2.75, 2.0, 3.5, 0.88, 4.88],
  ],
  factor_unidades: 1000,
  min_almacenes: 0,
  max_almacenes: null,
  forzar_abiertos: [],
  forzar_cerrados: [],
};

export function desdeProblema(p: Problema): Estado {
  const s = (n: number) => String(n);
  return {
    plantas: p.plantas.map((nombre, i) => ({
      nombre,
      capacidad: p.capacidad_plantas[i] == null ? "" : s(p.capacidad_plantas[i] as number),
    })),
    almacenes: p.almacenes.map((nombre, i) => ({
      nombre,
      capacidad: s(p.capacidad_almacenes[i]),
      fijo: s(p.costo_fijo[i]),
      modo: p.forzar_abiertos.includes(nombre) ? "abierto" : p.forzar_cerrados.includes(nombre) ? "cerrado" : "libre",
    })),
    clientes: p.clientes.map((nombre, i) => ({ nombre, demanda: s(p.demanda[i]) })),
    cpa: p.costo_planta_almacen.map((f) => f.map(s)),
    cac: p.costo_almacen_cliente.map((f) => f.map(s)),
    factor: s(p.factor_unidades),
    min: s(p.min_almacenes),
    max: p.max_almacenes == null ? "" : s(p.max_almacenes),
  };
}

export const ejemploGoodTire = (): Estado => desdeProblema(EJEMPLO);

export function casoVacio(): Estado {
  return {
    plantas: [{ nombre: "Planta 1", capacidad: "" }],
    almacenes: [
      { nombre: "Almacén 1", capacidad: "", fijo: "", modo: "libre" },
      { nombre: "Almacén 2", capacidad: "", fijo: "", modo: "libre" },
    ],
    clientes: [
      { nombre: "Cliente 1", demanda: "" },
      { nombre: "Cliente 2", demanda: "" },
    ],
    cpa: [["", ""]],
    cac: [
      ["", ""],
      ["", ""],
    ],
    factor: "1",
    min: "0",
    max: "",
  };
}

/* ---------- Validación (misma lógica que el servidor) ---------- */

type Reglas = { opcional?: boolean; positivo?: boolean; entero?: boolean; tope?: number };

function revisar(texto: string, r: Reglas = {}): { valor?: number; error?: string } {
  const t = texto.trim().replace(",", ".");
  if (t === "") return r.opcional ? {} : { error: OBLIGATORIO };
  if (t.startsWith("-")) return { error: "No se permiten negativos" };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return { error: "Debe ser un número" };
  const v = Number(t);
  if (r.entero && !Number.isInteger(v)) return { error: "Debe ser un entero" };
  if (r.positivo && v <= 0) return { error: "Debe ser mayor que 0" };
  if (r.tope !== undefined && v > r.tope) return { error: `Máximo ${r.tope.toLocaleString("es-CO")}` };
  return { valor: v };
}

const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const todos = <T>(a: (T | undefined)[]): a is T[] => a.every((x) => x !== undefined);

export function validar(e: Estado): Errores {
  const celdas: Record<string, string> = {};
  const globales: string[] = [];

  const num = (clave: string, texto: string, r?: Reglas) => {
    const x = revisar(texto, r);
    if (x.error) celdas[clave] = x.error;
    return x.valor;
  };

  const nombres = (prefijo: string, lista: string[]) => {
    const cuenta = new Map<string, number>();
    lista.forEach((n) => cuenta.set(n.trim(), (cuenta.get(n.trim()) ?? 0) + 1));
    lista.forEach((n, i) => {
      const t = n.trim();
      if (!t) celdas[`${prefijo}.${i}.n`] = OBLIGATORIO;
      else if (t.length > LIMITES.nombre) celdas[`${prefijo}.${i}.n`] = `Máximo ${LIMITES.nombre} caracteres`;
      else if ((cuenta.get(t) ?? 0) > 1) celdas[`${prefijo}.${i}.n`] = "Nombre repetido";
    });
  };
  nombres("p", e.plantas.map((p) => p.nombre));
  nombres("a", e.almacenes.map((a) => a.nombre));
  nombres("c", e.clientes.map((c) => c.nombre));

  const tope = LIMITES.valorMax;
  const capP = e.plantas.map((p, i) =>
    p.capacidad.trim() === "" ? null : num(`p.${i}.cap`, p.capacidad, { tope }),
  );
  const capA = e.almacenes.map((a, i) => num(`a.${i}.cap`, a.capacidad, { tope }));
  e.almacenes.forEach((a, i) => num(`a.${i}.fijo`, a.fijo, { tope }));
  const dem = e.clientes.map((c, i) => num(`c.${i}.dem`, c.demanda, { tope }));
  e.cpa.forEach((f, i) => f.forEach((t, j) => num(`cpa.${i}.${j}`, t, { tope })));
  e.cac.forEach((f, i) => f.forEach((t, j) => num(`cac.${i}.${j}`, t, { tope })));
  num("factor", e.factor, { positivo: true, tope: LIMITES.factorMax });
  const minV = e.min.trim() === "" ? 0 : num("min", e.min, { entero: true, tope: LIMITES.almacenes });
  const maxV = e.max.trim() === "" ? undefined : num("max", e.max, { entero: true, positivo: true });

  const W = e.almacenes.length;
  const abiertos = e.almacenes.filter((a) => a.modo === "abierto").length;
  const cerrados = e.almacenes.filter((a) => a.modo === "cerrado").length;

  if (todos(dem)) {
    const total = dem.reduce((s, x) => s + x, 0);
    if (todos(capA)) {
      const disponible = e.almacenes.reduce((s, a, i) => (a.modo === "cerrado" ? s : s + capA[i]), 0);
      if (disponible < total) {
        globales.push(
          `La capacidad de los almacenes disponibles (${fmt(disponible)}) es menor que la demanda total (${fmt(total)}).`,
        );
      }
    }
    const finitas = capP.filter((c): c is number => c !== null && c !== undefined);
    if (capP.every((c) => c !== undefined) && finitas.length === capP.length) {
      const sumaPlantas = finitas.reduce((s, x) => s + x, 0);
      if (sumaPlantas < total) {
        globales.push(`La capacidad total de las plantas (${fmt(sumaPlantas)}) es menor que la demanda total (${fmt(total)}).`);
      }
    }
  }

  if (maxV !== undefined) {
    if (maxV > W) celdas.max = `No puede superar el número de almacenes (${W})`;
    else if (minV !== undefined && minV > maxV) celdas.min = "El mínimo no puede superar al máximo";
    if (abiertos > maxV) globales.push(`Marcaste ${abiertos} almacenes como «Abierto», pero el máximo es ${maxV}.`);
  }
  if (minV !== undefined && minV > W - cerrados) {
    globales.push(`El mínimo (${minV}) supera los almacenes disponibles (${W - cerrados}).`);
  }

  return { celdas, globales };
}

export const hayErrores = (er: Errores) => Object.keys(er.celdas).length > 0 || er.globales.length > 0;

/* ---------- Conversión al formato del servidor ---------- */

const aNumero = (t: string) => Number(t.trim().replace(",", "."));

export function aProblema(e: Estado): Problema {
  return {
    plantas: e.plantas.map((p) => p.nombre.trim()),
    almacenes: e.almacenes.map((a) => a.nombre.trim()),
    clientes: e.clientes.map((c) => c.nombre.trim()),
    capacidad_plantas: e.plantas.map((p) => (p.capacidad.trim() === "" ? null : aNumero(p.capacidad))),
    capacidad_almacenes: e.almacenes.map((a) => aNumero(a.capacidad)),
    costo_fijo: e.almacenes.map((a) => aNumero(a.fijo)),
    demanda: e.clientes.map((c) => aNumero(c.demanda)),
    costo_planta_almacen: e.cpa.map((f) => f.map((t) => aNumero(t))),
    costo_almacen_cliente: e.cac.map((f) => f.map((t) => aNumero(t))),
    factor_unidades: aNumero(e.factor),
    min_almacenes: e.min.trim() === "" ? 0 : aNumero(e.min),
    max_almacenes: e.max.trim() === "" ? null : aNumero(e.max),
    forzar_abiertos: e.almacenes.filter((a) => a.modo === "abierto").map((a) => a.nombre.trim()),
    forzar_cerrados: e.almacenes.filter((a) => a.modo === "cerrado").map((a) => a.nombre.trim()),
  };
}

/* ---------- Agregar y quitar filas ---------- */

function nombreLibre(base: string, usados: string[]) {
  let i = usados.length + 1;
  while (usados.includes(`${base} ${i}`)) i++;
  return `${base} ${i}`;
}

export function agregarPlanta(e: Estado): Estado {
  if (e.plantas.length >= LIMITES.plantas) return e;
  const c = structuredClone(e);
  c.plantas.push({ nombre: nombreLibre("Planta", c.plantas.map((p) => p.nombre)), capacidad: "" });
  c.cpa.push(c.almacenes.map(() => ""));
  return c;
}

export function quitarPlanta(e: Estado, i: number): Estado {
  if (e.plantas.length <= 1) return e;
  const c = structuredClone(e);
  c.plantas.splice(i, 1);
  c.cpa.splice(i, 1);
  return c;
}

export function agregarAlmacen(e: Estado): Estado {
  if (e.almacenes.length >= LIMITES.almacenes) return e;
  const c = structuredClone(e);
  c.almacenes.push({ nombre: nombreLibre("Almacén", c.almacenes.map((a) => a.nombre)), capacidad: "", fijo: "", modo: "libre" });
  c.cpa.forEach((f) => f.push(""));
  c.cac.push(c.clientes.map(() => ""));
  return c;
}

export function quitarAlmacen(e: Estado, i: number): Estado {
  if (e.almacenes.length <= 1) return e;
  const c = structuredClone(e);
  c.almacenes.splice(i, 1);
  c.cpa.forEach((f) => f.splice(i, 1));
  c.cac.splice(i, 1);
  return c;
}

export function agregarCliente(e: Estado): Estado {
  if (e.clientes.length >= LIMITES.clientes) return e;
  const c = structuredClone(e);
  c.clientes.push({ nombre: nombreLibre("Cliente", c.clientes.map((x) => x.nombre)), demanda: "" });
  c.cac.forEach((f) => f.push(""));
  return c;
}

export function quitarCliente(e: Estado, i: number): Estado {
  if (e.clientes.length <= 1) return e;
  const c = structuredClone(e);
  c.clientes.splice(i, 1);
  c.cac.forEach((f) => f.splice(i, 1));
  return c;
}

/** Pega celdas copiadas de Excel (separadas por tabulaciones y saltos de línea). */
export function pegar(m: string[][], fila: number, col: number, texto: string): string[][] {
  const copia = m.map((f) => [...f]);
  const filas = texto.replace(/\r/g, "").split("\n");
  if (filas.length > 1 && filas[filas.length - 1] === "") filas.pop();
  filas.forEach((linea, di) =>
    linea.split("\t").forEach((celda, dj) => {
      if (copia[fila + di] && copia[fila + di][col + dj] !== undefined) copia[fila + di][col + dj] = celda.trim();
    }),
  );
  return copia;
}
