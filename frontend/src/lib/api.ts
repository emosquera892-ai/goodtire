const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export type Problema = {
  plantas: string[];
  almacenes: string[];
  clientes: string[];
  capacidad_plantas: (number | null)[];
  capacidad_almacenes: number[];
  costo_fijo: number[];
  demanda: number[];
  costo_planta_almacen: number[][];
  costo_almacen_cliente: number[][];
  factor_unidades: number;
  min_almacenes: number;
  max_almacenes: number | null;
  forzar_abiertos: string[];
  forzar_cerrados: string[];
};

export type Solucion = {
  estado: string;
  costo_total: number;
  costo_fijo_total: number;
  costo_transporte_total: number;
  almacenes_abiertos: string[];
  detalle_almacenes: {
    almacen: string;
    capacidad: number;
    uso: number;
    utilizacion_pct: number;
    costo_fijo: number;
  }[];
  detalle_plantas: {
    planta: string;
    capacidad: number | null;
    uso: number;
    utilizacion_pct: number | null;
  }[];
  envios_planta_almacen: {
    planta: string;
    almacen: string;
    unidades: number;
    costo_unitario: number;
  }[];
  envios_almacen_cliente: {
    almacen: string;
    cliente: string;
    unidades: number;
    costo_unitario: number;
  }[];
  comparacion:
    | {
        almacenes: string[];
        costo_transporte: number;
        costo_fijo: number;
        costo_total: number;
      }[]
    | null;
};

export type CasoResumen = {
  id: number;
  nombre: string;
  costo_total: number | null;
  almacenes_abiertos: string[];
  creado: string;
  actualizado: string;
};

export type Caso = {
  id: number;
  nombre: string;
  datos: Problema;
  resultado: Solucion | null;
  costo_total: number | null;
  creado: string;
  actualizado: string;
};

export type Pagina<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export class ErrorApi extends Error {
  detalle: string[];
  estado: number;
  constructor(detalle: string[], estado = 0) {
    super(detalle.join(" · "));
    this.detalle = detalle;
    this.estado = estado;
  }
}

/* ---------- Sesión (tokens JWT en el navegador) ---------- */

type Sesion = { access: string; refresh: string; usuario: string };
const CLAVE = "gt_sesion";
const oyentes = new Set<() => void>();

function leerSesion(): Sesion | null {
  try {
    const crudo = localStorage.getItem(CLAVE);
    return crudo ? (JSON.parse(crudo) as Sesion) : null;
  } catch {
    return null;
  }
}

function guardarSesion(s: Sesion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* almacenamiento no disponible */
  }
  oyentes.forEach((f) => f());
}

export function suscribirSesion(cb: () => void) {
  oyentes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    oyentes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export const usuarioSnapshot = (): string | null => leerSesion()?.usuario ?? null;
export const cerrarSesion = () => guardarSesion(null);

async function renovar(sesion: Sesion): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: sesion.refresh }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    guardarSesion({ ...sesion, access: json.access, refresh: json.refresh ?? sesion.refresh });
    return true;
  } catch {
    return false;
  }
}

async function extraerErrores(res: Response): Promise<string[]> {
  try {
    const json = await res.json();
    const salida: string[] = [];
    const recorrer = (v: unknown, clave?: string) => {
      if (typeof v === "string") {
        salida.push(clave && clave !== "detail" && clave !== "non_field_errors" ? `${clave}: ${v}` : v);
      } else if (Array.isArray(v)) {
        v.forEach((x) => recorrer(x, clave));
      } else if (v && typeof v === "object") {
        Object.entries(v).forEach(([k, x]) => recorrer(x, k));
      }
    };
    recorrer(json);
    if (salida.length) return salida;
  } catch {
    /* respuesta sin JSON */
  }
  return [`Error ${res.status}`];
}

async function pedir<T>(ruta: string, opciones: RequestInit = {}, conAuth = false, reintento = true): Promise<T> {
  const headers = new Headers(opciones.headers);
  if (opciones.body) headers.set("Content-Type", "application/json");
  const sesion = conAuth ? leerSesion() : null;
  if (conAuth) {
    if (!sesion) throw new ErrorApi(["Inicia sesión para continuar."], 401);
    headers.set("Authorization", `Bearer ${sesion.access}`);
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${ruta}`, { ...opciones, headers });
  } catch {
    throw new ErrorApi(["No se pudo conectar con el servidor. ¿Está encendido?"]);
  }
  if (res.status === 401 && conAuth && sesion && reintento) {
    if (await renovar(sesion)) return pedir<T>(ruta, opciones, conAuth, false);
    cerrarSesion();
    throw new ErrorApi(["Tu sesión expiró. Inicia sesión de nuevo."], 401);
  }
  if (!res.ok) throw new ErrorApi(await extraerErrores(res), res.status);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/* ---------- Endpoints ---------- */

export const resolver = (datos: Problema) =>
  pedir<Solucion>("/resolver", { method: "POST", body: JSON.stringify(datos) });

export async function iniciarSesion(usuario: string, clave: string) {
  const t = await pedir<{ access: string; refresh: string }>("/auth/token", {
    method: "POST",
    body: JSON.stringify({ username: usuario, password: clave }),
  });
  guardarSesion({ access: t.access, refresh: t.refresh, usuario });
}

export async function registrar(usuario: string, clave: string) {
  await pedir("/auth/registro", { method: "POST", body: JSON.stringify({ username: usuario, password: clave }) });
  await iniciarSesion(usuario, clave);
}

export const listarCasos = (pagina = 1) => pedir<Pagina<CasoResumen>>(`/casos?page=${pagina}`, {}, true);
export const obtenerCaso = (id: number) => pedir<Caso>(`/casos/${id}`, {}, true);
export const crearCaso = (nombre: string, datos: Problema) =>
  pedir<Caso>("/casos", { method: "POST", body: JSON.stringify({ nombre, datos }) }, true);
export const actualizarCaso = (id: number, cambios: { nombre?: string; datos?: Problema }) =>
  pedir<Caso>(`/casos/${id}`, { method: "PATCH", body: JSON.stringify(cambios) }, true);
export const borrarCaso = (id: number) => pedir<void>(`/casos/${id}`, { method: "DELETE" }, true);
export const duplicarCaso = (id: number) => pedir<Caso>(`/casos/${id}/duplicar`, { method: "POST" }, true);

export const dinero = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");
export const numero = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
