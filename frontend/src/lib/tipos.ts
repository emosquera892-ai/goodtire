/* Tipos de problema disponibles: nombre para mostrar y ruta de su pantalla. */
export const TIPOS: Record<string, { nombre: string; ruta: string }> = {
  ubicacion: { nombre: "Ubicación de almacenes", ruta: "/resolver" },
  transporte: { nombre: "Transporte", ruta: "/resolver/transporte" },
  asignacion: { nombre: "Asignación", ruta: "/resolver/asignacion" },
};
