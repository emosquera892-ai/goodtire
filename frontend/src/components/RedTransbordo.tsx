"use client";

import { motion, useReducedMotion } from "motion/react";
import type { TipoNodo } from "@/lib/transbordo";

type Nodo = { tipo: TipoNodo; i: number; etiqueta: string; x: number; y: number };
type Flujos = { flujos: { desde: string; hasta: string; unidades: number }[] };

const W = 960;
const COLX: Record<TipoNodo, number> = { origen: 110, intermedio: W / 2, destino: W - 110 };
const COLOR: Record<TipoNodo, string> = { origen: "#ffd500", intermedio: "#2997ff", destino: "#f5f5f7" };

function curva(a: Nodo, b: Nodo) {
  if (a.x === b.x) {
    const k = 70;
    return `M ${a.x} ${a.y} C ${a.x + k} ${a.y}, ${b.x + k} ${b.y}, ${b.x} ${b.y}`;
  }
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

export function RedTransbordo({
  nodos,
  solucion,
}: {
  nodos: { nombre: string; tipo: TipoNodo }[];
  solucion?: Flujos | null;
}) {
  const reducir = useReducedMotion();
  const cols: Record<TipoNodo, number> = { origen: 0, intermedio: 0, destino: 0 };
  nodos.forEach((n) => void cols[n.tipo]++);
  const H = Math.max(420, Math.max(cols.origen, cols.intermedio, cols.destino) * 30 + 80);
  const visto: Record<TipoNodo, number> = { origen: 0, intermedio: 0, destino: 0 };
  const N: Nodo[] = nodos.map((n, i) => {
    const k = visto[n.tipo]++;
    const tot = cols[n.tipo];
    return { tipo: n.tipo, i, etiqueta: n.nombre, x: COLX[n.tipo], y: tot === 1 ? H / 2 : 60 + (k * (H - 100)) / (tot - 1) };
  });

  const aristas = solucion
    ? solucion.flujos.flatMap((f) => {
        const a = N.find((n) => n.etiqueta === f.desde);
        const b = N.find((n) => n.etiqueta === f.hasta);
        return a && b ? [{ a, b, u: f.unidades }] : [];
      })
    : [];
  const maxU = Math.max(1, ...aristas.map((e) => e.u));
  const grosor = (u: number) => 1 + (u / maxU) * 3.5;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Red de transbordo: orígenes, intermedios y destinos" className="h-auto w-full">
      {(["origen", "intermedio", "destino"] as TipoNodo[]).map((t) => (
        <text key={t} x={COLX[t]} y={16} textAnchor="middle" fontSize={11} fill="#86868b">
          {t === "origen" ? "ORÍGENES" : t === "intermedio" ? "INTERMEDIOS" : "DESTINOS"}
        </text>
      ))}
      {aristas.map((e, k) => {
        const d = curva(e.a, e.b);
        return (
          <g key={`${e.a.i}-${e.b.i}`}>
            <path d={d} fill="none" stroke="#333336" strokeWidth={grosor(e.u)} opacity={0.9} />
            <path
              d={d}
              fill="none"
              stroke="#2997ff"
              strokeWidth={Math.max(1.5, grosor(e.u) - 0.5)}
              strokeLinecap="round"
              className="flow-line"
              style={{ animationDelay: `${(k % 7) * 0.15}s` }}
            />
          </g>
        );
      })}
      {N.map((n, k) => (
        <motion.g
          key={n.i}
          initial={reducir ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: reducir ? 0 : Math.min(k, 40) * 0.04, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "fill-box" }}
        >
          <circle cx={n.x} cy={n.y} r={n.tipo === "origen" ? 14 : n.tipo === "intermedio" ? 11 : 8} fill={COLOR[n.tipo]} />
          <text
            x={n.x + (n.tipo === "origen" ? -24 : n.tipo === "intermedio" ? 0 : 16)}
            y={n.y + (n.tipo === "intermedio" ? -20 : 4)}
            textAnchor={n.tipo === "origen" ? "end" : n.tipo === "intermedio" ? "middle" : "start"}
            fontSize={12}
            fill="#f5f5f7"
            fontWeight={n.tipo === "destino" ? 400 : 600}
          >
            {n.etiqueta}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}
