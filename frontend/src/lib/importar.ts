/* Importar datos desde Excel (.xlsx) o CSV. Todo ocurre en el navegador: el archivo no se sube a ningún servidor. */
import type { Estado, Modo } from "./formulario";
import { LIMITES } from "./formulario";
import type { EstadoA, Objetivo } from "./asignacion";
import { LIMITES_A } from "./asignacion";
import type { EstadoB, TipoNodo } from "./transbordo";
import { LIMITES_B } from "./transbordo";
import type { EstadoT } from "./transporte";
import { LIMITES_T } from "./transporte";
import { descargarExcel, type Hoja } from "./exportar";

export type Tabla = string[][];
export type Secciones = Map<string, Tabla>;
export type Seccion = { nombre: string; filas: Tabla };

export class ErrorImportar extends Error {
  mensajes: string[];
  constructor(mensajes: string[]) {
    super(mensajes.join(" · "));
    this.mensajes = mensajes;
  }
}

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_FILAS = 1000;
const MAX_COLUMNAS = 120;

/* Nombre de sección sin tildes, mayúsculas ni signos: «Costo planta-almacén» → «costo planta almacen» */
export const clave = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ---------- Lectura de archivos ---------- */

function parsearCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  // El separador se decide con las primeras líneas (la primera suele ser solo un título de sección)
  const muestra = limpio.split(/\r?\n/).slice(0, 12).join("\n");
  const cuenta = (c: string) => muestra.split(c).length - 1;
  const sep = [";", "\t", ","].reduce((mejor, c) => (cuenta(c) > cuenta(mejor) ? c : mejor), ",");
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === sep) {
      fila.push(celda.trim());
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda.trim());
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) {
    fila.push(celda.trim());
    filas.push(fila);
  }
  return filas;
}

function recortar(t: Tabla): Tabla {
  const filas = t.slice(0, MAX_FILAS).map((f) => f.slice(0, MAX_COLUMNAS).map((c) => c.trim()));
  while (filas.length && filas[filas.length - 1].every((c) => c === "")) filas.pop();
  return filas;
}

/* CSV: las secciones se separan con una fila de título (p. ej. «Plantas») que tiene solo la primera celda llena. */
function seccionesDeCSV(filas: string[][], conocidas: Set<string>): Secciones {
  const out: Secciones = new Map();
  let actual: string | null = null;
  for (const f of filas) {
    const k = clave(f[0] ?? "");
    const soloTitulo = f.slice(1).every((c) => c === "");
    if (soloTitulo && conocidas.has(k)) {
      actual = k;
      out.set(k, []);
    } else if (actual) out.get(actual)!.push(f);
  }
  for (const [k, t] of out) out.set(k, recortar(t));
  return out;
}

type CeldaXlsx = { value: unknown };
function textoCelda(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (v instanceof Date) return v.toLocaleDateString("sv-SE");
  if (typeof v === "object") {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown };
    if (o.richText) return o.richText.map((r) => r.text).join("").trim();
    if (o.result !== undefined) return textoCelda(o.result);
    if (o.text !== undefined) return textoCelda(o.text);
  }
  return "";
}

