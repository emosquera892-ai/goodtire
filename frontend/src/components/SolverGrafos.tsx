"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorApi } from "@/lib/api";
import { abrirLogin, useUsuario } from "@/lib/sesion";
import { actualizarCasoG, crearCasoG, obtenerCasoG, type CasoG } from "@/lib/grafosApi";
import {
  INFO,
  aDatos,
  desdeDatos,
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
import { ResultadosGrafos } from "./ResultadosGrafos";
import { Boton, BotonQuitar, Campo, Seccion, claseCampo } from "./ui";

const mensajes = (e: unknown) => (e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
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
  const usuario = useUsuario();
  const router = useRouter();
  const casoParam = useSearchParams().get("caso");
  const cargadoRef = useRef<string | null>(null);
  const refResultado = useRef<HTMLDivElement>(null);
  const [alg, setAlg] = useState<Algoritmo>("ruta");
  const [estados, setEstados] = useState<Record<Algoritmo, EstadoG>>(iniciales);
  const [resultado, setResultado] = useState<ResultadoG | null>(null);
  const [desactualizado, setDesactualizado] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [version, setVersion] = useState(0);
  const [aviso, setAviso] = useState("");
  const [casoActual, setCasoActual] = useState<{ id: number; nombre: string } | null>(null);
  const [nombreGuardar, setNombreGuardar] = useState("Mi red");
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string[]>([]);

  const estado = estados[alg];
  const info = INFO[alg];
  const errores = useMemo(() => validar(alg, estado), [alg, estado]);
  const nCampos = Object.keys(errores.celdas).length + errores.generales.length;
  const err = (k: string) => (intentado ? errores.celdas[k] : undefined);
  const nombres = estado.nodos.map((n) => n.trim()).filter(Boolean);
  const usaDestino = alg !== "arbol";
  const caso = usuario ? casoActual : null;

  function poner(nuevo: EstadoG) {
    setEstados((p) => ({ ...p, [alg]: nuevo }));
    setDesactualizado(true);
    setAviso("");
  }
  function cargar(nuevo: EstadoG) {
    setEstados((p) => ({ ...p, [alg]: nuevo }));
    setResultado(null);
    setCasoActual(null);
    setIntentado(false);
    setDesactualizado(false);
    setAviso("");
    setErrorServidor([]);
    if (casoParam) router.replace("/resolver/grafos");
  }
  function cambiarAlg(a: Algoritmo) {
    setAlg(a);
    setResultado(null);
    setCasoActual(null);
    setIntentado(false);
    setDesactualizado(false);
    setAviso("");
    setErrorServidor([]);
    if (casoParam) router.replace("/resolver/grafos");
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
    setVersion((v) => v + 1);
    setDesactualizado(false);
    requestAnimationFrame(() => refResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function guardar(comoNuevo: boolean) {
    if (!usuario) {
      abrirLogin();
      return;
    }
    setIntentado(true);
    setAviso("");
    setErrorServidor([]);
    if (hayErrores(errores)) {
      setAviso("Corrige los campos marcados antes de guardar.");
      enfocarPrimerError();
      return;
    }
    const nombre = nombreGuardar.trim();
    if (!nombre) {
      setAviso("Escribe un nombre para el caso.");
      return;
    }
    setGuardando(true);
    try {
      const datos = aDatos(alg, estado);
      const guardado = caso && !comoNuevo ? await actualizarCasoG(caso.id, { nombre, datos }) : await crearCasoG(nombre, datos);
      setCasoActual({ id: guardado.id, nombre: guardado.nombre });
      setResultado(resolver(alg, estado));
      setVersion((v) => v + 1);
      setDesactualizado(false);
      setAviso("Caso guardado ✓");
    } catch (e) {
      setErrorServidor(mensajes(e));
    } finally {
      setGuardando(false);
    }
  }

  const abrir = useCallback((c: CasoG) => {
    const nuevo = desdeDatos(c.datos);
    setAlg(c.datos.algoritmo);
    setEstados((p) => ({ ...p, [c.datos.algoritmo]: nuevo }));
    setResultado(resolver(c.datos.algoritmo, nuevo));
    setVersion((v) => v + 1);
    setCasoActual({ id: c.id, nombre: c.nombre });
    setNombreGuardar(c.nombre);
    setIntentado(false);
    setDesactualizado(false);
    setErrorServidor([]);
    setAviso("");
  }, []);

  useEffect(() => {
    if (!casoParam) {
      cargadoRef.current = null;
      return;
    }
    if (!usuario || cargadoRef.current === casoParam) return;
    cargadoRef.current = casoParam;
    const id = Number(casoParam);
    if (!Number.isInteger(id)) return;
    obtenerCasoG(id)
      .then((c) => {
        if (c.tipo !== "grafos") throw new ErrorApi(["Ese caso no es de redes y grafos."]);
        abrir(c);
      })
      .catch((e) => {
        cargadoRef.current = null;
        setErrorServidor(mensajes(e));
      });
  }, [casoParam, usuario, abrir]);

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

        {casoParam && !usuario && (
          <p className="mt-6 rounded-[20px] border border-slate p-4 text-[14px] text-porcelain">
            Inicia sesión para abrir el caso guardado.{" "}
            <button type="button" onClick={abrirLogin} className="text-electric-link hover:underline">
              Entrar
            </button>
          </p>
        )}
        {caso && (
          <p className="mt-6 text-[14px] text-ash">
            Editando: <strong className="text-porcelain">{caso.nombre}</strong>
          </p>
        )}

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
          {aviso && !usuario && <span className="text-[14px] text-ash">{aviso}</span>}
        </div>

        {errorServidor.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-[14px] text-[#ff453a]">
            {errorServidor.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}

        {resultado && (
          <div ref={refResultado} className="mt-10 scroll-mt-20">
            <ResultadosGrafos key={version} resultado={resultado} />
          </div>
        )}

        <div id="guardar-caso" className="mt-6 scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8 no-imprimir">
          <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Guardar caso</h3>
          {usuario ? (
            <>
              <p className="mt-2 text-[14px] text-ash">Se guarda en tu cuenta y luego puedes abrirlo o compartirlo por enlace desde «Mis casos».</p>
              <div className="mt-5 flex flex-wrap items-start gap-3">
                <div className="w-full sm:w-80">
                  <Campo aria-label="Nombre del caso" maxLength={120} value={nombreGuardar} onChange={(e) => setNombreGuardar(e.target.value)} />
                </div>
                <Boton disabled={guardando} onClick={() => void guardar(false)}>
                  {guardando ? "Guardando…" : caso ? "Actualizar caso" : "Guardar caso"}
                </Boton>
                {caso && (
                  <Boton variante="secundario" disabled={guardando} onClick={() => void guardar(true)}>
                    Guardar como nuevo
                  </Boton>
                )}
              </div>
              <p className="mt-3 text-[14px] text-porcelain">
                {aviso && <span className="mr-3">{aviso}</span>}
                <Link href="/casos" className="text-electric-link hover:underline">
                  Ver mis casos →
                </Link>
              </p>
            </>
          ) : (
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <p className="text-[14px] text-ash">Inicia sesión para guardar tus casos y abrirlos desde cualquier dispositivo.</p>
              <Boton onClick={abrirLogin}>Entrar o crear cuenta</Boton>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
