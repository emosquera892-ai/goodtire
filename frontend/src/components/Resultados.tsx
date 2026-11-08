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

const pctTxt = (p: number) => `${p.toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;

export function Barra({ etiqueta, uso, capacidad, pct }: { etiqueta: string; uso: number; capacidad: number | null; pct: number | null }) {
  const reducir = useReducedMotion();
  const lleno = pct !== null && pct >= 99.5;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[14px] tracking-[-0.224px]">
        <span className="font-medium text-porcelain">{etiqueta}</span>
        <span className="tabular-nums text-ash">
          {capacidad === null || pct === null ? (
            <>Usa {numero(uso)} · sin límite de capacidad</>
          ) : (
            <>
              Usa {numero(uso)} de {numero(capacidad)} <strong className="text-porcelain">({pctTxt(pct)})</strong>
            </>
          )}
        </span>
      </div>
      {pct !== null && capacidad !== null && (
        <>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-steel">
            <motion.div
              className={`h-full rounded-full ${lleno ? "bg-optical-yellow" : "bg-apple-blue"}`}
              initial={reducir ? false : { width: 0 }}
              animate={{ width: `${Math.min(100, pct)}%` }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <p className={`mt-1 text-[12px] ${lleno ? "text-optical-yellow" : "text-ash"}`}>
            {lleno ? "Al límite: no puede manejar más" : `Le quedan ${numero(Math.max(0, capacidad - uso))} libres`}
          </p>
        </>
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
        <thead>
          <tr>
            {columnas.map((c, j) => (
              <th key={j} scope="col" className={`sticky top-0 z-10 bg-carbon p-2.5 font-medium text-ash shadow-[0_1px_0_var(--color-steel)] ${j >= columnas.length - 2 ? "text-right" : "text-left"}`}>
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

      <Seccion titulo="Utilización" nota="Qué parte de su capacidad usa cada planta y cada almacén abierto. Una barra amarilla significa que ya no puede manejar más.">
        <div className="space-y-5">
          {solucion.detalle_plantas.map((p) => (
            <Barra key={`p-${p.planta}`} etiqueta={`Planta · ${p.planta}`} uso={p.uso} capacidad={p.capacidad} pct={p.utilizacion_pct} />
          ))}
          {solucion.detalle_almacenes.map((a) => (
            <Barra key={`a-${a.almacen}`} etiqueta={`Almacén · ${a.almacen}`} uso={a.uso} capacidad={a.capacidad} pct={a.utilizacion_pct} />
          ))}
        </div>
        <div className="mt-6 space-y-1 border-t border-steel pt-4 text-[14px] leading-[1.5] text-ash">
          {(() => {
            const llenos = solucion.detalle_almacenes.filter((x) => x.utilizacion_pct >= 99.5).map((x) => x.almacen);
            const cerrados = problema.almacenes.filter((x) => !solucion.almacenes_abiertos.includes(x));
            return (
              <>
                <p>
                  <strong className="text-porcelain">Cómo leerlo: </strong>
                  {llenos.length > 0
                    ? `${llenos.join(" y ")} ${llenos.length > 1 ? "están" : "está"} al límite; si la demanda crece, ahí estaría el cuello de botella.`
                    : "Ningún almacén está al límite: hay margen para que crezca la demanda."}
                </p>
                {cerrados.length > 0 && (
                  <p>
                    <strong className="text-porcelain">No se abre: </strong>
                    {cerrados.join(", ")}.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      </Seccion>

      <Seccion
        titulo="Comparación de combinaciones"
        nota="Cada fila es una forma distinta de elegir qué almacenes abrir. Gana la de menor costo total; las demás muestran cuánto más cuestan."
      >
        {comp ? (
          <>
            <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ash">
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-slate" />Costo fijo (abrir almacenes)</span>
              <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-apple-blue" />Transporte</span>
              <span><span className="mr-1.5 inline-block h-3 w-0.5 translate-y-0.5 bg-porcelain" />Costo de la mejor opción</span>
            </div>
            <ul className="space-y-5">
              {comp.slice(0, todas ? undefined : 8).map((f, i) => {
                const extra = f.costo_total - comp[0].costo_total;
                const cierra = problema.almacenes.filter((x) => !f.almacenes.includes(x));
                return (
                  <li key={f.almacenes.join("|")}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[12px] font-semibold ${i === 0 ? "bg-apple-blue text-white" : "bg-steel text-ash"}`}>{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[14px] tracking-[-0.224px]">
                          <span className={i === 0 ? "font-semibold text-porcelain" : "text-porcelain"}>
                            Abre: {f.almacenes.join(", ")}
                            {i === 0 && <span className="ml-2 rounded-full bg-apple-blue/20 px-2 py-0.5 text-[12px] font-semibold text-electric-link">Mejor opción</span>}
                          </span>
                          <span className="tabular-nums">
                            <strong className="text-porcelain">{dinero(f.costo_total)}</strong>
                            {i > 0 && (
                              <span className="ml-2 text-optical-yellow">
                                +{dinero(extra)} ({pctTxt((extra / comp[0].costo_total) * 100)})
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-ash">
                          {cierra.length > 0 ? `Cierra: ${cierra.join(", ")} · ` : "No cierra ninguno · "}
                          Fijo {dinero(f.costo_fijo)} + transporte {dinero(f.costo_transporte)}
                        </p>
                        <div className="relative mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-steel/50">
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
                          <span aria-hidden className="absolute inset-y-0 w-0.5 bg-porcelain" style={{ left: `${(comp[0].costo_total / maxCosto) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
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

      <Seccion id="plan" titulo="Plan de envíos" nota="Unidades enviadas en cada tramo, en las mismas unidades que tu demanda.">
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
