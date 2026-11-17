"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorApi, numero } from "@/lib/api";
import { abrirLogin, useUsuario } from "@/lib/sesion";
import {
  actualizarCasoT,
  aProblemaT,
  casoVacioT,
  crearCasoT,
  desdeProblemaT,
  ejemploPowerco,
  hayErroresT,
  obtenerCasoT,
  resolverT,
  totalesT,
  validarT,
  type CasoT,
  type EstadoT,
  type ProblemaT,
  type SolucionT,
} from "@/lib/transporte";
import { EditorTransporte } from "./EditorTransporte";
import { RedTransporte } from "./RedTransporte";
import { ResultadosTransporte } from "./ResultadosTransporte";
import { resumenTransporte } from "@/lib/escenarios";
import { Escenarios } from "./Escenarios";
import { SensibilidadRedes } from "./SensibilidadRedes";
import { PanelLateral } from "./PanelLateral";
import { PANEL_TRANSPORTE } from "@/lib/paneles";
import { ErroresCampos, enfocarPrimerError } from "./ErroresCampos";
import { Boton, Campo } from "./ui";
import { ImportarDatos } from "./ImportarDatos";
import { importarTransporte, seccionesTransporte, SECCIONES_TRANSPORTE } from "@/lib/importar";

type Resultado = { solucion: SolucionT; problema: ProblemaT };
const mensajes = (e: unknown) => (e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);

