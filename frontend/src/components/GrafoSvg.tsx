import type { EstiloArista, EstiloNodo } from "@/lib/grafos";

type Arista = { de: string; a: string; valor: number };

const W = 760;
const H = 520;
const R = 24;

const COLOR_ARISTA: Record<EstiloArista, string> = {
  normal: "var(--color-slate)",
  elegida: "var(--color-apple-blue)",
  activa: "#ff9f0a",
  rechazada: "#ff453a",
};
const grosor: Record<EstiloArista, number> = { normal: 1.5, elegida: 4, activa: 4, rechazada: 3 };

function posiciones(nodos: string[]) {
  const n = nodos.length;
  const rx = W / 2 - 80;
  const ry = H / 2 - 60;
  return Object.fromEntries(
    nodos.map((nombre, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / Math.max(n, 1);
      return [nombre, { x: W / 2 + rx * Math.cos(ang), y: H / 2 + ry * Math.sin(ang) }];
    }),
  );
}

export function GrafoSvg({
  nodos,
  aristas,
  dirigido,
  estilos = {},
  etiquetas = {},
  estilosNodo = {},
}: {
  nodos: string[];
  aristas: Arista[];
  dirigido: boolean;
  estilos?: Record<number, EstiloArista>;
  etiquetas?: Record<number, string>;
  estilosNodo?: Record<string, EstiloNodo>;
}) {
  const pos = posiciones(nodos);
  // aristas que comparten el mismo par de nodos se separan para no taparse
  const grupos = new Map<string, number[]>();
  aristas.forEach((x, i) => {
    const k = [x.de, x.a].sort().join("\u0000");
    grupos.set(k, [...(grupos.get(k) ?? []), i]);
  });
  const dibujo = aristas.map((x, i) => {
    const p = pos[x.de];
    const q = pos[x.a];
    if (!p || !q) return null;
    const lista = grupos.get([x.de, x.a].sort().join("\u0000")) ?? [i];
    const desp = (lista.indexOf(i) - (lista.length - 1) / 2) * 46;
    const [u, v] = x.de < x.a ? [p, q] : [q, p];
    const dx = v.x - u.x;
    const dy = v.y - u.y;
    const largo = Math.hypot(dx, dy) || 1;
    const cx = (p.x + q.x) / 2 + (-dy / largo) * desp * 2;
    const cy = (p.y + q.y) / 2 + (dx / largo) * desp * 2;
    // recortar el trazo al borde de los círculos
    const recorte = (a: { x: number; y: number }, hacia: { x: number; y: number }) => {
      const d = Math.hypot(hacia.x - a.x, hacia.y - a.y) || 1;
      return { x: a.x + ((hacia.x - a.x) / d) * (R + 2), y: a.y + ((hacia.y - a.y) / d) * (R + 2) };
    };
    const ini = recorte(p, { x: cx, y: cy });
    const fin = recorte(q, { x: cx, y: cy });
    const mx = 0.25 * ini.x + 0.5 * cx + 0.25 * fin.x;
    const my = 0.25 * ini.y + 0.5 * cy + 0.25 * fin.y;
    return { i, ini, fin, cx, cy, mx, my };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Grafo de la red" className="h-auto w-full">
      <defs>
        {(Object.keys(COLOR_ARISTA) as EstiloArista[]).map((s) => (
          <marker key={s} id={`punta-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR_ARISTA[s]} />
          </marker>
        ))}
      </defs>
      {dibujo.map((d) => {
        if (!d) return null;
        const s = estilos[d.i] ?? "normal";
        const texto = etiquetas[d.i] ?? String(aristas[d.i].valor).replace(".", ",");
        const ancho = texto.length * 7.2 + 12;
        return (
          <g key={d.i}>
            <path
              d={`M ${d.ini.x} ${d.ini.y} Q ${d.cx} ${d.cy} ${d.fin.x} ${d.fin.y}`}
              fill="none"
              stroke={COLOR_ARISTA[s]}
              strokeWidth={grosor[s]}
              strokeLinecap="round"
              markerEnd={dirigido ? `url(#punta-${s})` : undefined}
              opacity={s === "normal" ? 0.7 : 1}
            />
            <rect x={d.mx - ancho / 2} y={d.my - 10} width={ancho} height={20} rx={10} fill="var(--color-obsidian)" opacity={0.9} />
            <text x={d.mx} y={d.my + 4} textAnchor="middle" fontSize={12} fontWeight={s === "normal" ? 400 : 600} fill={s === "normal" ? "var(--color-ash)" : COLOR_ARISTA[s]}>
              {texto}
            </text>
          </g>
        );
      })}
      {nodos.map((nombre) => {
        const p = pos[nombre];
        const s = estilosNodo[nombre] ?? "normal";
        const relleno = s === "fijo" ? "var(--color-apple-blue)" : s === "actual" ? "#ff9f0a" : s === "corte" ? "#30d158" : "var(--color-carbon)";
        const letra = s === "normal" ? "var(--color-porcelain)" : "#fff";
        return (
          <g key={nombre}>
            <circle cx={p.x} cy={p.y} r={R} fill={relleno} stroke={s === "normal" ? "var(--color-slate)" : relleno} strokeWidth={1.5} />
            <text className={s === "normal" ? undefined : "nodo-color"} x={p.x} y={p.y + 4} textAnchor="middle" fontSize={nombre.length > 7 ? 9.5 : 11.5} fontWeight={600} fill={letra}>
              {nombre.length > 10 ? `${nombre.slice(0, 9)}…` : nombre}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
