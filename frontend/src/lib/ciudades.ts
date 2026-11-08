import { mercY } from "./geo";

export type TablaCiudades = Record<string, [number, number, number][]>; // [lon, lat, población en miles]
export type Posicion = [number, number]; // [lon, "y mercator"]

export const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Nombres en español (u otras formas frecuentes) → nombre normalizado de la tabla
const ALIAS: Record<string, string> = {
  filadelfia: "philadelphia", bufalo: "buffalo", "nueva york": "new york city", "new york": "new york city", nyc: "new york city",
  "nueva orleans": "new orleans", "san luis": "st louis", "saint louis": "st louis", "washington dc": "washington d c", washington: "washington d c",
  londres: "london", roma: "rome", munich: "munich", colonia: "koln", cologne: "koln", francfort: "frankfurt am main", frankfurt: "frankfurt am main",
  moscu: "moscow", pekin: "beijing", "ciudad de mexico": "mexico city", "mexico df": "mexico city", cdmx: "mexico city", df: "mexico city",
  "ciudad de panama": "panama city", panama: "panama city", lisboa: "lisbon", viena: "vienna", praga: "prague", varsovia: "warsaw",
  bruselas: "brussels", ginebra: "geneve", geneva: "geneve", berna: "bern", napoles: "naples", venecia: "venice", florencia: "florence", atenas: "athens",
  estambul: "istanbul", "el cairo": "cairo", bombay: "mumbai", "nueva delhi": "new delhi", tokio: "tokyo", seul: "seoul", yakarta: "jakarta",
  sidney: "sydney", "ciudad del cabo": "cape town", johannesburgo: "johannesburg", "san pablo": "sao paulo", copenhague: "copenhagen",
  estocolmo: "stockholm", "san petersburgo": "saint petersburg", bagdad: "baghdad", teheran: "tehran", damasco: "damascus",
  jerusalen: "jerusalem", edimburgo: "edinburgh", basilea: "basel", bucarest: "bucharest", canton: "guangzhou", nankin: "nanjing",
  kioto: "kyoto", "la habana": "havana", "ciudad de guatemala": "guatemala city", "puerto principe": "port au prince",
  "bogota dc": "bogota", "bogota d c": "bogota", "cartagena de indias": "cartagena", hamburgo: "hamburg", estrasburgo: "strasbourg",
  marsella: "marseille", burdeos: "bordeaux", gotemburgo: "goteborg", gothenburg: "goteborg", kiev: "kyiv", cracovia: "krakow", luisville: "louisville",
  "san francisco ca": "san francisco", "los angeles ca": "los angeles", "salt lake": "salt lake city", kansas: "kansas city",
  oklahoma: "oklahoma city", "ciudad de mexico df": "mexico city", "nueva zelanda": "auckland", "rio": "rio de janeiro", "sao paulo": "sao paulo",
};
// palabras que no deben tomarse como ciudad al buscar un nombre dentro de otro
const NO_CIUDAD = new Set(["central", "centro", "almacen", "planta", "cliente", "bodega", "origen", "destino", "fabrica", "deposito", "distribuidor", "mayorista", "sucursal", "oficina", "principal", "terminal", "puerto", "mercado"]);

const dist = (a: [number, number], b: [number, number]) => {
  const dx = (a[0] - b[0]) * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  return Math.hypot(dx, a[1] - b[1]);
};

function candidatos(nombre: string, tabla: TablaCiudades): [number, number, number][] | null {
  const k = normalizar(nombre);
  const directo = tabla[ALIAS[k] ?? k];
  if (directo) return directo;
  // "Cleveland (planta)", "Bodega Chicago": se busca la ciudad más larga que aparezca como palabra completa
  let mejor: string | null = null;
  for (const c of Object.keys(tabla)) {
    if (c.length >= 6 && !NO_CIUDAD.has(c) && (mejor === null || c.length > mejor.length) && ` ${k} `.includes(` ${c} `)) mejor = c;
  }
  for (const [a, c] of Object.entries(ALIAS)) {
    if (a.length >= 6 && tabla[c] && (mejor === null || a.length > mejor.length) && ` ${k} `.includes(` ${a} `)) return tabla[c];
  }
  return mejor ? tabla[mejor] : null;
}

/** Posición de cada nombre (o null si no se reconoce). Si un nombre es ambiguo (p. ej. "Valencia"), elige el más cercano a los demás. */
export function ubicarNombres(nombres: string[], tabla: TablaCiudades): (Posicion | null)[] {
  const cands = nombres.map((n) => candidatos(n, tabla));
  const claros = cands.map((c) => (c && (c.length === 1 || c[0][2] >= 4 * c[1][2]) ? ([c[0][0], c[0][1]] as [number, number]) : null));
  const fijos = claros.filter((c): c is [number, number] => c !== null);
  const centro: [number, number] | null = fijos.length ? [fijos.reduce((s, c) => s + c[0], 0) / fijos.length, fijos.reduce((s, c) => s + c[1], 0) / fijos.length] : null;
  return cands.map((c, i) => {
    if (!c) return null;
    let p: [number, number] = claros[i] ?? [c[0][0], c[0][1]];
    if (!claros[i] && centro) {
      let mejor = Infinity;
      for (const x of c) {
        const d = dist([x[0], x[1]], centro);
        if (d < mejor) {
          mejor = d;
          p = [x[0], x[1]];
        }
      }
    }
    return [p[0], mercY(p[1])];
  });
}
