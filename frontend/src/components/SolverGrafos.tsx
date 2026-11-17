"use client";

import { useMemo, useRef, useState } from "react";
import {
  INFO,
  LIMITES_G,
  ejemplo,
  hayErrores,
  numero,
  resolver,
  validar,
  vacio,
  type Algoritmo,
  type EstadoG,
  type ResultadoG,
} from "@/lib/grafos";
import { PANEL_GRAFOS } from "@/lib/paneles";
import { ErroresCampos, enfocarPrimerError } from "./ErroresCampos";
import { GrafoSvg } from "./GrafoSvg";
import { PanelLateral } from "./PanelLateral";
import { Metrica } from "./Resultados";
import { Boton, BotonQuitar, Campo, Seccion, claseCampo } from "./ui";

const ALGS: Algoritmo[] = ["ruta", "flujo", "arbol"];
const iniciales = (): Record<Algoritmo, EstadoG> => ({ ruta: ejemplo("ruta"), flujo: ejemplo("flujo"), arbol: ejemplo("arbol") });

function Selector({
  etiqueta,
  valor,
  opciones,
  error,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  opciones: string[];
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-0">
      <select
        aria-label={etiqueta}
        aria-invalid={!!error}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={`${claseCampo(!!error)} !rounded-xl`}
      >
        <option value="">Elige…</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 px-1 text-[12px] text-[#ff453a]">{error}</p>}
    </div>
  );
}

export function SolverGrafos() {
  const refResultado = useRef<HTMLDivElement>(null);
  const [alg, setAlg] = useState<Algoritmo>("ruta");
  const [estados, setEstados] = useState<Record<Algoritmo, EstadoG>>(iniciales);
  const [resultado, setResultado] = useState<ResultadoG | null>(null);
  const [desactualizado, setDesactualizado] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [paso, setPaso] = useState(0);
  const [aviso, setAviso] = useState("");

  const estado = estados[alg];
  const info = INFO[alg];
  const errores = useMemo(() => validar(alg, estado), [alg, estado]);
  const nCampos = Object.keys(errores.celdas).length + errores.generales.length;
  const err = (k: string) => (intentado ? errores.celdas[k] : undefined);
  const nombres = estado.nodos.map((n) => n.trim()).filter(Boolean);
  const usaDestino = alg !== "arbol";

  function poner(nuevo: EstadoG) {
    setEstados((p) => ({ ...p, [alg]: nuevo }));
    setDesactualizado(true);
    setAviso("");
  }
  function cargar(nuevo: EstadoG) {
    setEstados((p) => ({ ...p, [alg]: nuevo }));
    setResultado(null);
    setIntentado(false);
    setDesactualizado(false);
    setPaso(0);
    setAviso("");
  }
  function cambiarAlg(a: Algoritmo) {
    setAlg(a);
    setResultado(null);
    setIntentado(false);
    setDesactualizado(false);
    setPaso(0);
    setAviso("");
  }

  function renombrar(i: number, nuevo: string) {
    const viejo = estado.nodos[i];
    const m = (v: string) => (v === viejo ? nuevo : v);
    poner({
      ...estado,
      nodos: estado.nodos.map((n, k) => (k === i ? nuevo : n)),
      aristas: estado.aristas.map((x) => ({ ...x, de: m(x.de), a: m(x.a) })),
      origen: m(estado.origen),
      destino: m(estado.destino),
    });
  }
  function quitarNodo(i: number) {
    const viejo = estado.nodos[i];
    const lim = (v: string) => (v === viejo ? "" : v);
    poner({
      ...estado,
      nodos: estado.nodos.filter((_, k) => k !== i),
      aristas: estado.aristas.map((x) => ({ ...x, de: lim(x.de), a: lim(x.a) })),
      origen: lim(estado.origen),
      destino: lim(estado.destino),
    });
  }

  function calcular() {
    setIntentado(true);
    if (hayErrores(errores)) {
      enfocarPrimerError();
      return;
    }
    setResultado(resolver(alg, estado));
    setPaso(0);
    setDesactualizado(false);
    requestAnimationFrame(() => refResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  const pasoActual = resultado ? resultado.pasos[Math.min(paso, resultado.pasos.length - 1)] : null;
  const final = resultado ? resultado.pasos[resultado.pasos.length - 1] : null;

  // vista previa con lo que ya es válido
  const previa = useMemo(() => {
    const ok = new Set(nombres);
    return {
      nodos: nombres,
      aristas: estado.aristas.flatMap((x) => {
        const v = numero(x.valor);
        return ok.has(x.de.trim()) && ok.has(x.a.trim()) && x.de.trim() !== x.a.trim() && Number.isFinite(v) ? [{ de: x.de.trim(), a: x.a.trim(), valor: v }] : [];
      }),
    };
  }, [estado.aristas, nombres]);
  const dirigido = alg === "flujo" ? true : alg === "arbol" ? false : estado.dirigido;

  return (
    <section id="resolver" className="mx-auto w-full max-w-[88rem] scroll-mt-16 px-6 py-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 print:block">
      <PanelLateral entradas={PANEL_GRAFOS} tieneResultado={!!resultado} />
      <div className="min-w-0 max-w-6xl">
        <h1 className="text-[clamp(32px,5vw,56px)] font-semibold leading-[1.07] tracking-[-0.015em] text-porcelain">Redes y grafos.</h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-[1.47] tracking-[-0.374px] text-ash">
          Dibuja una red de nodos y conexiones y resuélvela: el camino más barato, cuánto se puede enviar como máximo o cómo conectar todo con el menor costo. Cada método se muestra paso a paso sobre el grafo.
        </p>

        <div id="tipo" className="mt-8 flex flex-wrap items-center gap-3">
          {ALGS.map((a) => (
            <Boton key={a} variante="secundario" activo={alg === a} onClick={() => cambiarAlg(a)}>
              {INFO[a].nombre}
            </Boton>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-ash">
          {info.nota} Método: <span className="text-porcelain">{info.metodo}</span>.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Boton variante="secundario" onClick={() => cargar(ejemplo(alg))}>
            Cargar el ejemplo
          </Boton>
          <Boton variante="secundario" onClick={() => cargar(vacio(alg))}>
            Empezar un caso vacío
          </Boton>
        </div>

        <Seccion id="nodos" titulo="Nodos" nota={`Los puntos de la red (ciudades, plantas, clientes…). Hasta ${LIMITES_G.nodos}.`} className="mt-6" acciones={
          <Boton variante="secundario" disabled={estado.nodos.length >= LIMITES_G.nodos} onClick={() => poner({ ...estado, nodos: [...estado.nodos, ""] })}>
            + Nodo
          </Boton>
        }>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {estado.nodos.map((n, i) => (
              <div key={i} className="flex items-start gap-1">
                <Campo aria-label={`Nombre del nodo ${i + 1}`} maxLength={LIMITES_G.nombre} value={n} error={err(`n.${i}`)} onChange={(e) => renombrar(i, e.target.value)} />
                <BotonQuitar aria-label={`Quitar el nodo ${i + 1}`} disabled={estado.nodos.length <= 2} onClick={() => quitarNodo(i)} />
              </div>
            ))}
          </div>
        </Seccion>

        <Seccion
          id="conexiones"
          titulo="Conexiones"
          nota={
            alg === "flujo"
              ? "Cada flecha va de un nodo a otro con una capacidad máxima (unidades que puede llevar)."
              : alg === "arbol"
                ? "Cada línea une dos nodos (en ambos sentidos) con su costo."
                : "Cada conexión une dos nodos con su costo o distancia."
          }
          className="mt-6"
          acciones={
            <Boton
              variante="secundario"
              disabled={estado.aristas.length >= LIMITES_G.aristas}
              onClick={() => poner({ ...estado, aristas: [...estado.aristas, { de: "", a: "", valor: "" }] })}
            >
              + Conexión
            </Boton>
          }
        >
          {alg === "ruta" && (
            <label className="mb-5 flex items-center gap-2 text-[14px] text-porcelain">
              <input type="checkbox" checked={estado.dirigido} onChange={(e) => poner({ ...estado, dirigido: e.target.checked })} className="h-4 w-4 accent-apple-blue" />
              Las conexiones tienen un solo sentido (de «Desde» a «Hasta»)
            </label>
          )}
          <div className="overflow-x-auto">
            <div className="min-w-[520px] space-y-2">
              <div className="grid grid-cols-[1fr_1fr_8rem_2rem] gap-2 px-1 text-[12px] text-ash">
                <span>Desde</span>
                <span>Hasta</span>
                <span>{info.valor}</span>
                <span />
              </div>
              {estado.aristas.map((x, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_8rem_2rem] items-start gap-2">
                  <Selector etiqueta={`Conexión ${i + 1}: desde`} valor={x.de} opciones={nombres} error={err(`a.${i}.de`)} onChange={(v) => poner({ ...estado, aristas: estado.aristas.map((y, k) => (k === i ? { ...y, de: v } : y)) })} />
                  <Selector etiqueta={`Conexión ${i + 1}: hasta`} valor={x.a} opciones={nombres} error={err(`a.${i}.a`)} onChange={(v) => poner({ ...estado, aristas: estado.aristas.map((y, k) => (k === i ? { ...y, a: v } : y)) })} />
                  <Campo aria-label={`Conexión ${i + 1}: ${info.valor.toLowerCase()}`} inputMode="decimal" value={x.valor} error={err(`a.${i}.valor`)} onChange={(e) => poner({ ...estado, aristas: estado.aristas.map((y, k) => (k === i ? { ...y, valor: e.target.value } : y)) })} />
                  <BotonQuitar aria-label={`Quitar la conexión ${i + 1}`} disabled={estado.aristas.length <= 1} onClick={() => poner({ ...estado, aristas: estado.aristas.filter((_, k) => k !== i) })} />
                </div>
              ))}
            </div>
          </div>
          {intentado && errores.generales.length > 0 && <p className="mt-3 text-[13px] text-[#ff453a]">{errores.generales.join(" ")}</p>}
        </Seccion>

        {usaDestino && (
          <Seccion id="extremos" titulo={alg === "flujo" ? "Origen y destino del flujo" : "Salida y llegada"} className="mt-6" nota={alg === "flujo" ? "De dónde sale y a dónde debe llegar lo que se envía." : "Entre qué dos nodos quieres el camino más corto."}>
            <div className="grid max-w-xl gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 px-1 text-[12px] text-ash">{alg === "flujo" ? "Origen (fuente)" : "Salida"}</p>
                <Selector etiqueta="Nodo de salida" valor={estado.origen} opciones={nombres} error={err("origen")} onChange={(v) => poner({ ...estado, origen: v })} />
              </div>
              <div>
                <p className="mb-1 px-1 text-[12px] text-ash">{alg === "flujo" ? "Destino (sumidero)" : "Llegada"}</p>
                <Selector etiqueta="Nodo de llegada" valor={estado.destino} opciones={nombres} error={err("destino")} onChange={(v) => poner({ ...estado, destino: v })} />
              </div>
            </div>
          </Seccion>
        )}

        <Seccion id="vista-previa" titulo="Así se ve tu red" nota="Se actualiza mientras escribes. Solo aparecen las conexiones completas." className="mt-6">
          {previa.nodos.length >= 2 ? (
            <GrafoSvg nodos={previa.nodos} aristas={previa.aristas} dirigido={dirigido} />
          ) : (
            <p className="text-[14px] text-ash">Escribe al menos dos nodos para ver el grafo.</p>
          )}
        </Seccion>

        <div id="accion" className="mt-8 flex flex-wrap items-center gap-4">
          <Boton onClick={calcular}>Resolver</Boton>
          {intentado && nCampos > 0 && <ErroresCampos n={nCampos} />}
          {desactualizado && resultado && <span className="text-[14px] text-optical-yellow">Cambiaste los datos: vuelve a resolver.</span>}
          {aviso && <span className="text-[14px] text-ash">{aviso}</span>}
        </div>

        {resultado && final && pasoActual && (
          <div ref={refResultado} className="mt-10 scroll-mt-20">
            <Seccion id="resultado" titulo={INFO[resultado.algoritmo].nombre} nota={`Método: ${INFO[resultado.algoritmo].metodo}.`}>
              <div className={`grid gap-4 ${resultado.metricas.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                {resultado.metricas.map((m) => (
                  <Metrica key={m.titulo} etiqueta={m.titulo}>
                    {m.valor}
                  </Metrica>
                ))}
              </div>
              <p className="mt-5 max-w-3xl text-[15px] leading-[1.5] text-porcelain">{resultado.mensaje}</p>
              <div className="mt-6 rounded-[20px] bg-obsidian p-3">
                <GrafoSvg nodos={resultado.nodos} aristas={resultado.aristas} dirigido={resultado.dirigido} estilos={final.aristas} etiquetas={final.etiquetas} estilosNodo={final.nodos} />
              </div>
              <Leyenda alg={resultado.algoritmo} />
            </Seccion>

            <Seccion id="paso-a-paso" titulo="Paso a paso" nota="Avanza de a un paso para ver qué decide el algoritmo y por qué." className="mt-6">
              <div className="flex flex-wrap items-center gap-3">
                <Boton variante="secundario" disabled={paso <= 0} onClick={() => setPaso(paso - 1)}>
                  ← Anterior
                </Boton>
                <Boton variante="secundario" disabled={paso >= resultado.pasos.length - 1} onClick={() => setPaso(paso + 1)}>
                  Siguiente →
                </Boton>
                <input
                  type="range"
                  aria-label="Paso"
                  min={0}
                  max={resultado.pasos.length - 1}
                  value={Math.min(paso, resultado.pasos.length - 1)}
                  onChange={(e) => setPaso(Number(e.target.value))}
                  className="min-w-40 flex-1 accent-apple-blue"
                />
                <span className="text-[13px] text-ash">
                  Paso {Math.min(paso, resultado.pasos.length - 1) + 1} de {resultado.pasos.length}
                </span>
              </div>
              <h4 className="mt-5 text-[19px] font-semibold text-porcelain">{pasoActual.titulo}</h4>
              <p className="mt-1 max-w-3xl text-[15px] leading-[1.5] text-ash">{pasoActual.texto}</p>
              <div className="mt-4 rounded-[20px] bg-obsidian p-3">
                <GrafoSvg nodos={resultado.nodos} aristas={resultado.aristas} dirigido={resultado.dirigido} estilos={pasoActual.aristas} etiquetas={pasoActual.etiquetas} estilosNodo={pasoActual.nodos} />
              </div>
              {pasoActual.tabla && pasoActual.tabla.filas.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[13px]">
                    <thead>
                      <tr className="text-ash">
                        {pasoActual.tabla.cab.map((c) => (
                          <th key={c} className="px-2 py-1.5 font-normal">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pasoActual.tabla.filas.map((f, i) => (
                        <tr key={i} className="border-t border-white/10 text-porcelain">
                          {f.map((c, j) => (
                            <td key={j} className="px-2 py-1.5">
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>
          </div>
        )}
      </div>
    </section>
  );
}

function Punto({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  );
}

function Leyenda({ alg }: { alg: Algoritmo }) {
  return (
    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ash">
      {alg === "ruta" && (
        <>
          <Punto color="var(--color-apple-blue)" texto="Camino más corto" />
          <Punto color="#ff9f0a" texto="Tramo que se está revisando" />
        </>
      )}
      {alg === "flujo" && (
        <>
          <Punto color="var(--color-apple-blue)" texto="Arco con flujo (flujo/capacidad)" />
          <Punto color="#ff453a" texto="Cuello de botella (corte mínimo)" />
          <Punto color="#30d158" texto="Lado de la fuente" />
        </>
      )}
      {alg === "arbol" && (
        <>
          <Punto color="var(--color-apple-blue)" texto="Conexión aceptada" />
          <Punto color="#ff453a" texto="Descartada (haría un ciclo)" />
        </>
      )}
    </p>
  );
}
