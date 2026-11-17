"use client";

import { useEffect, useState } from "react";
import {
  ErrorApi,
  actualizarCaso,
  borrarCaso,
  compartirCaso,
  dejarDeCompartir,
  dinero,
  enlaceCompartido,
  duplicarCaso,
  listarCasos,
  obtenerCaso,
  type Caso,
  type CasoResumen,
} from "@/lib/api";
import { TIPOS } from "@/lib/tipos";
import { Boton, Campo, Seccion } from "./ui";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

export function MisCasos({ activoId, onAbrir }: { activoId?: number; onAbrir: (c: Caso) => void }) {
  const [lista, setLista] = useState<CasoResumen[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [errores, setErrores] = useState<string[]>([]);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [renombrando, setRenombrando] = useState<{ id: number; nombre: string } | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [copiado, setCopiado] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    listarCasos(1)
      .then((p) => {
        if (!vivo) return;
        setLista(p.results);
        setTotal(p.count);
        setCargando(false);
      })
      .catch((e) => {
        if (!vivo) return;
        setErrores(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
        setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const fallo = (e: unknown) => setErrores(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);

  async function recargar() {
    const p = await listarCasos(1);
    setLista(p.results);
    setTotal(p.count);
    setPagina(1);
  }

  async function verMas() {
    setCargando(true);
    try {
      const p = await listarCasos(pagina + 1);
      setLista((l) => [...l, ...p.results]);
      setPagina(pagina + 1);
    } catch (e) {
      fallo(e);
    } finally {
      setCargando(false);
    }
  }

  async function copiarEnlace(id: number, token: string) {
    try {
      await navigator.clipboard.writeText(enlaceCompartido(token));
      setCopiado(id);
      setTimeout(() => setCopiado((v) => (v === id ? null : v)), 2500);
    } catch {
      /* sin permiso del portapapeles: el enlace queda visible para copiarlo a mano */
    }
  }

  async function ejecutar(id: number, accion: () => Promise<void>) {
    setErrores([]);
    setOcupado(id);
    try {
      await accion();
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Seccion id="casos" titulo="Mis casos" nota="Los casos que guardaste. Ábrelos para editarlos o compararlos.">
      {errores.length > 0 && (
        <ul role="alert" className="mb-4 space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
          {errores.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}

      {cargando && lista.length === 0 && <p className="text-[14px] text-ash">Cargando…</p>}
      {!cargando && lista.length === 0 && errores.length === 0 && (
        <p className="text-[14px] text-ash">Aún no has guardado casos. Resuelve uno y pulsa «Guardar caso».</p>
      )}

      <ul className="space-y-3">
        {lista.map((c) => (
          <li key={c.id} className={`rounded-[20px] bg-obsidian p-4 sm:p-5 ${c.id === activoId ? "ring-1 ring-apple-blue" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {renombrando?.id === c.id ? (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={(ev) => {
                      ev.preventDefault();
                      const nombre = renombrando.nombre.trim();
                      if (!nombre) return;
                      void ejecutar(c.id, async () => {
                        await actualizarCaso(c.id, { nombre });
                        setLista((l) => l.map((x) => (x.id === c.id ? { ...x, nombre } : x)));
                        setRenombrando(null);
                      });
                    }}
                  >
                    <Campo
                      autoFocus
                      aria-label="Nuevo nombre del caso"
                      maxLength={120}
                      value={renombrando.nombre}
                      onChange={(ev) => setRenombrando({ id: c.id, nombre: ev.target.value })}
                    />
                    <Boton type="submit" disabled={ocupado === c.id}>Guardar</Boton>
                    <Boton variante="enlace" onClick={() => setRenombrando(null)}>Cancelar</Boton>
                  </form>
                ) : (
                  <p className="truncate text-[17px] font-semibold tracking-[-0.374px] text-porcelain">{c.nombre}</p>
                )}
                <p className="mt-1 text-[13px] text-ash">
                  {c.costo_total !== null ? (c.tipo === "asignacion" || c.tipo === "grafos" ? String(c.costo_total) : dinero(c.costo_total)) + " · " : ""}
                  {TIPOS[c.tipo]?.nombre ?? c.tipo} · {c.resumen || "—"} · {fecha(c.actualizado)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Boton
                  disabled={ocupado === c.id}
                  onClick={() => void ejecutar(c.id, async () => onAbrir(await obtenerCaso(c.id)))}
                >
                  Abrir
                </Boton>
                <Boton
                  variante="secundario"
                  disabled={ocupado === c.id}
                  onClick={() => void ejecutar(c.id, async () => { await duplicarCaso(c.id); await recargar(); })}
                >
                  Duplicar
                </Boton>
                <Boton variante="secundario" onClick={() => setRenombrando({ id: c.id, nombre: c.nombre })}>
                  Renombrar
                </Boton>
                {c.token_publico ? (
                  <Boton
                    variante="secundario"
                    disabled={ocupado === c.id}
                    onClick={() =>
                      void ejecutar(c.id, async () => {
                        await dejarDeCompartir(c.id);
                        setLista((l) => l.map((x) => (x.id === c.id ? { ...x, token_publico: null } : x)));
                      })
                    }
                  >
                    Dejar de compartir
                  </Boton>
                ) : (
                  <Boton
                    variante="secundario"
                    disabled={ocupado === c.id}
                    onClick={() =>
                      void ejecutar(c.id, async () => {
                        const { token } = await compartirCaso(c.id);
                        setLista((l) => l.map((x) => (x.id === c.id ? { ...x, token_publico: token } : x)));
                        await copiarEnlace(c.id, token);
                      })
                    }
                  >
                    Compartir
                  </Boton>
                )}
                {confirmar === c.id ? (
                  <>
                    <Boton
                      variante="peligro"
                      disabled={ocupado === c.id}
                      onClick={() =>
                        void ejecutar(c.id, async () => {
                          await borrarCaso(c.id);
                          setLista((l) => l.filter((x) => x.id !== c.id));
                          setTotal((t) => t - 1);
                          setConfirmar(null);
                        })
                      }
                    >
                      Sí, borrar
                    </Boton>
                    <Boton variante="enlace" onClick={() => setConfirmar(null)}>No</Boton>
                  </>
                ) : (
                  <Boton variante="enlace" onClick={() => setConfirmar(c.id)}>Borrar</Boton>
                )}
              </div>
            </div>
            {c.token_publico && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-steel pt-3">
                <span className="text-[13px] text-ash">Cualquiera con este enlace puede verlo (solo lectura):</span>
                <input
                  readOnly
                  aria-label={`Enlace para compartir ${c.nombre}`}
                  value={enlaceCompartido(c.token_publico)}
                  onFocus={(ev) => ev.currentTarget.select()}
                  className="min-w-0 flex-1 basis-60 rounded-full border border-slate bg-transparent px-3.5 py-1.5 text-[13px] text-porcelain outline-none focus-visible:outline-2 focus-visible:outline-apple-blue"
                />
                <Boton variante="secundario" onClick={() => void copiarEnlace(c.id, c.token_publico!)}>
                  {copiado === c.id ? "¡Copiado!" : "Copiar enlace"}
                </Boton>
              </div>
            )}
          </li>
        ))}
      </ul>

      {lista.length < total && (
        <Boton variante="secundario" className="mt-4" disabled={cargando} onClick={() => void verMas()}>
          {cargando ? "Cargando…" : `Ver más (${total - lista.length})`}
        </Boton>
      )}
    </Seccion>
  );
}
