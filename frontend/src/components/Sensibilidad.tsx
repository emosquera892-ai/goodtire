"use client";

import { useState } from "react";
import { ErrorApi, dinero, type Problema } from "@/lib/api";
import { analizarSensibilidad, type FilaSens, type Sensibilidad as Datos } from "@/lib/sensibilidad";
import { Boton, Seccion } from "./ui";

const signo = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const pctTxt = (n: number) => `${signo(n)}${Math.abs(n).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
const VARIACIONES = [-30, -20, -10, 0, 10, 20, 30];

function Celda({ f }: { f: FilaSens | undefined }) {
  if (!f) return <td className="px-3 py-2 text-center text-ash">{"—"}</td>;
  if (f.omitido) return <td className="px-3 py-2 text-center text-ash">{"—"}</td>;
  if (!f.factible) return <td className="px-3 py-2 text-center text-[#ff453a]">Sin solución</td>;
  return (
    <td
      className={`px-3 py-2 text-center ${f.cambia_decision ? "rounded-xl bg-apple-blue/20 font-medium text-porcelain" : "text-porcelain"}`}
      title={f.cambia_decision ? `Abriría: ${f.abiertos.join(", ")}` : "Los mismos almacenes"}
    >
      {pctTxt(f.cambio_pct ?? 0)}
      {f.cambia_decision && <span aria-label="cambia la decisión"> ◆</span>}
    </td>
  );
}

/** Qué pasa con el costo y con los almacenes abiertos si cambian los datos. Se calcula al pulsar el botón. */
export function Sensibilidad({ problema }: { problema: Problema }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function analizar() {
    setCargando(true);
    setError("");
    try {
      setDatos(await analizarSensibilidad(problema));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.detalle.join(" ") : "No se pudo calcular la sensibilidad.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Seccion
      id="sensibilidad"
      titulo="¿Qué pasa si cambian los datos?"
      nota="Análisis de sensibilidad: se vuelve a resolver el caso subiendo o bajando un grupo de datos y se compara con la solución actual."
      className="no-imprimir"
      acciones={
        <Boton disabled={cargando} onClick={() => void analizar()}>
          {cargando ? "Calculando…" : datos ? "Recalcular" : "Analizar sensibilidad"}
        </Boton>
      }
    >
      {error && <p className="text-[14px] text-[#ff453a]">{error}</p>}
      {!datos && !error && (
        <p className="text-[14px] text-ash">Pulsa «Analizar sensibilidad». Tarda unos segundos: resuelve el problema decenas de veces con datos distintos.</p>
      )}
      {datos && (
        <div className="space-y-8">
          <div>
            <h4 className="text-[19px] font-semibold text-porcelain">Lo más importante</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.5] text-porcelain">
              {datos.lectura.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {datos.incompleto && <p className="mt-2 text-[13px] text-optical-yellow">Se alcanzó el tiempo máximo: faltan algunos escenarios.</p>}
          </div>

          <div>
            <h4 className="text-[19px] font-semibold text-porcelain">Cambio del costo total según cada dato</h4>
            <p className="mt-1 text-[14px] text-ash">
              Base: {dinero(datos.base.costo_total)} con {datos.base.abiertos.join(", ")}. Cada fila sube o baja todos los valores de esa columna el porcentaje indicado.{" "}
              <span className="text-porcelain">◆ = cambian los almacenes que conviene abrir</span> (pasa el cursor para ver cuáles).
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-[14px]">
                <thead>
                  <tr className="text-ash">
                    <th className="px-3 py-2 text-left font-normal">Variación</th>
                    {datos.escenarios.map((e) => (
                      <th key={e.parametro} className="px-3 py-2 text-center font-normal">
                        {e.etiqueta}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {VARIACIONES.map((pct) => (
                    <tr key={pct} className="border-t border-white/10">
                      <td className="px-3 py-2 text-porcelain">{pct === 0 ? "Datos actuales" : pctTxt(pct)}</td>
                      {datos.escenarios.map((e) =>
                        pct === 0 ? (
                          <td key={e.parametro} className="px-3 py-2 text-center text-ash">
                            {"—"}
                          </td>
                        ) : (
                          <Celda key={e.parametro} f={e.variaciones.find((v) => v.pct === pct)} />
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-[19px] font-semibold text-porcelain">¿Y si se cierra o se abre un almacén?</h4>
            <p className="mt-1 text-[14px] text-ash">Se obliga a cerrar cada almacén abierto y a abrir cada cerrado, y se mide cuánto sube el costo.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-[14px]">
                <thead>
                  <tr className="text-ash">
                    <th className="px-3 py-2 font-normal">Almacén</th>
                    <th className="px-3 py-2 font-normal">Hoy</th>
                    <th className="px-3 py-2 font-normal">Si se…</th>
                    <th className="px-3 py-2 text-right font-normal">Costo total</th>
                    <th className="px-3 py-2 text-right font-normal">Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.almacenes.map((a) => (
                    <tr key={a.almacen} className="border-t border-white/10 text-porcelain">
                      <td className="px-3 py-2">{a.almacen}</td>
                      <td className="px-3 py-2">{a.abierto_base ? "Abierto" : "Cerrado"}</td>
                      <td className="px-3 py-2">{a.accion === "cerrar" ? "cierra" : "abre"}</td>
                      {a.factible ? (
                        <>
                          <td className="px-3 py-2 text-right">{dinero(a.costo_total ?? 0)}</td>
                          <td className="px-3 py-2 text-right">
                            +{dinero(a.cambio ?? 0)} ({pctTxt(a.cambio_pct ?? 0)})
                          </td>
                        </>
                      ) : (
                        <td colSpan={2} className="px-3 py-2 text-right text-[#ff453a]">
                          Sin solución: es indispensable
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Seccion>
  );
}
