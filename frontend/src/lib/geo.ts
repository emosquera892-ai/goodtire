export type Anillo = { pts: Float32Array; minLon: number; maxLon: number; minLat: number; maxLat: number };
export type GeoMundo = { paises: Anillo[]; estados: Anillo[]; lagos: Anillo[] };
export type Caja = { x0: number; y0: number; x1: number; y1: number };

const LAT_MAX = 85;
/** Mercator: la longitud tal cual y la latitud estirada (en "grados mercator"). */
export const mercY = (lat: number) => -(180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)) * Math.PI) / 360));

/** Inversa de mercY: latitud real a partir de la "y mercator". */
export const latDesdeMercY = (y: number) => (360 / Math.PI) * Math.atan(Math.exp((-y * Math.PI) / 180)) - 90;

function decodificar(lista: number[][]): Anillo[] {
  return lista.map((r) => {
    const pts = new Float32Array(r.length);
    let x = 0;
    let y = 0;
    let minLon = 1e9, maxLon = -1e9, minLat = 1e9, maxLat = -1e9;
    for (let i = 0; i < r.length; i += 2) {
      x += r[i];
      y += r[i + 1];
      let lon = x / 100;
      const lat = y / 100;
      // anillos que cruzan el antimeridiano: se "desenvuelven" para que no salte de un borde al otro
      if (i > 0) {
        const prev = pts[i - 2];
        if (lon - prev > 180) lon -= 360;
        else if (prev - lon > 180) lon += 360;
      }
      pts[i] = lon;
      pts[i + 1] = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return { pts, minLon, maxLon, minLat, maxLat };
  });
}

export function cargarGeo(json: string): GeoMundo {
  const d = JSON.parse(json) as { p: number[][]; e: number[][]; l: number[][] };
  return { paises: decodificar(d.p), estados: decodificar(d.e), lagos: decodificar(d.l) };
}

/** Trazo SVG de los anillos que caen dentro de la caja; omite puntos más juntos que `tol`. */
export function trazo(anillos: Anillo[], caja: Caja, cerrar: boolean, tol: number): string {
  const partes: string[] = [];
  for (const a of anillos) {
    const yTop = mercY(a.maxLat);
    const yBot = mercY(a.minLat);
    if (yBot < caja.y0 || yTop > caja.y1) continue;
    for (const d of [-360, 0, 360]) {
      if (a.maxLon + d < caja.x0 || a.minLon + d > caja.x1) continue;
      let ult: [number, number] | null = null;
      let seg = "";
      const n = a.pts.length / 2;
      for (let i = 0; i < n; i++) {
        const x = a.pts[2 * i] + d;
        const y = mercY(a.pts[2 * i + 1]);
        if (ult && i < n - 1 && Math.abs(x - ult[0]) < tol && Math.abs(y - ult[1]) < tol) continue;
        seg += `${seg ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`;
        ult = [x, y];
      }
      if (seg) partes.push(seg + (cerrar ? "Z" : ""));
    }
  }
  return partes.join("");
}
