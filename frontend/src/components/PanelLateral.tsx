"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EntradaPanel = {
  etiqueta: string;
  /** ids de los elementos a los que lleva; se usa el primero que exista en la página */
  ids?: string[];
  /** solo tiene sentido después de pulsar «Resolver» */
  resultado?: boolean;
  hijos?: EntradaPanel[];
  /** grupo desplegado por defecto (mientras el usuario no lo pliegue) */
  abierto?: boolean;
};

const buscar = (ids?: string[]) => {
  for (const id of ids ?? []) {
    const el = document.getElementById(id);
    if (el) return el;
  }
  return null;
};

const clave = (padre: string, e: EntradaPanel) => `${padre}/${e.etiqueta}`;

function hojas(entradas: EntradaPanel[], padre = ""): { k: string; ids: string[]; grupo: string }[] {
  return entradas.flatMap((e) => {
    const k = clave(padre, e);
    const propia = e.ids ? [{ k, ids: e.ids, grupo: e.hijos ? k : padre }] : [];
    return [...propia, ...(e.hijos ? hojas(e.hijos, k).map((h) => ({ ...h, grupo: h.grupo || k })) : [])];
  });
}

export function PanelLateral({ entradas, tieneResultado }: { entradas: EntradaPanel[]; tieneResultado: boolean }) {
  const [activo, setActivo] = useState<string>("");
  const [manual, setManual] = useState<Record<string, boolean>>({});
  const [movil, setMovil] = useState(false);
  const bloqueo = useRef(0);
  const lista = useMemo(() => hojas(entradas), [entradas]);

  useEffect(() => {
    let pendiente = false;
    const medir = () => {
      pendiente = false;
      if (Date.now() < bloqueo.current) return;
      let mejor = "";
      let mejorTop = -Infinity;
      let primero = "";
      let primeroTop = Infinity;
      for (const h of lista) {
        const el = buscar(h.ids);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= 140 && top > mejorTop) {
          mejorTop = top;
          mejor = h.k;
        }
        if (top < primeroTop) {
          primeroTop = top;
          primero = h.k;
        }
      }
      setActivo((a) => (a === (mejor || primero) ? a : mejor || primero));
    };
    const alMover = () => {
      if (!pendiente) {
        pendiente = true;
        requestAnimationFrame(medir);
      }
    };
    medir();
    window.addEventListener("scroll", alMover, { passive: true });
    window.addEventListener("resize", alMover);
    const obs = new MutationObserver(alMover);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", alMover);
      window.removeEventListener("resize", alMover);
      obs.disconnect();
    };
  }, [lista]);

  const ir = useCallback((ids: string[] | undefined, k: string) => {
    const el = buscar(ids);
    if (!el) return;
    // al final de la página un bloque puede no llegar arriba: se marca el elegido y se ignora el scroll un momento
    setActivo(k);
    bloqueo.current = Date.now() + 1500;
    const d = el.closest("details");
    if (d) d.open = true;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: quieto ? "auto" : "smooth", block: "start" });
    setMovil(false);
  }, []);

  const grupoActivo = lista.find((h) => h.k === activo)?.grupo ?? "";

  const fila = (e: EntradaPanel, padre: string, nivel: number) => {
    const k = clave(padre, e);
    const apagado = !!e.resultado && !tieneResultado;
    if (e.hijos) {
      const abierto = manual[k] ?? (!!e.abierto || grupoActivo === k || activo.startsWith(k + "/"));
      const tocado = activo === k || activo.startsWith(k + "/");
      return (
        <li key={k}>
          <button
            type="button"
            aria-expanded={abierto}
            onClick={() => {
              setManual((m) => ({ ...m, [k]: !abierto }));
              if (!abierto) ir(e.ids, k);
            }}
            className={`flex w-full items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-left text-[14px] font-semibold outline-none transition focus-visible:outline-2 focus-visible:outline-apple-blue ${tocado ? "text-porcelain" : "text-ash hover:text-porcelain"}`}
          >
            <span>{e.etiqueta}</span>
            <svg aria-hidden viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition ${abierto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 8l5 5 5-5" />
            </svg>
          </button>
          {abierto && <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-steel pl-2">{e.hijos.map((h) => fila(h, k, nivel + 1))}</ul>}
        </li>
      );
    }
    const sel = activo === k;
    return (
      <li key={k}>
        <button
          type="button"
          aria-current={sel ? "location" : undefined}
          aria-disabled={apagado}
          title={apagado ? "Pulsa «Resolver» para ver esto" : undefined}
          onClick={() => !apagado && ir(e.ids, k)}
          className={`w-full rounded-[12px] px-3 py-2 text-left text-[14px] outline-none transition focus-visible:outline-2 focus-visible:outline-apple-blue ${
            apagado ? "cursor-not-allowed text-ash/40" : sel ? "bg-white/10 font-semibold text-porcelain" : "text-ash hover:bg-white/5 hover:text-porcelain"
          } ${nivel === 0 ? "font-semibold" : ""}`}
        >
          {e.etiqueta}
        </button>
      </li>
    );
  };

  const lista_ = <ul className="space-y-0.5">{entradas.map((e) => fila(e, "", 0))}</ul>;

  return (
    <>
      <aside aria-label="Índice de la página" className="no-imprimir hidden lg:block">
        <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[24px] bg-carbon p-3">{lista_}</nav>
      </aside>
      <div className="no-imprimir lg:hidden">
        <button
          type="button"
          onClick={() => setMovil((v) => !v)}
          aria-expanded={movil}
          className="fixed bottom-4 left-4 z-40 rounded-full bg-apple-blue px-5 py-3 text-[14px] font-semibold text-white shadow-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {movil ? "Cerrar" : "Índice"}
        </button>
        {movil && (
          <nav aria-label="Índice de la página" className="fixed bottom-20 left-4 z-40 max-h-[70vh] w-[min(18rem,calc(100vw-2rem))] overflow-y-auto rounded-[24px] border border-steel bg-carbon p-3 shadow-2xl">
            {lista_}
          </nav>
        )}
      </div>
    </>
  );
}
