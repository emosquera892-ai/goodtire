"use client";

import { useState } from "react";
import { ErrorApi, dinero } from "@/lib/api";
import { analizarSensibilidadRedes, type FilaRedes, type SensibilidadRedes as Datos, type TipoSensRedes } from "@/lib/sensibilidad";
import { Boton, Seccion } from "./ui";

const signo = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
const pctTxt = (n: number) => `${signo(n)}${Math.abs(n).toLocaleString("es-CO", { maximumFractionDigits: 1 })} %`;
const num = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });
const VARIACIONES = [-30, -20, -10, 0, 10, 20, 30];

function Celda({ f }: { f: FilaRedes | undefined }) {
  if (!f) return <td className="px-3 py-2 text-center text-ash">{"—"}</td>;
  if (!f.factible) return <td className="px-3 py-2 text-center text-[13px] text-[#ff453a]">{f.nota || "Sin solución"}</td>;
  return (
    <td
      className={`px-3 py-2 text-center ${f.cambia_decision ? "rounded-xl bg-apple-blue/20 font-medium text-porcelain" : "text-porcelain"}`}
      title={f.cambia_decision ? "Cambia el plan" : "Mismo plan"}
    >
      {pctTxt(f.cambio_pct ?? 0)}
      {f.cambia_decision && <span aria-label="cambia el plan"> ◆</span>}
    </td>
  );
}

/** Sensibilidad de Transporte, Transbordo y Asignación: se calcula al pulsar el botón. */
export function SensibilidadRedes({ tipo, datos, dinero: moneda = true }: { tipo: TipoSensRedes; datos: unknown; dinero?: boolean }) {
  const [res, setRes] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const fmt = (n: number) => (moneda ? dinero(n) : num(n));
  const esAsignacion = tipo === "asignacion";
  const maximiza = res?.base.objetivo === "maximizar";

  async function analizar() {
    setCargando(true);
    setError("");
    try {
      setRes(await analizarSensibilidadRedes(tipo, datos));
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
      nota={
        esAsignacion
          ? "Análisis de sensibilidad: hasta dónde puede cambiar el valor de cada asignación antes de que convenga otra, y cuánto cuesta prohibirla."
          : "Análisis de sensibilidad: se vuelve a resolver el caso subiendo o bajando un grupo de datos y se compara con el plan actual."
      }
      className="no-imprimir"
      acciones={
        <Boton disabled={cargando} onClick={() => void analizar()}>
          {cargando ? "Calculando…" : res ? "Recalcular" : "Analizar sensibilidad"}
        </Boton>
      }
    >
      {error && <p className="text-[14px] text-[#ff453a]">{error}</p>}
      {!res && !error && <p className="text-[14px] text-ash">Pulsa «Analizar sensibilidad». Tarda unos segundos.</p>}
      {res && (
        <div className="space-y-8">
          <div>
            <h4 className="text-[19px] font-semibold text-porcelain">Lo más importante</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.5] text-porcelain">
              {res.lectura.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {res.incompleto && <p className="mt-2 text-[13px] text-optical-yellow">Se alcanzó el tiempo máximo: faltan algunos escenarios.</p>}
          </div>

          {res.escenarios.length > 0 && (
            <div>
              <h4 className="text-[19px] font-semibold text-porcelain">Cambio del costo total según cada dato</h4>
              <p className="mt-1 text-[14px] text-ash">
                Base: {fmt(res.base.costo_total)}. Cada fila sube o baja todos los valores de esa columna el porcentaje indicado.{" "}
                <span className="text-porcelain">◆ = cambia el plan de envíos.</span>
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-[14px]">
                  <thead>
                    <tr className="text-ash">
                      <th className="px-3 py-2 text-left font-normal">Variación</th>
                      {res.escenarios.map((e) => (
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
                        {res.escenarios.map((e) =>
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
          )}

          {res.alternativas.length > 0 && (
            <div>
              <h4 className="text-[19px] font-semibold text-porcelain">{esAsignacion ? "Estabilidad de cada asignación" : "¿Y si se bloquea una ruta?"}</h4>
              <p className="mt-1 text-[14px] text-ash">
                {esAsignacion
                  ? `«Puede ${maximiza ? "bajar" : "subir"} hasta» es el valor a partir del cual esa pareja deja de ser la mejor. «Si se prohíbe» es el resultado total sin ella.`
                  : "Se bloquea cada ruta que usa el plan y se mide cuánto sube el costo."}
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[14px]">
                  <thead>
                    <tr className="text-ash">
                      <th className="px-3 py-2 font-normal">{esAsignacion ? "Asignación" : "Ruta"}</th>
                      <th className="px-3 py-2 text-right font-normal">{esAsignacion ? "Valor actual" : "Costo/u. actual"}</th>
                      {esAsignacion && <th className="px-3 py-2 text-right font-normal">Puede {maximiza ? "bajar" : "subir"} hasta</th>}
                      <th className="px-3 py-2 text-right font-normal">{esAsignacion ? "Si se prohíbe" : "Costo total"}</th>
                      <th className="px-3 py-2 text-right font-normal">Cambio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.alternativas.map((a) => (
                      <tr key={a.etiqueta} className="border-t border-white/10 text-porcelain">
                        <td className="px-3 py-2">{a.etiqueta}</td>
                        <td className="px-3 py-2 text-right">{num(a.costo_actual ?? 0)}</td>
                        {esAsignacion && <td className="px-3 py-2 text-right">{a.limite != null ? num(a.limite) : "—"}</td>}
                        {a.factible ? (
                          <>
                            <td className="px-3 py-2 text-right">{fmt(a.costo_total ?? 0)}</td>
                            <td className="px-3 py-2 text-right">
                              {signo(a.cambio ?? 0)}
                              {fmt(Math.abs(a.cambio ?? 0))} ({pctTxt(a.cambio_pct ?? 0)})
                            </td>
                          </>
                        ) : (
                          <td colSpan={2} className="px-3 py-2 text-right text-[#ff453a]">
                            {a.nota === "Sin solución" ? "Sin solución: es indispensable" : a.nota}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Seccion>
  );
}
