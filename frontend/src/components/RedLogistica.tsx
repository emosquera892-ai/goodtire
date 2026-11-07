"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Problema, Solucion } from "@/lib/api";

type Tipo = "planta" | "almacen" | "cliente";
type Nodo = { tipo: Tipo; i: number; etiqueta: string; x: number; y: number };
type Arista = { de: Nodo; a: Nodo; u: number };

const W = 960;

function repartir(tipo: Tipo, items: string[], x: number, H: number, margen: number): Nodo[] {
  const n = items.length;
  return items.map((etiqueta, i) => ({
    tipo,
    i,
    etiqueta,
    x,
    y: n === 1 ? H / 2 : margen + (i * (H - margen * 2)) / (n - 1),
  }));
}

function curva(a: Nodo, b: Nodo) {
  const dx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}

const buscar = (nodos: Nodo[], nombre: string) => nodos.find((n) => n.etiqueta === nombre);
const arista = (de: Nodo | undefined, a: Nodo | undefined, u: number): Arista[] => (de && a ? [{ de, a, u }] : []);

export function RedLogistica({
  problema,
  solucion,
}: {
  problema: Pick<Problema, "plantas" | "almacenes" | "clientes">;
  solucion?: Solucion | null;
}) {
  const reducir = useReducedMotion();
  const filas = Math.max(problema.plantas.length, problema.almacenes.length, problema.clientes.length);
  const H = Math.max(460, filas * 26 + 80);
  const plantas = repartir("planta", problema.plantas, 70, H, 56);
  const almacenes = repartir("almacen", problema.almacenes, W / 2, H, 56);
  const clientes = repartir("cliente", problema.clientes, W - 90, H, 36);
  const abiertos = new Set(solucion ? solucion.almacenes_abiertos : problema.almacenes);

  const pa: Arista[] = solucion
    ? solucion.envios_planta_almacen.flatMap((e) => arista(buscar(plantas, e.planta), buscar(almacenes, e.almacen), e.unidades))
    : plantas.length * almacenes.length <= 150
      ? plantas.flatMap((p) => almacenes.map((a) => ({ de: p, a, u: 0 })))
      : [];
  const ac: Arista[] = solucion
    ? solucion.envios_almacen_cliente.flatMap((e) => arista(buscar(almacenes, e.almacen), buscar(clientes, e.cliente), e.unidades))
    : [];

  const maxU = Math.max(1, ...pa.map((e) => e.u), ...ac.map((e) => e.u));
  const grosor = (u: number) => (solucion ? 1 + (u / maxU) * 3 : 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Red logística: plantas, almacenes y clientes" className="h-auto w-full">
      {[...pa, ...ac].map((e, i) => {
        const d = curva(e.de, e.a);
        return (
          <g key={`${e.de.tipo}${e.de.i}-${e.a.tipo}${e.a.i}`}>
            <path d={d} fill="none" stroke="#333336" strokeWidth={grosor(e.u)} opacity={solucion ? 0.9 : 0.35} />
            {solucion && (
              <path
                d={d}
                fill="none"
                stroke="#2997ff"
                strokeWidth={Math.max(1.5, grosor(e.u) - 0.5)}
                strokeLinecap="round"
                className="flow-line"
                style={{ animationDelay: `${(i % 7) * 0.15}s` }}
              />
            )}
          </g>
        );
      })}

      {[...plantas, ...almacenes, ...clientes].map((n, k) => {
        const cerrado = n.tipo === "almacen" && !abiertos.has(n.etiqueta);
        const color = n.tipo === "planta" ? "#ffd500" : n.tipo === "almacen" ? "#0071e3" : "#f5f5f7";
        const r = n.tipo === "almacen" ? 14 : n.tipo === "planta" ? 16 : 7;
        const lado = n.tipo === "cliente" ? "start" : n.tipo === "planta" ? "end" : "middle";
        const dx = n.tipo === "cliente" ? 14 : n.tipo === "planta" ? -24 : 0;
        const dy = n.tipo === "almacen" ? -22 : 4;
        return (
          <motion.g
            key={`${n.tipo}-${n.i}`}
            initial={reducir ? false : { opacity: 0, scale: 0.6 }}
            animate={{ opacity: cerrado ? 0.28 : 1, scale: 1 }}
            transition={{ duration: 0.6, delay: reducir ? 0 : Math.min(k, 40) * 0.04, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: "fill-box" }}
          >
            {n.tipo === "almacen" && !cerrado && (
              <circle cx={n.x} cy={n.y} r={r + 9} fill={color} opacity={0.16} className="respirar" />
            )}
            <circle cx={n.x} cy={n.y} r={r} fill={color} />
            <text
              x={n.x + dx}
              y={n.y + dy}
              textAnchor={lado}
              fontSize={n.tipo === "cliente" ? 11 : 12}
              fill={cerrado ? "#6e6e73" : "#f5f5f7"}
              fontWeight={n.tipo === "cliente" ? 400 : 600}
            >
              {n.etiqueta}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}