export async function leerArchivo(archivo: File, conocidas: string[]): Promise<Secciones> {
  const nombre = archivo.name.toLowerCase();
  if (archivo.size > MAX_BYTES) throw new ErrorImportar(["El archivo pesa más de 2 MB. Usa solo las tablas del caso."]);
  if (nombre.endsWith(".xls")) {
    throw new ErrorImportar(["Los archivos .xls (Excel antiguo) no se pueden leer. Guárdalo como .xlsx o .csv e inténtalo de nuevo."]);
  }
  if (nombre.endsWith(".xlsx")) {
    let libro;
    try {
      const ExcelJS = (await import("exceljs")).default;
      libro = new ExcelJS.Workbook();
      await libro.xlsx.load(await archivo.arrayBuffer());
    } catch {
      throw new ErrorImportar(["No se pudo abrir el Excel. ¿Está dañado o protegido con contraseña?"]);
    }
    const out: Secciones = new Map();
    libro.eachSheet((ws) => {
      const filas: Tabla = [];
      ws.eachRow({ includeEmpty: true }, (fila, n) => {
        if (n > MAX_FILAS) return;
        const celdas: string[] = [];
        for (let j = 1; j <= Math.min(ws.columnCount, MAX_COLUMNAS); j++) celdas.push(textoCelda((fila.getCell(j) as unknown as CeldaXlsx).value));
        filas.push(celdas);
      });
      out.set(clave(ws.name), recortar(filas));
    });
    return out;
  }
  if (nombre.endsWith(".csv") || nombre.endsWith(".txt")) {
    const secciones = seccionesDeCSV(parsearCSV(await archivo.text()), new Set(conocidas.map(clave)));
    if (secciones.size === 0) {
      throw new ErrorImportar([
        `No encuentro las secciones. En un CSV cada tabla empieza con una fila de título (${conocidas.join(", ")}). Descarga la plantilla CSV para ver el formato.`,
      ]);
    }
    return secciones;
  }
  throw new ErrorImportar(["Formato no admitido. Usa un archivo .xlsx o .csv."]);
}

/* ---------- Interpretación de las tablas ---------- */

const exigir = (sec: Secciones, nombre: string): Tabla => {
  const t = sec.get(clave(nombre));
  if (!t || t.length === 0) throw new ErrorImportar([`Falta la hoja o sección «${nombre}» (o está vacía).`]);
  return t;
};

/* Lista: primera fila = encabezados; luego una fila por elemento, hasta la primera fila vacía. */
function lista(sec: Secciones, nombre: string, columnas: number, tope: number, que: string): string[][] {
  const t = exigir(sec, nombre);
  const filas: string[][] = [];
  for (let i = 1; i < t.length; i++) {
    const f = t[i];
    if (f.every((c) => c === "")) break;
    filas.push(Array.from({ length: columnas }, (_, j) => f[j] ?? ""));
  }
  if (filas.length === 0) throw new ErrorImportar([`«${nombre}»: no hay ningún dato debajo de los encabezados.`]);
  if (filas.length > tope) throw new ErrorImportar([`«${nombre}»: máximo ${tope} ${que} (hay ${filas.length}).`]);
  filas.forEach((f, i) => {
    if (f[0] === "") throw new ErrorImportar([`«${nombre}», fila ${i + 2}: falta el nombre.`]);
  });
  return filas;
}

/* Matriz: fila 1 = nombres de las columnas; columna A = nombres de las filas; el resto son los valores. */
function matriz(sec: Secciones, nombre: string, filasNombres: string[], columnasNombres: string[], etiquetaFilas: string, etiquetaColumnas: string): string[][] {
  const t = exigir(sec, nombre);
  const encabezado = t[0].slice(1);
  while (encabezado.length && encabezado[encabezado.length - 1] === "") encabezado.pop();
  const errores: string[] = [];
  if (encabezado.length !== columnasNombres.length) {
    errores.push(`«${nombre}»: tiene ${encabezado.length} columnas de ${etiquetaColumnas} y la lista tiene ${columnasNombres.length}.`);
  } else {
    columnasNombres.forEach((n, j) => {
      if (clave(encabezado[j]) !== clave(n)) errores.push(`«${nombre}»: la columna ${j + 1} se llama «${encabezado[j]}» y debería ser «${n}».`);
    });
  }
  const cuerpo: string[][] = [];
  for (let i = 1; i < t.length; i++) {
    if (t[i].every((c) => c === "")) break;
    cuerpo.push(t[i]);
  }
  if (cuerpo.length !== filasNombres.length) {
    errores.push(`«${nombre}»: tiene ${cuerpo.length} filas de ${etiquetaFilas} y la lista tiene ${filasNombres.length}.`);
  } else {
    filasNombres.forEach((n, i) => {
      if (clave(cuerpo[i][0] ?? "") !== clave(n)) errores.push(`«${nombre}»: la fila ${i + 2} se llama «${cuerpo[i][0] ?? ""}» y debería ser «${n}».`);
    });
  }
  if (errores.length) throw new ErrorImportar(errores.slice(0, 6));
  return cuerpo.map((f) => columnasNombres.map((_, j) => f[j + 1] ?? ""));
}

