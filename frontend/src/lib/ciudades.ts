import { CIUDADES_XY } from "./mapaCiudades";

const norm = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Nombres en español u otras escrituras frecuentes → nombre en la tabla
const ALIAS: Record<string, string> = {
  filadelfia: "Philadelphia",
  bufalo: "Buffalo",
  "nueva york": "New York",
  nyc: "New York",
  "nueva orleans": "New Orleans",
  "nueva orleáns": "New Orleans",
  "san luis": "St. Louis",
  "st louis": "St. Louis",
  "saint louis": "St. Louis",
  "los angeles": "Los Angeles",
  "san francisco": "San Francisco",
  "washington dc": "Washington",
  "washington d c": "Washington",
  "salt lake": "Salt Lake City",
  "kansas": "Kansas City",
  "oklahoma": "Oklahoma City",
  "las vegas": "Las Vegas",
  "portland maine": "Portland ME",
  "portland me": "Portland ME",
  indianapolis: "Indianapolis",
  luisville: "Louisville",
};

const TABLA: Record<string, [number, number]> = {};
const NOMBRE_DE: Record<string, string> = {};
for (const n of Object.keys(CIUDADES_XY)) {
  TABLA[norm(n)] = CIUDADES_XY[n];
  NOMBRE_DE[norm(n)] = n;
}
for (const [a, n] of Object.entries(ALIAS)) {
  const xy = CIUDADES_XY[n];
  if (xy) TABLA[norm(a)] = xy;
}

/** Posición (x, y) en el mapa de EE. UU. de una ciudad conocida, o null. */
export function ubicarCiudad(nombre: string): [number, number] | null {
  const k = norm(nombre);
  if (TABLA[k]) return TABLA[k];
  // "Cleveland (planta)", "Bodega Chicago": se prueba cada ciudad conocida como palabra completa
  for (const c of Object.keys(TABLA)) {
    if (c.length >= 5 && (` ${k} `).includes(` ${c} `)) return TABLA[c];
  }
  return null;
}
