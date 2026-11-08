"use client";

import { useState } from "react";
import { descargarExcel, type Hoja } from "@/lib/exportar";
import { Boton } from "./ui";

/** Botones «Descargar Excel» y «Descargar PDF» + encabezado que solo se ve al imprimir. */
export function Exportar({ titulo, archivo, hojas }: { titulo: string; archivo: string; hojas: () => Hoja[] }) {
  const [fecha] = useState(() => new Date().toLocaleDateString("es-CO", { dateStyle: "long" }));
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState("");

  async function excel() {
    setError("");
    setGenerando(true);
    try {
      await descargarExcel(archivo, hojas());
    } catch {
      setError("No se pudo generar el Excel. Inténtalo de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  function pdf() {
    // El nombre del archivo que propone el navegador sale del título de la página
    const anterior = document.title;
    document.title = `${archivo}-${new Date().toLocaleDateString("sv-SE")}`;
    window.addEventListener("afterprint", () => void (document.title = anterior), { once: true });
    window.print();
  }

  return (
    <>
      <div className="solo-imprimir">
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>{titulo}</h2>
        <p style={{ fontSize: 12, marginTop: 4 }}>Generado el {fecha} · Good Tire</p>
      </div>
      <div className="no-imprimir flex flex-wrap items-center justify-end gap-3">
        {error && <span className="text-[13px] text-[#ff453a]">{error}</span>}
        <Boton variante="secundario" onClick={pdf}>
          Descargar PDF
        </Boton>
        <Boton variante="secundario" disabled={generando} onClick={() => void excel()}>
          {generando ? "Generando…" : "Descargar Excel"}
        </Boton>
      </div>
    </>
  );
}
