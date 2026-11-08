"use client";

import { useState } from "react";

type Item = { etiqueta: string; mensaje: string; el: HTMLElement };

function campoInvalidos(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('input[aria-invalid="true"], select[aria-invalid="true"]'));
}

function irA(el: HTMLElement) {
  el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  el.focus({ preventScroll: true });
}

/** Lleva la vista al primer campo con error (espera a que React pinte los errores). */
export function enfocarPrimerError() {
  window.setTimeout(() => {
    const primero = campoInvalidos()[0];
    if (primero) irA(primero);
  }, 60);
}

export function ErroresCampos({ n }: { n: number }) {
  const [items, setItems] = useState<Item[] | null>(null);

  function listar() {
    setItems(
      campoInvalidos().map((el) => ({
        etiqueta: el.getAttribute("aria-label") || "Campo",
        mensaje: el.title || el.parentElement?.querySelector("p")?.textContent || "Revisa este valor",
        el,
      })),
    );
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[14px] text-[#ff453a]">{n === 1 ? "Hay 1 campo por corregir." : `Hay ${n} campos por corregir.`}</span>
        <button
          type="button"
          onClick={() => (items ? setItems(null) : listar())}
          className="text-[14px] text-electric-link hover:underline"
        >
          {items ? "Ocultar" : "Ver cuáles"}
        </button>
      </div>
      {items && (
        <ul className="mt-3 max-h-56 space-y-1 overflow-auto rounded-[20px] border border-[#ff453a] p-3 text-[13px]">
          {items.length === 0 && <li className="text-ash">Ya no hay campos con error.</li>}
          {items.slice(0, 60).map((it, i) => (
            <li key={i}>
              <button type="button" onClick={() => irA(it.el)} className="text-left text-porcelain hover:underline">
                • {it.etiqueta}: <span className="text-[#ff453a]">{it.mensaje}</span>
              </button>
            </li>
          ))}
          {items.length > 60 && <li className="text-ash">…y {items.length - 60} más.</li>}
        </ul>
      )}
    </div>
  );
}
