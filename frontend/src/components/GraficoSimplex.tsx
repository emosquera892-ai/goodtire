"use client";

import { useEffect, useMemo, useState } from "react";
import { formatear, type Grafico } from "@/lib/simplex";
import { Boton } from "./ui";

const W = 720;
const H = 480;
const M = { l: 54, r: 20, t: 20, b: 44 };
const COLORES = ["#2997ff", "#ff9f0a", "#bf5af2", "#30d158", "#ff453a", "#64d2ff", "#ffd60a", "#ff375f", "#5e5ce6", "#ac8e68"];

function ticks(max: number) {
  const bruto = max / 6;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto) ?? pot * 10;
  const t: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += paso) t.push(Number(v.toPrecision(10)));
  return t;
}

/** Recorta la recta a·x + b·y = c con el rectángulo [0,xm]×[0,ym]; devuelve dos puntos o null. */
function segmento(a: number, b: number, c: number, xm: number, ym: number): [number, number][] | null {
  const pts: [number, number][] = [];
  const eps = 1e-9;
  if (Math.abs(b) > eps) {
    for (const x of [0, xm]) {
      const y = (c - a * x) / b;
      if (y >= -eps && y <= ym + eps) pts.push([x, Math.min(Math.max(y, 0), ym)]);
    }
  }
  if (Math.abs(a) > eps) {
    for (const y of [0, ym]) {
      const x = (c - b * y) / a;
      if (x >= -eps && x <= xm + eps) pts.push([Math.min(Math.max(x, 0), xm), y]);
    }
  }
  const unicos = pts.filter((p, i) => pts.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-7) === i);
  return unicos.length >= 2 ? [unicos[0], unicos[1]] : null;
}