const duplicados = (nombres: string[], que: string) => {
  const vistos = new Set<string>();
  for (const n of nombres) {
    const k = clave(n);
    if (vistos.has(k)) throw new ErrorImportar([`Hay ${que} repetidos: «${n}». Cada nombre debe ser distinto.`]);
    vistos.add(k);
  }
};

const opcion = (t: Tabla | undefined, empieza: string): string | undefined => {
  const f = t?.find((r) => clave(r[0] ?? "").startsWith(empieza));
  return f ? f[1] ?? "" : undefined;
};

/* ---------- Ubicación de almacenes ---------- */

export const SECCIONES_UBICACION = ["Plantas", "Almacenes", "Clientes", "Costo planta-almacén", "Costo almacén-cliente", "Opciones"];

export function importarUbicacion(sec: Secciones): Estado {
  const plantas = lista(sec, "Plantas", 2, LIMITES.plantas, "plantas");
  const almacenes = lista(sec, "Almacenes", 4, LIMITES.almacenes, "almacenes");
  const clientes = lista(sec, "Clientes", 2, LIMITES.clientes, "clientes");
  duplicados(plantas.map((f) => f[0]), "nombres de plantas");
  duplicados(almacenes.map((f) => f[0]), "nombres de almacenes");
  duplicados(clientes.map((f) => f[0]), "nombres de clientes");
  const modos: Record<string, Modo> = { "": "libre", libre: "libre", abierto: "abierto", cerrado: "cerrado" };
  almacenes.forEach((f, i) => {
    if (!(clave(f[3]) in modos)) throw new ErrorImportar([`«Almacenes», fila ${i + 2}: el estado «${f[3]}» no vale. Usa Libre, Abierto o Cerrado.`]);
  });
  const cpa = matriz(sec, "Costo planta-almacén", plantas.map((f) => f[0]), almacenes.map((f) => f[0]), "plantas", "almacenes");
  const cac = matriz(sec, "Costo almacén-cliente", almacenes.map((f) => f[0]), clientes.map((f) => f[0]), "almacenes", "clientes");
  const op = sec.get(clave("Opciones"));
  return {
    plantas: plantas.map((f) => ({ nombre: f[0], capacidad: f[1] })),
    almacenes: almacenes.map((f) => ({ nombre: f[0], capacidad: f[1], fijo: f[2], modo: modos[clave(f[3])] })),
    clientes: clientes.map((f) => ({ nombre: f[0], demanda: f[1] })),
    cpa,
    cac,
    factor: opcion(op, "factor") || "1",
    min: opcion(op, "minimo") || "0",
    max: opcion(op, "maximo") ?? "",
  };
}

export const seccionesUbicacion = (e: Estado): Seccion[] => [
  { nombre: "Plantas", filas: [["Nombre", "Capacidad (vacío = ilimitada)"], ...e.plantas.map((p) => [p.nombre, p.capacidad])] },
  { nombre: "Almacenes", filas: [["Nombre", "Capacidad", "Costo fijo", "Estado (Libre / Abierto / Cerrado)"], ...e.almacenes.map((a) => [a.nombre, a.capacidad, a.fijo, { libre: "Libre", abierto: "Abierto", cerrado: "Cerrado" }[a.modo]])] },
  { nombre: "Clientes", filas: [["Nombre", "Demanda"], ...e.clientes.map((c) => [c.nombre, c.demanda])] },
  { nombre: "Costo planta-almacén", filas: [["", ...e.almacenes.map((a) => a.nombre)], ...e.plantas.map((p, i) => [p.nombre, ...e.cpa[i]])] },
  { nombre: "Costo almacén-cliente", filas: [["", ...e.clientes.map((c) => c.nombre)], ...e.almacenes.map((a, i) => [a.nombre, ...e.cac[i]])] },
  { nombre: "Opciones", filas: [["Opción", "Valor"], ["Factor de unidades", e.factor], ["Mínimo de almacenes abiertos", e.min], ["Máximo de almacenes abiertos (vacío = sin límite)", e.max]] },
];