export function SolverTransporte() {
  const usuario = useUsuario();
  const router = useRouter();
  const casoParam = useSearchParams().get("caso");
  const cargadoRef = useRef<string | null>(null);
  const refResultado = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<EstadoT>(() => ejemploPowerco());
  const [plantilla, setPlantilla] = useState<"ejemplo" | "vacio" | null>("ejemplo");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [casoActual, setCasoActual] = useState<{ id: number; nombre: string } | null>(null);
  const [nombreGuardar, setNombreGuardar] = useState("Caso Powerco");
  const [intentado, setIntentado] = useState(false);
  const [desactualizado, setDesactualizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");

  const errores = useMemo(() => validarT(estado), [estado]);
  const nCampos = Object.keys(errores.celdas).length;
  const tot = totalesT(estado);
  const faltaOferta = tot && tot.oferta < tot.demanda ? tot : null;
  const caso = usuario ? casoActual : null;

  function cambiar(nuevo: EstadoT) {
    setEstado(nuevo);
    setDesactualizado(true);
    setAviso("");
  }

  function cargar(nuevo: EstadoT, nombre: string, p: "ejemplo" | "vacio" | null) {
    setEstado(nuevo);
    setPlantilla(p);
    setResultado(null);
    setCasoActual(null);
    setNombreGuardar(nombre);
    setIntentado(false);
    setDesactualizado(false);
    setErrorServidor([]);
    setAviso("");
    if (casoParam) router.replace("/resolver/transporte");
  }

  async function calcular() {
    setIntentado(true);
    setAviso("");
    setErrorServidor([]);
    if (hayErroresT(errores)) {
      enfocarPrimerError();
      return;
    }
    setCargando(true);
    try {
      const problema = aProblemaT(estado);
      const solucion = await resolverT(problema);
      setResultado({ solucion, problema });
      setDesactualizado(false);
      requestAnimationFrame(() => refResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setErrorServidor(mensajes(e));
    } finally {
      setCargando(false);
    }
  }

  async function guardar(comoNuevo: boolean) {
    if (!usuario) {
      abrirLogin();
      return;
    }
    setIntentado(true);
    setAviso("");
    setErrorServidor([]);
    if (hayErroresT(errores)) {
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
      const problema = aProblemaT(estado);
      const guardado =
        caso && !comoNuevo ? await actualizarCasoT(caso.id, { nombre, datos: problema }) : await crearCasoT(nombre, problema);
      setCasoActual({ id: guardado.id, nombre: guardado.nombre });
      if (guardado.resultado) setResultado({ solucion: guardado.resultado, problema: guardado.datos });
      setDesactualizado(false);
      setAviso("Caso guardado ✓");
    } catch (e) {
      setErrorServidor(mensajes(e));
    } finally {
      setGuardando(false);
    }
  }

  const abrir = useCallback((c: CasoT) => {
    setEstado(desdeProblemaT(c.datos));
    setPlantilla(null);
    setResultado(c.resultado ? { solucion: c.resultado, problema: c.datos } : null);
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
    obtenerCasoT(id)
      .then((c) => {
        if (c.tipo !== "transporte") throw new ErrorApi(["Ese caso no es de transporte."]);
        abrir(c);
      })
      .catch((e) => {
        cargadoRef.current = null;
        setErrorServidor(mensajes(e));
      });
  }, [casoParam, usuario, abrir]);

  const vistaO = estado.origenes.map((o, i) => o.nombre.trim() || `Origen ${i + 1}`);
  const vistaD = estado.destinos.map((d, j) => d.nombre.trim() || `Destino ${j + 1}`);

  return (
    <section id="resolver" className="mx-auto w-full max-w-[88rem] scroll-mt-16 px-6 py-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 print:block">
      <PanelLateral entradas={PANEL_TRANSPORTE} tieneResultado={!!resultado} />
      <div className="min-w-0 max-w-6xl">
      <h1 className="text-[clamp(32px,5vw,56px)] font-semibold leading-[1.07] tracking-[-0.015em] text-porcelain">
        Problema de transporte.
      </h1>
      <p className="mt-3 max-w-xl text-[17px] leading-[1.47] tracking-[-0.374px] text-ash">
        Envía desde varios orígenes a varios destinos al menor costo total. Parte del ejemplo de Powerco o escribe el tuyo.
      </p>

      {casoParam && !usuario && (
        <p className="mt-6 rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">
          Inicia sesión para abrir el caso guardado.{" "}
          <Boton variante="enlace" onClick={abrirLogin}>
            Entrar
          </Boton>
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Boton variante="secundario" activo={plantilla === "ejemplo"} onClick={() => cargar(ejemploPowerco(), "Caso Powerco", "ejemplo")}>
          Cargar ejemplo Powerco
        </Boton>
        <Boton variante="secundario" activo={plantilla === "vacio"} onClick={() => cargar(casoVacioT(), "Caso nuevo", "vacio")}>
          Empezar un caso vacío
        </Boton>
        <ImportarDatos
          seccionesConocidas={SECCIONES_TRANSPORTE}
          importar={importarTransporte}
          plantilla={() => seccionesTransporte(ejemploPowerco())}
          archivoPlantilla="plantilla-transporte"
          onImportar={(e, nombre) => cargar(e, nombre, null)}
        />
        {caso && (
          <span className="text-[13px] text-ash">
            Editando: <strong className="text-porcelain">{caso.nombre}</strong>
          </span>
        )}
      </div>

      <div className="mt-6">
        <EditorTransporte estado={estado} onCambio={cambiar} errores={errores} intentado={intentado} />
      </div>

      <div id="accion" className="mt-6 scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <Boton onClick={() => void calcular()} disabled={cargando} className="px-6 py-2.5">
            {cargando ? "Calculando…" : "Resolver"}
          </Boton>
          {intentado && nCampos > 0 && <ErroresCampos n={nCampos} />}
        </div>
        {faltaOferta && (
          <p className="mt-4 rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">
            La oferta total ({numero(faltaOferta.oferta)}) es menor que la demanda total ({numero(faltaOferta.demanda)}). Se enviará todo lo posible al
            menor costo y verás cuánta demanda queda sin cubrir.
          </p>
        )}
        {intentado && errores.globales.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-[20px] border border-[#ff453a] p-4 text-[14px] text-porcelain">
            {errores.globales.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        )}
        {errorServidor.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-[20px] border border-[#ff453a] p-4 text-[14px] text-porcelain">
            {errorServidor.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        )}
      </div>

      <div ref={refResultado} id="resultado" className="mt-6 scroll-mt-16 space-y-6">
        {resultado ? (
          <>
            {desactualizado && (
              <p className="rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">
                Cambiaste los datos. Pulsa «Resolver» para actualizar este resultado.
              </p>
            )}
            <ResultadosTransporte solucion={resultado.solucion} problema={resultado.problema} />
          </>
        ) : (
          <div className="rounded-[28px] bg-carbon p-5 sm:p-8">
            <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Tu red</h3>
            <p className="mt-2 text-[14px] text-ash">Así se ve tu red. Pulsa «Resolver» y cobrará vida con la solución óptima.</p>
            <div className="mt-6 overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
              <RedTransporte origenes={vistaO} destinos={vistaD} />
            </div>
          </div>
        )}
      </div>

      {resultado && <SensibilidadRedes key={JSON.stringify(resultado.problema)} tipo="transporte" datos={resultado.problema} dinero={true} />}

      <Escenarios actual={resultado ? resumenTransporte(resultado.solucion) : null} />

      <div id="guardar-caso" className="mt-6 scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8">
        <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Guardar caso</h3>
        {usuario ? (
          <>
            <p className="mt-2 text-[14px] text-ash">Se guarda en tu cuenta y se resuelve de nuevo con estos datos.</p>
            <div className="mt-5 flex flex-wrap items-start gap-3">
              <div className="w-full sm:w-80">
                <Campo
                  aria-label="Nombre del caso"
                  maxLength={120}
                  value={nombreGuardar}
                  onChange={(e) => setNombreGuardar(e.target.value)}
                />
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
