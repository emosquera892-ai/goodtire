"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorApi } from "@/lib/api";
import { abrirLogin, useUsuario } from "@/lib/sesion";
import {
  actualizarCasoB,
  aProblemaB,
  casoVacioB,
  crearCasoB,
  desdeProblemaB,
  ejemploRed,
  hayErroresB,
  obtenerCasoB,
  resolverB,
  validarB,
  type CasoB,
  type EstadoB,
  type ProblemaB,
  type SolucionB,
} from "@/lib/transbordo";
import { EditorTransbordo } from "./EditorTransbordo";
import { RedTransbordo } from "./RedTransbordo";
import { ResultadosTransbordo } from "./ResultadosTransbordo";
import { Boton, Campo } from "./ui";

type Resultado = { solucion: SolucionB; problema: ProblemaB };
const mensajes = (e: unknown) => (e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);

export function SolverTransbordo() {
  const usuario = useUsuario();
  const router = useRouter();
  const casoParam = useSearchParams().get("caso");
  const cargadoRef = useRef<string | null>(null);
  const refResultado = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<EstadoB>(() => ejemploRed());
  const [plantilla, setPlantilla] = useState<"ejemplo" | "vacio" | null>("ejemplo");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [casoActual, setCasoActual] = useState<{ id: number; nombre: string } | null>(null);
  const [nombreGuardar, setNombreGuardar] = useState("Caso transbordo");
  const [intentado, setIntentado] = useState(false);
  const [desactualizado, setDesactualizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");

  const errores = useMemo(() => validarB(estado), [estado]);
  const nCampos = Object.keys(errores.celdas).length;
  const caso = usuario ? casoActual : null;

  function cambiar(nuevo: EstadoB) {
    setEstado(nuevo);
    setDesactualizado(true);
    setAviso("");
  }

  function cargar(nuevo: EstadoB, nombre: string, p: "ejemplo" | "vacio") {
    setEstado(nuevo);
    setPlantilla(p);
    setResultado(null);
    setCasoActual(null);
    setNombreGuardar(nombre);
    setIntentado(false);
    setDesactualizado(false);
    setErrorServidor([]);
    setAviso("");
    if (casoParam) router.replace("/resolver/transbordo");
  }

  async function calcular() {
    setIntentado(true);
    setAviso("");
    setErrorServidor([]);
    if (hayErroresB(errores)) return;
    setCargando(true);
    try {
      const problema = aProblemaB(estado);
      const solucion = await resolverB(problema);
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
    if (hayErroresB(errores)) {
      setAviso("Corrige los campos marcados antes de guardar.");
      return;
    }
    const nombre = nombreGuardar.trim();
    if (!nombre) {
      setAviso("Escribe un nombre para el caso.");
      return;
    }
    setGuardando(true);
    try {
      const problema = aProblemaB(estado);
      const guardado =
        caso && !comoNuevo ? await actualizarCasoB(caso.id, { nombre, datos: problema }) : await crearCasoB(nombre, problema);
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

  const abrir = useCallback((c: CasoB) => {
    setEstado(desdeProblemaB(c.datos));
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
    obtenerCasoB(id)
      .then((c) => {
        if (c.tipo !== "transbordo") throw new ErrorApi(["Ese caso no es de transbordo."]);
        abrir(c);
      })
      .catch((e) => {
        cargadoRef.current = null;
        setErrorServidor(mensajes(e));
      });
  }, [casoParam, usuario, abrir]);

  const vistaN = estado.nodos.map((n, i) => ({ nombre: n.nombre.trim() || `Nodo ${i + 1}`, tipo: n.tipo }));

  return (
    <section id="resolver" className="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-12">
      <h1 className="text-[clamp(32px,5vw,56px)] font-semibold leading-[1.07] tracking-[-0.015em] text-porcelain">
        Problema de transbordo.
      </h1>
      <p className="mt-3 max-w-xl text-[17px] leading-[1.47] tracking-[-0.374px] text-ash">
        Envía de orígenes a destinos, pasando si conviene por intermedios, al menor costo total. Parte del ejemplo o escribe el tuyo.
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
        <Boton variante="secundario" activo={plantilla === "ejemplo"} onClick={() => cargar(ejemploRed(), "Caso transbordo", "ejemplo")}>
          Cargar ejemplo
        </Boton>
        <Boton variante="secundario" activo={plantilla === "vacio"} onClick={() => cargar(casoVacioB(), "Caso nuevo", "vacio")}>
          Empezar un caso vacío
        </Boton>
        {caso && (
          <span className="text-[13px] text-ash">
            Editando: <strong className="text-porcelain">{caso.nombre}</strong>
          </span>
        )}
      </div>

      <div className="mt-6">
        <EditorTransbordo estado={estado} onCambio={cambiar} errores={errores} intentado={intentado} />
      </div>

      <div className="mt-6 rounded-[28px] bg-carbon p-5 sm:p-8">
        <div className="flex flex-wrap items-center gap-4">
          <Boton onClick={() => void calcular()} disabled={cargando} className="px-6 py-2.5">
            {cargando ? "Calculando…" : "Resolver"}
          </Boton>
          {intentado && nCampos > 0 && (
            <span className="text-[14px] text-[#ff453a]">
              {nCampos === 1 ? "Hay 1 campo por corregir." : `Hay ${nCampos} campos por corregir.`}
            </span>
          )}
        </div>
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

      <div ref={refResultado} className="mt-6 scroll-mt-16 space-y-6">
        {resultado ? (
          <>
            {desactualizado && (
              <p className="rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">
                Cambiaste los datos. Pulsa «Resolver» para actualizar este resultado.
              </p>
            )}
            <ResultadosTransbordo solucion={resultado.solucion} problema={resultado.problema} />
          </>
        ) : (
          <div className="rounded-[28px] bg-carbon p-5 sm:p-8">
            <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Tu red</h3>
            <p className="mt-2 text-[14px] text-ash">Así se ve tu red. Pulsa «Resolver» y verás las rutas óptimas.</p>
            <div className="mt-6 overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
              <RedTransbordo nodos={vistaN} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-[28px] bg-carbon p-5 sm:p-8">
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
    </section>
  );
}