export function GraficoSimplex({ g }: { g: Grafico }) {
  const { xmax, ymax } = g.vista;
  const sx = (W - M.l - M.r) / xmax;
  const sy = (H - M.t - M.b) / ymax;
  const X = (x: number) => M.l + x * sx;
  const Y = (y: number) => H - M.b - y * sy;

  const fact = g.vertices.filter((v) => v.factible);
  const zs = fact.map((v) => v.z);
  const zMin = zs.length ? Math.min(...zs) : 0;
  const zMax = zs.length ? Math.max(...zs) : 1;
  const zOpt = g.optimo?.z ?? (g.objetivo.maximizar ? zMax : zMin);
  const [z, setZ] = useState<number | null>(null);
  const [animando, setAnimando] = useState(false);
  const [noFact, setNoFact] = useState(false);
  const zActual = z ?? zOpt;
  const tieneObjetivo = g.objetivo.c1 !== 0 || g.objetivo.c2 !== 0;
  const margen = (zMax - zMin || 1) * 0.15;
  const lo = zMin - margen;
  const hi = zMax + margen;

  // Animación: la recta de Z se desplaza hacia la mejora hasta tocar el último vértice
  useEffect(() => {
    if (!animando) return;
    const inicio = g.objetivo.maximizar ? lo : hi;
    const fin = zOpt;
    const t0 = performance.now();
    const dur = 3200;
    let id = 0;
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setZ(inicio + (fin - inicio) * k);
      if (k < 1) id = requestAnimationFrame(paso);
      else setAnimando(false);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [animando, lo, hi, zOpt, g.objetivo.maximizar]);

  const rectas = useMemo(
    () =>
      g.rectas.map((r, i) => {
        const seg = segmento(r.a, r.b, r.c, xmax, ymax);
        let flecha: { x1: number; y1: number; x2: number; y2: number; a1: number; a2: number } | null = null;
        if (seg && r.signo !== "=") {
          const mx = (X(seg[0][0]) + X(seg[1][0])) / 2;
          const my = (Y(seg[0][1]) + Y(seg[1][1])) / 2;
          // gradiente en pantalla de a·x + b·y
          let gx = r.a / sx;
          let gy = -r.b / sy;
          const n = Math.hypot(gx, gy) || 1;
          gx /= n;
          gy /= n;
          const d = r.signo === "<=" ? -1 : 1;
          const dx = gx * d;
          const dy = gy * d;
          flecha = { x1: mx, y1: my, x2: mx + dx * 22, y2: my + dy * 22, a1: dx, a2: dy };
        }
        return { ...r, seg, flecha, color: COLORES[i % COLORES.length] };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g, sx, sy],
  );

  const segObj = tieneObjetivo ? segmento(g.objetivo.c1, g.objetivo.c2, zActual, xmax, ymax) : null;
  const polyPts = g.poligono.map(([x, y]) => `${X(x)},${Y(y)}`).join(" ");
  const sinRegion = g.poligono.length < 3 && !g.segmento;
  const [v1, v2] = g.variables;
  const eq = (r: Grafico["rectas"][number]) => {
    const t = (c: number, v: string) => (c === 0 ? "" : `${c < 0 ? "−" : "+"} ${Math.abs(c) === 1 ? "" : formatear(Math.abs(c))}${v} `);
    const s = `${t(r.a, v1)}${t(r.b, v2)}`.trim().replace(/^\+ /, "");
    return `${s || "0"} ${r.signo === "<=" ? "≤" : r.signo === ">=" ? "≥" : "="} ${formatear(r.c)}`;
  };

  return (
    <div>
      <div className="overflow-x-auto rounded-[20px] bg-obsidian">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico del método gráfico: restricciones, región factible, vértices y recta de la función objetivo" className="h-auto w-full min-w-[520px]">
          {/* cuadrícula y ejes */}
          {ticks(xmax).map((t) => (
            <g key={`x${t}`}>
              <line x1={X(t)} y1={Y(0)} x2={X(t)} y2={Y(ymax)} stroke="var(--color-steel)" strokeWidth={0.6} opacity={0.6} />
              <text x={X(t)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="var(--color-ash)">{formatear(t)}</text>
            </g>
          ))}
          {ticks(ymax).map((t) => (
            <g key={`y${t}`}>
              <line x1={X(0)} y1={Y(t)} x2={X(xmax)} y2={Y(t)} stroke="var(--color-steel)" strokeWidth={0.6} opacity={0.6} />
              <text x={M.l - 8} y={Y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-ash)">{formatear(t)}</text>
            </g>
          ))}
          <line x1={X(0)} y1={Y(0)} x2={X(xmax)} y2={Y(0)} stroke="var(--color-ash)" strokeWidth={1.5} />
          <line x1={X(0)} y1={Y(0)} x2={X(0)} y2={Y(ymax)} stroke="var(--color-ash)" strokeWidth={1.5} />
          <text x={X(xmax) - 4} y={Y(0) + 34} textAnchor="end" fontSize={13} fontWeight={600} fill="var(--color-porcelain)">{v1}</text>
          <text x={M.l + 8} y={M.t + 12} fontSize={13} fontWeight={600} fill="var(--color-porcelain)">{v2}</text>

          {/* región factible */}
          {g.poligono.length >= 3 && <polygon points={polyPts} fill="#2997ff" fillOpacity={0.22} stroke="#2997ff" strokeWidth={1.5} />}
          {g.segmento && (
            <line x1={X(g.segmento[0][0])} y1={Y(g.segmento[0][1])} x2={X(g.segmento[1][0])} y2={Y(g.segmento[1][1])} stroke="#30d158" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
          )}

          {/* rectas de restricción con flechas hacia el semiplano válido */}
          {rectas.map(
            (r) =>
              r.seg && (
                <g key={r.nombre}>
                  <line x1={X(r.seg[0][0])} y1={Y(r.seg[0][1])} x2={X(r.seg[1][0])} y2={Y(r.seg[1][1])} stroke={r.color} strokeWidth={2.2} strokeDasharray={r.signo === "=" ? "6 4" : undefined} />
                  {r.flecha && (
                    <g stroke={r.color} fill={r.color} strokeWidth={2}>
                      <line x1={r.flecha.x1} y1={r.flecha.y1} x2={r.flecha.x2} y2={r.flecha.y2} />
                      <polygon
                        points={`${r.flecha.x2},${r.flecha.y2} ${r.flecha.x2 - r.flecha.a1 * 8 + r.flecha.a2 * 5},${r.flecha.y2 - r.flecha.a2 * 8 - r.flecha.a1 * 5} ${r.flecha.x2 - r.flecha.a1 * 8 - r.flecha.a2 * 5},${r.flecha.y2 - r.flecha.a2 * 8 + r.flecha.a1 * 5}`}
                        stroke="none"
                      />
                    </g>
                  )}
                  <text x={X(r.seg[1][0]) + (r.seg[1][0] >= xmax - 1e-9 ? -6 : 6)} y={Y(r.seg[1][1]) + (r.seg[1][1] <= 1e-9 ? -8 : -6)} textAnchor={r.seg[1][0] >= xmax - 1e-9 ? "end" : "start"} fontSize={12} fontWeight={700} fill={r.color}>
                    {r.nombre}
                  </text>
                </g>
              ),
          )}

          {/* recta de la función objetivo */}
          {segObj && (
            <g>
              <line x1={X(segObj[0][0])} y1={Y(segObj[0][1])} x2={X(segObj[1][0])} y2={Y(segObj[1][1])} stroke="var(--color-optical-yellow)" strokeWidth={2.6} strokeDasharray="8 5" />
              <text x={(X(segObj[0][0]) + X(segObj[1][0])) / 2 + 8} y={(Y(segObj[0][1]) + Y(segObj[1][1])) / 2 - 8} fontSize={12} fontWeight={700} fill="var(--color-optical-yellow)">
                Z = {formatear(zActual)}
              </text>
            </g>
          )}

          {/* vértices */}
          {g.vertices
            .filter((v) => noFact || v.factible)
            .map((v, i) => (
              <g key={i}>
                <circle cx={X(v.x)} cy={Y(v.y)} r={v.optimo ? 7 : v.factible ? 5 : 3.5} fill={v.optimo ? "#30d158" : v.factible ? "var(--color-porcelain)" : "none"} stroke={v.factible ? "var(--color-obsidian)" : "var(--color-ash)"} strokeWidth={v.factible ? 1.5 : 1} />
                {v.factible && (
                  <text x={X(v.x) + (v.x > xmax * 0.8 ? -9 : 9)} y={Y(v.y) + (v.y < ymax * 0.12 ? -9 : 16)} textAnchor={v.x > xmax * 0.8 ? "end" : "start"} fontSize={11} fill="var(--color-porcelain)">
                    ({formatear(v.x)}, {formatear(v.y)})
                  </text>
                )}
              </g>
            ))}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {tieneObjetivo && fact.length > 0 && (
          <>
            <Boton variante="secundario" onClick={() => setAnimando(true)} disabled={animando}>
              {animando ? "Moviendo…" : "▶ Mover la recta de Z"}
            </Boton>
            <label className="flex min-w-[220px] flex-1 items-center gap-3 text-[13px] text-ash">
              Z
              <input
                type="range"
                min={lo}
                max={hi}
                step={(hi - lo) / 400}
                value={zActual}
                onChange={(e) => {
                  setAnimando(false);
                  setZ(Number(e.target.value));
                }}
                aria-label="Valor de Z de la recta objetivo"
                className="w-full accent-[#ffd500]"
              />
              <span className="w-16 text-right tabular-nums text-porcelain">{formatear(zActual)}</span>
            </label>
            <Boton variante="secundario" onClick={() => setZ(null)}>
              Ir al óptimo
            </Boton>
          </>
        )}
        <label className="flex items-center gap-2 text-[13px] text-ash">
          <input type="checkbox" checked={noFact} onChange={(e) => setNoFact(e.target.checked)} />
          Mostrar intersecciones no factibles
        </label>
      </div>

      {sinRegion && <p className="mt-3 rounded-[16px] border border-[#ff453a] p-3 text-[14px] text-porcelain">No hay región factible: las restricciones se contradicen.</p>}
      {!g.acotada && !sinRegion && (
        <p className="mt-3 rounded-[16px] border border-steel p-3 text-[14px] text-porcelain">La región factible no está acotada en la dirección de mejora (se muestra recortada al borde del gráfico): Z puede mejorar sin límite.</p>
      )}

      <ul className="mt-4 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
        {g.rectas.map((r, i) => (
          <li key={r.nombre} className="flex items-center gap-2 text-porcelain">
            <span className="inline-block h-2.5 w-5 rounded-full" style={{ background: COLORES[i % COLORES.length] }} />
            <strong>{r.nombre}</strong>: {eq(r)}
          </li>
        ))}
        <li className="flex items-center gap-2 text-porcelain">
          <span className="inline-block h-2.5 w-5 rounded-full bg-[#2997ff]/40" /> Región factible (con {v1}, {v2} ≥ 0)
        </li>
        {tieneObjetivo && (
          <li className="flex items-center gap-2 text-porcelain">
            <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-optical-yellow" /> Recta de Z: {formatear(g.objetivo.c1)}{v1} + {formatear(g.objetivo.c2)}{v2} = Z
          </li>
        )}
      </ul>

      <div className="mt-5 overflow-auto rounded-[20px] border border-steel">
        <table className="w-full min-w-[420px] border-collapse text-[13px]">
          <thead className="bg-carbon">
            <tr>
              <th className="p-2.5 text-left font-medium text-ash">Vértice</th>
              <th className="p-2.5 text-right font-medium text-ash">({v1}, {v2})</th>
              <th className="p-2.5 text-right font-medium text-ash">Z</th>
              <th className="p-2.5 text-right font-medium text-ash">¿Factible?</th>
            </tr>
          </thead>
          <tbody>
            {[...g.vertices]
              .sort((a, b) => Number(b.factible) - Number(a.factible) || (g.objetivo.maximizar ? b.z - a.z : a.z - b.z))
              .filter((v) => v.factible || noFact)
              .map((v, i) => (
                <tr key={i} className={`border-t border-steel ${v.optimo ? "bg-[#30d158]/15" : ""}`}>
                  <td className="p-2.5 text-porcelain">{v.optimo ? "★ Óptimo" : v.factible ? `Vértice ${i + 1}` : "Intersección"}</td>
                  <td className="p-2.5 text-right tabular-nums text-porcelain">({formatear(v.x)}, {formatear(v.y)})</td>
                  <td className="p-2.5 text-right tabular-nums text-porcelain">{formatear(v.z)}</td>
                  <td className={`p-2.5 text-right ${v.factible ? "text-[#30d158]" : "text-ash"}`}>{v.factible ? "Sí" : "No"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