/* ---------- Transporte ---------- */

export const SECCIONES_TRANSPORTE = ["Orígenes", "Destinos", "Costos"];

export function importarTransporte(sec: Secciones): EstadoT {
  const o = lista(sec, "Orígenes", 2, LIMITES_T.origenes, "orígenes");
  const d = lista(sec, "Destinos", 2, LIMITES_T.destinos, "destinos");
  duplicados(o.map((f) => f[0]), "nombres de orígenes");
  duplicados(d.map((f) => f[0]), "nombres de destinos");
  return {
    origenes: o.map((f) => ({ nombre: f[0], oferta: f[1] })),
    destinos: d.map((f) => ({ nombre: f[0], demanda: f[1] })),
    costos: matriz(sec, "Costos", o.map((f) => f[0]), d.map((f) => f[0]), "orígenes", "destinos"),
  };
}

export const seccionesTransporte = (e: EstadoT): Seccion[] => [
  { nombre: "Orígenes", filas: [["Nombre", "Oferta"], ...e.origenes.map((x) => [x.nombre, x.oferta])] },
  { nombre: "Destinos", filas: [["Nombre", "Demanda"], ...e.destinos.map((x) => [x.nombre, x.demanda])] },
  { nombre: "Costos", filas: [["", ...e.destinos.map((x) => x.nombre)], ...e.origenes.map((x, i) => [x.nombre, ...e.costos[i]])] },
];

/* ---------- Transbordo ---------- */

export const SECCIONES_TRANSBORDO = ["Nodos", "Costos"];

export function importarTransbordo(sec: Secciones): EstadoB {
  const n = lista(sec, "Nodos", 3, LIMITES_B.nodos, "nodos");
  duplicados(n.map((f) => f[0]), "nombres de nodos");
  const tipos: Record<string, TipoNodo> = { origen: "origen", intermedio: "intermedio", destino: "destino" };
  n.forEach((f, i) => {
    if (!(clave(f[1]) in tipos)) throw new ErrorImportar([`«Nodos», fila ${i + 2}: el tipo «${f[1]}» no vale. Usa Origen, Intermedio o Destino.`]);
  });
  const nombres = n.map((f) => f[0]);
  const costos = matriz(sec, "Costos", nombres, nombres, "nodos", "nodos").map((f, i) => f.map((c, j) => (i === j ? "" : c)));
  return { nodos: n.map((f) => ({ nombre: f[0], tipo: tipos[clave(f[1])], cantidad: f[2] })), costos };
}

export const seccionesTransbordo = (e: EstadoB): Seccion[] => [
  { nombre: "Nodos", filas: [["Nombre", "Tipo (Origen / Intermedio / Destino)", "Cantidad (oferta o demanda)"], ...e.nodos.map((x) => [x.nombre, { origen: "Origen", intermedio: "Intermedio", destino: "Destino" }[x.tipo], x.cantidad])] },
  { nombre: "Costos", filas: [["", ...e.nodos.map((x) => x.nombre)], ...e.nodos.map((x, i) => [x.nombre, ...e.costos[i]])] },
];

/* ---------- Asignación ---------- */

export const SECCIONES_ASIGNACION = ["Costos", "Opciones"];

