import { useSyncExternalStore } from "react";

/* Tema de color: "oscuro" (por defecto) o "claro". Se guarda en localStorage. */
export type Tema = "oscuro" | "claro";
const CLAVE = "tema";
const oyentes = new Set<() => void>();

function leer(): Tema {
  try {
    return localStorage.getItem(CLAVE) === "claro" ? "claro" : "oscuro";
  } catch {
    return "oscuro";
  }
}

export function fijarTema(t: Tema) {
  try {
    localStorage.setItem(CLAVE, t);
  } catch {
    /* sin almacenamiento: el cambio dura solo esta página */
  }
  document.documentElement.dataset.tema = t;
  oyentes.forEach((f) => f());
}

const suscribir = (cb: () => void) => {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
};

export const useTema = () => useSyncExternalStore<Tema>(suscribir, leer, () => "oscuro");
