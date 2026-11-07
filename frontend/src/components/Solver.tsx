"use client";

import { useMemo, useRef, useState } from "react";
import {
  ErrorApi,
  actualizarCaso,
  crearCaso,
  resolver,
  type Caso,
  type Problema,
  type Solucion,
} from "@/lib/api";
import {
  aProblema,
  casoVacio,
  desdeProblema,
  ejemploGoodTire,
  hayErrores,
  validar,
  type Estado,
} from "@/lib/formulario";
import { Editor } from "./Editor";
import { MisCasos } from "./MisCasos";
import { RedLogistica } from "./RedLogistica";
import { Resultados } from "./Resultados";
import { Boton, Campo } from "./ui";

type Resultado = { solucion: Solucion; problema: Problema };

export function Solver({ usuario, pedirLogin }: { usuario: string | null; pedirLogin: () => void }) {
  const [estado, setEstado] = useState<Estado>(() => ejemploGoodTire());
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [casoActual, setCasoActual] = useState<{ id: number; nombre: string } | null>(null);
  const [nombreGuardar, setNombreGuardar] = useState("Caso Good Tire");
  const [intentado, setIntentado] = useState(false);
  const [desactualizado, setDesactualizado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorServidor, setErrorServidor] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [version, setVersion] = useState(0);
  const refResultado = useRef<HTMLDivElement>(null);

  const errores = useMemo(() => validar(estado), [estado]);
  const nCampos = Object.keys(errores.celdas).length;
  const caso = usuario ? casoActual : null;

  function cambiar(nuevo: Estado) {
    setEstado(nuevo);
    setDesactualizado(true);
    setAviso("");
  }

  function cargar(nuevo: Estado, nombre: string) {
    setEstado(nuevo);
    setResultado(null);
    setCasoActual(null);
    setNombreGuardar(nombre);
    setIntentado(false);
    setDesactualizado(false);
    setErrorServidor([]);
    setAviso("");
  }

  async function calcular() {
    setIntentado(true);
    setAviso("");
    setErrorServidor([]);
    if (hayErrores(errores)) return;
    setCargando(true);
    try {
      const problema = aProblema(estado);
      const solucion = await resolver(problema);
      setResultado({ solucion, problema });
      setDesactualizado(false);
      requestAnimationFrame(() => refResultado.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setErrorServidor(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
    } finally {
      setCargando(false);
    }
  }

  async function guardar(comoNuevo: boolean) {
    if (!usuario) {
      pedirLogin();
      return;
    }
    setIntentado(true);
    setAviso("");
    setErrorServidor([]);
    if (hayErrores(errores)) {
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
      const problema = aProblema(estado);
      const guardado =
        caso && !comoNuevo
          ? await actualizarCaso(caso.id, { nombre, datos: problema })
          : await crearCaso(nombre, problema);
      setCasoActual({ id: guardado.id, nombre: guardado.nombre });
      if (guardado.resultado) setResultado({ solucion: guardado.resultado, problema: guardado.datos });
      setDesactualizado(false);
      setVersion((v) => v + 1);
      setAviso("Caso guardado ✓");
    } catch (e) {
      setErrorServidor(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
    } finally {
      setGuardando(false);
    }
  }

  function abrir(c: Caso) {
    setEstado(desdeProblema(c.datos));
    setResultado(c.resultado ? { solucion: c.resultado, problema: c.datos } : null);
    setCasoActual({ id: c.id, nombre: c.nombre });
    setNombreGuardar(c.nombre);
    setIntentado(false);
    setDesactualizado(false);
    setErrorServidor([]);
    setAviso("");
    document.getElementById("resolver")?.scrollIntoView({ behavior: "smooth" });
  }

  const vista = {
    plantas: estado.plantas.map((p, i) => p.nombre.trim() || `Planta ${i + 1}`),
    almacenes: estado.almacenes.map((a, i) => a.nombre.trim() || `Almacén ${i + 1}`),
    clientes: estado.clientes.map((c, i) => c.nombre.trim() || `Cliente ${i + 1}`),
  };

  return (
    <section id="resolver" className="mx-auto w-full max-w-6xl scroll-mt-16 px-6 py-20">
      <h2 className="text-[clamp(32px,5vw,56px)] font-semibold leading-[1.07] tracking-[-0.015em] text-porcelain">
        Resuelve tu caso.
      </h2>
      <p className="mt-3 max-w-xl text-[17px] leading-[1.47] tracking-[-0.374px] text-ash">
        Edita las tablas, o parte del caso de Good Tire. El modelo decide qué almacenes abrir y cómo enviar cada llanta.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Boton variante="secundario" onClick={() => cargar(ejemploGoodTire(), "Caso Good Tire")}>
          Cargar caso Good Tire
        </Boton>
        <Boton variante="secundario" onClick={() => cargar(casoVacio(), "Caso nuevo")}>
          Empezar un caso vacío
        </Boton>
        {caso && <span className="text-[13px] text-ash">Editando: <strong className="text-porcelain">{caso.nombre}</strong></span>}
      </div>

      <div className="mt-6">
        <Editor estado={estado} onCambio={cambiar} errores={errores} intentado={intentado} />
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
            <Resultados solucion={resultado.solucion} problema={resultado.problema} />
          </>
        ) : (
          <div className="rounded-[28px] bg-carbon p-5 sm:p-8">
            <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Tu red</h3>
            <p className="mt-2 text-[14px] text-ash">Así se ve tu red. Pulsa «Resolver» y cobrará vida con la solución óptima.</p>
            <div className="mt-6 overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
              <RedLogistica problema={vista} />
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
            {aviso && <p className="mt-3 text-[14px] text-porcelain">{aviso}</p>}
          </>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <p className="text-[14px] text-ash">Inicia sesión para guardar tus casos y abrirlos desde cualquier dispositivo.</p>
            <Boton onClick={pedirLogin}>Entrar o crear cuenta</Boton>
          </div>
        )}
      </div>

      {usuario && (
        <div className="mt-6">
          <MisCasos key={version} activoId={caso?.id} onAbrir={abrir} />
        </div>
      )}
    </section>
  );
}
