"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { dinero, numero, type Problema, type Solucion } from "@/lib/api";
import { hojasUbicacion } from "@/lib/exportar";
import { Contador } from "./Contador";
import { Exportar } from "./Exportar";
import { PasosUbicacion } from "./PasosUbicacion";
import { RedLogistica } from "./RedLogistica";
import { mapaUbicacion } from "@/lib/mapa";
import { MapaRed } from "./MapaRed";
import { Boton, Seccion } from "./ui";

export function Metrica({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] bg-obsidian p-6">
      <p className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">{children}</p>
      <p className="mt-2 text-[14px] tracking-[-0.224px] text-ash">{etiqueta}</p>
    </div>
  );
}

export function Barra({ etiqueta, uso, capacidad, pct }: { etiqueta: string; uso: number; capacidad: number | null; pct: number | null }) {
  const reducir = useReducedMotion();
  return (
    <div>
      <div className="flex flex-wrap justify-between gap-x-4 text-[14px] tracking-[-0.224px]">
        <span className="text-porcelain">{etiqueta}</span>
        <span className="tabular-nums text-ash">
          {numero(uso)} / {capacidad === null ? "ilimitada" : numero(capacidad)}
          {pct !== null ? ` · ${pct}%` : ""}
        </span>
      </div>
      {pct !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-steel">
          <motion.div
            className={`h-full rounded-full ${pct >= 99.5 ? "bg-optical-yellow" : "bg-apple-blue"}`}
            initial={reducir ? false : { width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}
    </div>
  );
}

export function Tabla({ columnas, filas, resaltar }: { columnas: string[]; filas: (string | number)[][]; resaltar?: boolean[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const hay = !!resaltar && resaltar.some(Boolean);
  const primera = hay ? resaltar.findIndex(Boolean) : -1;
  useEffect(() => {
    const c = caja.current;
    if (!c || primera < 0) return;
    const tr = c.querySelectorAll("tbody tr")[primera] as HTMLElement | undefined;
    if (tr) c.scrollTo({ top: Math.max(0, tr.offsetTop - 44), behavior: "smooth" });
  }, [primera, hay]);
  return (
    <div ref={caja} className="max-h-72 overflow-auto rounded-[20px] border border-steel">
      <table className="w-full min-w-[420px] border-collapse text-[13px]">
        <thead className="sticky top-0 bg-carbon">
          <tr>
            {columnas.map((c, j) => (
              <th key={j} scope="col" className={`p-2.5 font-medium text-ash ${j >= columnas.length - 2 ? "text-right" : "text-left"}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr
              key={i}
              className={`border-t border-steel transition-opacity ${hay ? (resaltar![i] ? "bg-slate/60 font-semibold" : "opacity-40") : ""}`}
              aria-current={hay && resaltar![i] ? "true" : undefined}
            >
              {f.map((v, j) => (
                <td key={j} className={`p-2.5 tabular-nums text-porcelain ${j >= columnas.length - 2 ? "text-right" : ""}`}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Resultados({ solucion, problema }: { solucion: Solucion; problema: Problema }) {
  const reducir = useReducedMotion();
  const [todas, setTodas] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const comp = solucion.comparacion;
  const maxCosto = comp ? Math.max(...comp.map((f) => f.costo_total)) : 1;
  const segundo = comp && comp.length > 1 ? comp[1] : null;
  const dif = segundo ? segundo.costo_total - solucion.costo_total : 0;

  return (
    <div className="imprimible space-y-6">
      <Exportar titulo="Ubicación de almacenes" archivo="ubicacion-almacenes" hojas={() => hojasUbicacion(problema, solucion)} />
      <div className="overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
        <RedLogistica problema={problema} solucion={solucion} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica etiqueta="Costo mensual total">
          <Contador valor={solucion.costo_total} formato={dinero} />
        </Metrica>
        <Metrica etiqueta="Costos fijos">
          <Contador valor={solucion.costo_fijo_total} formato={dinero} />
        </Metrica>
        <Metrica etiqueta="Transporte">
          <Contador valor={solucion.costo_transporte_total} formato={dinero} />
        </Metrica>
      </div>

      <p className="text-[17px] leading-[1.47] tracking-[-0.374px] text-porcelain">
        Abrir {solucion.almacenes_abiertos.length} de {problema.almacenes.length} almacenes:{" "}
        <strong>{solucion.almacenes_abiertos.join(", ")}</strong>.
        {segundo && (
          <span className="text-ash">
            {" "}
            {dif > 0.5
              ? `Es ${dinero(dif)} más barato que la siguiente mejor combinación.`
              : "Empata en costo con otra combinación."}
          </span>
        )}
      </p>

      <Seccion titulo="Utilización" nota="Cuánto de su capacidad usa cada planta y cada almacén abierto.">
        <div className="space-y-5">
          {solucion.detalle_plantas.map((p) => (
            <Barra key={`p-${p.planta}`} etiqueta={`Planta · ${p.planta}`} uso={p.uso} capacidad={p.capacidad} pct={p.utilizacion_pct} />
          ))}
          {solucion.detalle_almacenes.map((a) => (
            <Barra key={`a-${a.almacen}`} etiqueta={`Almacén · ${a.almacen}`} uso={a.uso} capacidad={a.capacidad} pct={a.utilizacion_pct} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Comparación de combinaciones" nota="Costo mensual total de cada conjunto factible de almacenes, de menor a mayor.">
        {comp ? (
          <>
            <div className="mb-4 flex gap-5 text-[12px] text-ash">
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate" />Costo fijo</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-apple-blue" />Transporte</span>
            </div>
            <ul className="space-y-4">
              {comp.slice(0, todas ? undefined : 8).map((f, i) => (
                <li key={f.almacenes.join("|")}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-[14px] tracking-[-0.224px]">
                    <span className={i === 0 ? "font-semibold text-porcelain" : "text-ash"}>
                      {f.almacenes.join(" · ")}
                      {i === 0 && <span className="ml-2 text-electric-link">Óptimo</span>}
                    </span>
                    <span className="tabular-nums text-porcelain">{dinero(f.costo_total)}</span>
                  </div>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-steel/50">
                    <motion.div
                      className="h-full bg-slate"
                      initial={reducir ? false : { width: 0 }}
                      animate={{ width: `${(f.costo_fijo / maxCosto) * 100}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                    <motion.div
                      className="h-full bg-apple-blue"
                      initial={reducir ? false : { width: 0 }}
                      animate={{ width: `${(f.costo_transporte / maxCosto) * 100}%` }}
                      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            {comp.length > 8 && (
              <Boton variante="enlace" className="mt-4" onClick={() => setTodas((v) => !v)}>
                {todas ? "Mostrar menos" : `Mostrar las ${comp.length} combinaciones`}
              </Boton>
            )}
          </>
        ) : (
          <p className="text-[14px] text-ash">La comparación de combinaciones está disponible hasta 8 almacenes.</p>
        )}
      </Seccion>

      <MapaRed datos={mapaUbicacion(problema, solucion)} seleccion={sel} onSeleccion={setSel} />

      <Seccion titulo="Plan de envíos" nota="Unidades enviadas en cada tramo, en las mismas unidades que tu demanda.">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[14px] font-semibold text-porcelain">Planta → almacén</p>
            <Tabla
              columnas={["Planta", "Almacén", "Unidades", "Costo/u."]}
              filas={solucion.envios_planta_almacen.map((e) => [e.planta, e.almacen, numero(e.unidades), numero(e.costo_unitario)])}
              resaltar={solucion.envios_planta_almacen.map((e) => sel === `p:${e.planta}` || sel === `a:${e.almacen}`)}
            />
          </div>
          <div>
            <p className="mb-2 text-[14px] font-semibold text-porcelain">Almacén → cliente</p>
            <Tabla
              columnas={["Almacén", "Cliente", "Unidades", "Costo/u."]}
              filas={solucion.envios_almacen_cliente.map((e) => [e.almacen, e.cliente, numero(e.unidades), numero(e.costo_unitario)])}
              resaltar={solucion.envios_almacen_cliente.map((e) => sel === `a:${e.almacen}` || sel === `c:${e.cliente}`)}
            />
          </div>
        </div>
      </Seccion>

      <div className="no-imprimir">
        <PasosUbicacion key={JSON.stringify(problema)} problema={problema} />
      </div>
    </div>
  );
}
