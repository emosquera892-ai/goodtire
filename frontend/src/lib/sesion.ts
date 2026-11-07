import { useSyncExternalStore } from "react";
import { suscribirSesion, usuarioSnapshot } from "./api";

/* Usuario con sesión iniciada (o null). */
export const useUsuario = () => useSyncExternalStore(suscribirSesion, usuarioSnapshot, () => null);

/* Estado del modal de inicio de sesión, compartido entre páginas. */
let loginAbierto = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

export function abrirLogin() {
  loginAbierto = true;
  avisar();
}
export function cerrarLogin() {
  loginAbierto = false;
  avisar();
}
const suscribirLogin = (cb: () => void) => {
  oyentes.add(cb);
  return () => {
    oyentes.delete(cb);
  };
};
export const useLoginAbierto = () =>
  useSyncExternalStore(suscribirLogin, () => loginAbierto, () => false);
