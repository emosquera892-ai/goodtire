"use client";

import { useMemo, useRef, useState } from "react";
import { ErrorApi } from "@/lib/api";
import {
  LIMITES_S,
  agregarRestriccion,
  agregarVariable,
  aProblemaS,
  casoVacioS,
  ejemploMax,
  ejemploMin,
  hayErroresS,
  quitarRestriccion,
  quitarVariable,
  resolverS,
  validarS,
  type EstadoS,
  type SolucionS,
  type Signo,
} from "@/lib/simplex";
import { ErroresCampos, enfocarPrimerError } from "./ErroresCampos";
import { GraficoSimplex } from "./GraficoSimplex";
import { Algebraico, Tabular, aplanar } from "./PasosSimplex";
import { Metrica } from "./Resultados";
import { Boton, BotonQuitar, Campo, Seccion, claseCampo } from "./ui";

type Vista = "grafico" | "tabular" | "algebraico";
const mensajes = (e: unknown) => (e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);

export function SolverSimplex() {
  const refResultado = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<EstadoS>(() => ejemploMax());
  const [plantilla, setPlantilla] = useState<"max" | "min" | "vacio" | null>("max");
  const [resultado, setResultado] = useState<SolucionS | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [desactualizado, setDesactualizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string[]>([]);
  const [vista, setVista] = useState<Vista>("grafico");
  const [paso, setPaso] = useState(0);

  const errores = useMemo(() => validarS(estado), [estado]);
  const nCampos = Object.keys(errores.celdas).length;
  const err = (k: string) => (intentado ? errores.celdas[k] : undefined);
  const n = estado.variables.length;

  function cambiar(nuevo: EstadoS) {
    setEstado(nuevo);
    setDesactualizado(true);
  }
  function cargar(nuevo: EstadoS, p: "max" | "min" | "vacio") {
    setEstado(nuevo);
    setPlantilla(p);
    setResultado(null);
    setIntentado(false);
    setDesactualizado(false);
    setErrorServidor([]);
    setPaso(0);
  }

  async function calcular() {
    setIntentado(true);
    setErrorServidor([]);
    if (hayErroresS(errores)) {
      enfocarPrimerError();
      return;
    }
    setCargando(true);
    try {
      const sol = await resolverS(aProblemaS(estado));
      setResultado(sol);
      setVista(sol.grafico ? "grafico" : "tabular");
      setPaso(0);
      setDesactualizado(false);
      requestAnimationFrame(() => refResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setErrorServidor(mensajes(e));
    } finally {
      setCargando(false);
    }
  }

  const pasos = useMemo(() => (resultado ? aplanar(resultado.fases) : []), [resultado]);
  const sol = resultado?.solucion;

  return (
    <section id="resolver" className="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-12">
      <h1 className="text-[clamp(32px,5vw,56px)] font-semibold leading-[1.07] tracking-[-0.015em] text-porcelain">Programación lineal.</h1>
      <p className="mt-3 max-w-2xl text-[17px] leading-[1.47] tracking-[-0.374px] text-ash">
        Escribe cualquier modelo (maximizar o minimizar, con restricciones ≤, ≥ o =) y míralo resuelto: gráfico con la región factible y los vértices (con 2 variables),
        simplex tabular y simplex algebraico, paso a paso. Las variables son siempre ≥ 0.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Boton variante="secundario" activo={plantilla === "max"} onClick={() => cargar(ejemploMax(), "max")}>
          Ejemplo: maximizar (Giapetto)
        </Boton>
        <Boton variante="secundario" activo={plantilla === "min"} onClick={() => cargar(ejemploMin(), "min")}>
          Ejemplo: minimizar (con ≥)
        </Boton>
        <Boton variante="secundario" activo={plantilla === "vacio"} onClick={() => cargar(casoVacioS(), "vacio")}>
          Empezar un caso vacío
        </Boton>
      </div>

      <div className="mt-6 rounded-[28px] bg-carbon p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Modelo</h3>
            <p className="mt-2 text-[14px] text-ash">Función objetivo y restricciones. Usa punto o coma decimal; se permiten negativos.</p>
          </div>
          <div className="flex gap-2">
            <Boton variante="secundario" disabled={n >= LIMITES_S.variables} onClick={() => cambiar(agregarVariable(estado))}>
              + Variable
            </Boton>
            <Boton variante="secundario" disabled={estado.restricciones.length >= LIMITES_S.restricciones} onClick={() => cambiar(agregarRestriccion(estado))}>
              + Restricción
            </Boton>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-x-2 border-spacing-y-2 text-[13px]">
            <thead>
              <tr>
                <th className="w-32 text-left font-normal text-ash" />
                {estado.variables.map((v, j) => (
                  <th key={j} className="min-w-24 font-normal">
                    <div className="flex items-start gap-1">
                      <Campo
                        aria-label={`Nombre de la variable ${j + 1}`}
                        maxLength={LIMITES_S.nombre}
                        value={v}
                        error={err(`v.${j}`)}
                        onChange={(e) => cambiar({ ...estado, variables: estado.variables.map((x, k) => (k === j ? e.target.value : x)) })}
                      />
                      <BotonQuitar aria-label={`Quitar la variable ${j + 1}`} disabled={n <= 1} onClick={() => cambiar(quitarVariable(estado, j))} />
                    </div>
                  </th>
                ))}
                <th className="w-20 text-ash" />
                <th className="min-w-24 font-normal text-ash">Lado derecho</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="text-left align-middle">
                  <select
                    aria-label="Objetivo"
                    value={estado.objetivo}
                    onChange={(e) => cambiar({ ...estado, objetivo: e.target.value as EstadoS["objetivo"] })}
                    className={`${claseCampo()} !rounded-xl`}
                  >
                    <option value="maximizar">Maximizar Z</option>
                    <option value="minimizar">Minimizar Z</option>
                  </select>
                </th>
                {estado.c.map((t, j) => (
                  <td key={j}>
                    <Campo
                      aria-label={`Coeficiente de ${estado.variables[j] || `la variable ${j + 1}`} en Z`}
                      inputMode="decimal"
                      value={t}
                      error={err(`c.${j}`)}
                      onChange={(e) => cambiar({ ...estado, c: estado.c.map((x, k) => (k === j ? e.target.value : x)) })}
                    />
                  </td>
                ))}
                <td colSpan={3} className="text-ash">
                  ← coeficientes de la función objetivo
                </td>
              </tr>
              {estado.restricciones.map((r, i) => (
                <tr key={i}>
                  <th className="text-left font-medium text-porcelain">Restricción {i + 1}</th>
                  {r.a.map((t, j) => (
                    <td key={j}>
                      <Campo
                        aria-label={`Restricción ${i + 1}: coeficiente de ${estado.variables[j] || `la variable ${j + 1}`}`}
                        inputMode="decimal"
                        value={t}
                        error={err(`a.${i}.${j}`)}
                        onChange={(e) =>
                          cambiar({
                            ...estado,
                            restricciones: estado.restricciones.map((x, k) => (k === i ? { ...x, a: x.a.map((y, l) => (l === j ? e.target.value : y)) } : x)),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <select
                      aria-label={`Restricción ${i + 1}: signo`}
                      value={r.signo}
                      onChange={(e) => cambiar({ ...estado, restricciones: estado.restricciones.map((x, k) => (k === i ? { ...x, signo: e.target.value as Signo } : x)) })}
                      className={`${claseCampo()} !rounded-xl text-center`}
                    >
                      <option value="<=">≤</option>
                      <option value=">=">≥</option>
                      <option value="=">=</option>
                    </select>
                  </td>
                  <td>
                    <Campo
                      aria-label={`Restricción ${i + 1}: lado derecho`}
                      inputMode="decimal"
                      value={r.b}
                      error={err(`b.${i}`)}
                      onChange={(e) => cambiar({ ...estado, restricciones: estado.restricciones.map((x, k) => (k === i ? { ...x, b: e.target.value } : x)) })}
                    />
                  </td>
                  <td>
                    <BotonQuitar aria-label={`Quitar la restricción ${i + 1}`} disabled={estado.restricciones.length <= 1} onClick={() => cambiar(quitarRestriccion(estado, i))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] bg-carbon p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <Boton onClick={() => void calcular()} disabled={cargando} className="px-6 py-2.5">
            {cargando ? "Calculando…" : "Resolver"}
          </Boton>
          {intentado && nCampos > 0 && <ErroresCampos n={nCampos} />}
        </div>
        {errorServidor.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-[20px] border border-[#ff453a] p-4 text-[14px] text-porcelain">
            {errorServidor.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        )}
      </div>

      <div ref={refResultado} className="mt-6 scroll-mt-16 space-y-6">
        {resultado && (
          <>
            {desactualizado && (
              <p className="rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">Cambiaste el modelo. Pulsa «Resolver» para actualizar este resultado.</p>
            )}
            <div className="rounded-[28px] bg-carbon p-5 sm:p-8">
              <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Resultado</h3>
              <p className="mt-2 text-[14px] text-ash">{resultado.objetivo_texto}</p>
              {resultado.estado === "optimo" && sol && (
                <>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <Metrica etiqueta="Valor óptimo de Z">{sol.z}</Metrica>
                    {sol.valores.slice(0, 2).map((v) => (
                      <Metrica key={v.variable} etiqueta={v.variable}>
                        {v.valor}
                      </Metrica>
                    ))}
                  </div>
                  {sol.valores.length > 2 && (
                    <p className="mt-3 text-[15px] text-porcelain">
                      {sol.valores.map((v) => `${v.variable} = ${v.valor}`).join(" · ")}
                    </p>
                  )}
                  {(sol.alternativos || sol.degenerada) && (
                    <p className="mt-3 text-[14px] text-ash">
                      {sol.alternativos ? "Hay soluciones óptimas alternativas (otro punto da el mismo Z). " : ""}
                      {sol.degenerada ? "La solución es degenerada (alguna variable básica vale 0)." : ""}
                    </p>
                  )}
                </>
              )}
              {resultado.estado === "infactible" && (
                <p className="mt-4 rounded-[20px] border border-[#ff453a] p-4 text-[15px] text-porcelain">
                  El problema es <strong>infactible</strong>: ninguna combinación de valores cumple todas las restricciones a la vez (la Fase 1 no logró llevar las variables artificiales a 0).
                </p>
              )}
              {resultado.estado === "ilimitado" && (
                <p className="mt-4 rounded-[20px] border border-[#ff453a] p-4 text-[15px] text-porcelain">
                  El problema es <strong>no acotado</strong>: Z puede mejorar sin límite porque la región factible se extiende indefinidamente en la dirección de mejora.
                </p>
              )}
            </div>

            <Seccion titulo="Cómo se resuelve" nota="Cambia de vista; los pasos tabular y algebraico comparten la misma iteración.">
              <div className="flex flex-wrap gap-3">
                {resultado.grafico && (
                  <Boton variante="secundario" activo={vista === "grafico"} onClick={() => setVista("grafico")}>
                    Gráfico
                  </Boton>
                )}
                <Boton variante="secundario" activo={vista === "tabular"} onClick={() => setVista("tabular")}>
                  Simplex tabular
                </Boton>
                <Boton variante="secundario" activo={vista === "algebraico"} onClick={() => setVista("algebraico")}>
                  Simplex algebraico
                </Boton>
              </div>
              {!resultado.grafico && (
                <p className="mt-3 text-[13px] text-ash">El gráfico solo está disponible con exactamente 2 variables de decisión.</p>
              )}
              <div className="mt-6">
                {vista === "grafico" && resultado.grafico && <GraficoSimplex g={resultado.grafico} />}
                {vista === "tabular" && pasos.length > 0 && <Tabular pasos={pasos} i={paso} setI={setPaso} />}
                {vista === "algebraico" && pasos.length > 0 && <Algebraico pasos={pasos} i={paso} setI={setPaso} />}
                {pasos.length === 0 && vista !== "grafico" && <p className="text-[14px] text-ash">No hay iteraciones que mostrar.</p>}
              </div>
            </Seccion>
          </>
        )}
      </div>
    </section>
  );
}