export function importarAsignacion(sec: Secciones): EstadoA {
  const t = exigir(sec, "Costos");
  const tareas = t[0].slice(1);
  while (tareas.length && tareas[tareas.length - 1] === "") tareas.pop();
  const agentes: string[] = [];
  for (let i = 1; i < t.length; i++) {
    if (t[i].every((c) => c === "")) break;
    agentes.push(t[i][0] ?? "");
  }
  if (!agentes.length || !tareas.length) throw new ErrorImportar(["«Costos»: necesito al menos un agente (filas) y una tarea (columnas)."]);
  if (agentes.length > LIMITES_A.agentes) throw new ErrorImportar([`«Costos»: máximo ${LIMITES_A.agentes} agentes (hay ${agentes.length}).`]);
  if (tareas.length > LIMITES_A.tareas) throw new ErrorImportar([`«Costos»: máximo ${LIMITES_A.tareas} tareas (hay ${tareas.length}).`]);
  agentes.forEach((a, i) => {
    if (a === "") throw new ErrorImportar([`«Costos», fila ${i + 2}: falta el nombre del agente.`]);
  });
  if (tareas.some((x) => x === "")) throw new ErrorImportar(["«Costos»: hay una columna sin nombre de tarea."]);
  duplicados(agentes, "nombres de agentes");
  duplicados(tareas, "nombres de tareas");
  const costos = matriz(sec, "Costos", agentes, tareas, "agentes", "tareas");
  const obj = clave(opcion(sec.get(clave("Opciones")), "objetivo") ?? "minimizar");
  const objetivo: Objetivo | undefined = obj === "" || obj === "minimizar" ? "minimizar" : obj === "maximizar" ? "maximizar" : undefined;
  if (!objetivo) throw new ErrorImportar(["«Opciones»: el objetivo debe ser Minimizar o Maximizar."]);
  return { agentes, tareas, costos, objetivo };
}

export const seccionesAsignacion = (e: EstadoA): Seccion[] => [
  { nombre: "Costos", filas: [["", ...e.tareas], ...e.agentes.map((a, i) => [a, ...e.costos[i]])] },
  { nombre: "Opciones", filas: [["Opción", "Valor"], ["Objetivo (Minimizar / Maximizar)", e.objetivo === "maximizar" ? "Maximizar" : "Minimizar"]] },
];

/* ---------- Plantillas descargables ---------- */

const INSTRUCCIONES = (secciones: Seccion[]): string[][] => [
  ["Cómo usar esta plantilla"],
  ["1. Cambia los datos de ejemplo por los tuyos, sin cambiar los nombres de las hojas ni los encabezados."],
  ["2. En las tablas de costos, la primera fila y la primera columna son los nombres: deben coincidir con los de las listas."],
  ["3. Deja una celda vacía de costo donde esa ruta no exista (si el problema lo permite). Usa punto o coma decimal."],
  ["4. Guarda como .xlsx o .csv y, en la app, pulsa «Importar Excel/CSV»."],
  [`Hojas que se leen: ${secciones.map((s) => s.nombre).join(", ")}. Cualquier otra hoja se ignora.`],
];

export async function descargarPlantillaExcel(archivo: string, secciones: Seccion[]) {
  const hojas: Hoja[] = secciones.map((s) => ({ nombre: s.nombre, bloques: [{ columnas: s.filas[0], filas: s.filas.slice(1) }] }));
  hojas.push({ nombre: "Instrucciones", bloques: [{ filas: INSTRUCCIONES(secciones) }] });
  await descargarExcel(archivo, hojas);
}

export function descargarPlantillaCSV(archivo: string, secciones: Seccion[]) {
  const celda = (c: string) => (/[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
  const texto = secciones
    .map((s) => [s.nombre, ...s.filas.map((f) => f.map(celda).join(";"))].join("\n"))
    .join("\n\n");
  const blob = new Blob(["﻿" + texto + "\n"], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${archivo}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
