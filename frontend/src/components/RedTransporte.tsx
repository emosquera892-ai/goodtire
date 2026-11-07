"use client";

import { motion, useReducedMotion } from "motion/react";
import type { SolucionT } from "@/lib/transporte";

type Nodo = { tipo: "origen" | "destino"; i: number; etiqueta: string; x: number; y: number };
const W = 960;

function repartir(tipo: Nodo["tipo"], items: string[], x: number, H: number): Nodo[] {
  const n = items.length;
  return items.map((etiqueta, i) => ({ tipo, i, etiqueta, x, y: n === 1 ? H / 2 : 40 + (i * (H - 80)) / (n - 1) }));
}

const curva = (a: Nodo, b: Nodo) => {
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};

export function RedTransporte({
  origenes,
  destinos,
  solucion,
}: {
  origenes: string[];
  destinos: string[];
  solucion?: SolucionT | null;
}) {
  const reducir = useReducedMotion();
  const H = Math.max(420, Math.max(origenes.length, destinos.length) * 26 + 80);
  const O = repartir("origen", origenes, 110, H);
  const D = repartir("destino", destinos, W - 110, H);

  const aristas = solucion
    ? solucion.envios.flatMap((e) => {
        const a = O.find((n) => n.etiqueta === e.origen);
        const b = D.find((n) => n.etiqueta === e.destino);
        return a && b ? [{ a, b, u: e.unidades }] : [];
      })
    : O.length * D.length <= 150
      ? O.flatMap((a) => D.map((b) => ({ a, b, u: 0 })))
      : [];
  const maxU = Math.max(1, ...aristas.map((e) => e.u));
  const grosor = (u: number) => (solucion ? 1 + (u / maxU) * 3.5 : 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Red de transporte: orígenes y destinos" className="h-auto w-full">
      {aristas.map((e, k) => {
        const d = curva(e.a, e.b);
        return (
          <g key={`${e.a.i}-${e.b.i}`}>
            <path d={d} fill="none" stroke="#333336" strokeWidth={grosor(e.u)} opacity={solucion ? 0.9 : 0.35} />
            {solucion && (
              <path
                d={d}
                fill="none"
                stroke="#2997ff"
                strokeWidth={Math.max(1.5, grosor(e.u) - 0.5)}
                strokeLinecap="round"
                className="flow-line"
                style={{ animationDelay: `${(k % 7) * 0.15}s` }}
              />
            )}
          </g>
        );
      })}
      {[...O, ...D].map((n, k) => (
        <motion.g
          key={`${n.tipo}-${n.i}`}
          initial={reducir ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: reducir ? 0 : Math.min(k, 40) * 0.04, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "fill-box" }}
        >
          <circle cx={n.x} cy={n.y} r={n.tipo === "origen" ? 14 : 8} fill={n.tipo === "origen" ? "#ffd500" : "#f5f5f7"} />
          <text
            x={n.x + (n.tipo === "origen" ? -24 : 16)}
            y={n.y + 4}
            textAnchor={n.tipo === "origen" ? "end" : "start"}
            fontSize={12}
            fill="#f5f5f7"
            fontWeight={n.tipo === "origen" ? 600 : 400}
          >
            {n.etiqueta}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}
