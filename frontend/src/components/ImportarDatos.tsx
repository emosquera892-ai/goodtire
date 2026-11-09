"use client";

import { useRef, useState } from "react";
import {
  ErrorImportar,
  descargarPlantillaCSV,
  descargarPlantillaExcel,
  leerArchivo,
  type Secciones,
  type Seccion,
} from "@/lib/importar";
import { Boton } from "./ui";

/** Botón «Importar Excel/CSV» + descarga de plantillas. Va dentro de la fila de botones de cada solver. */
export function ImportarDatos<E>({
  seccionesConocidas,
  importar,
  plantilla,
  archivoPlantilla,
  onImportar,
}: {
  seccionesConocidas: string[];
  importar: (s: Secciones) => E;
  plantilla: () => Seccion[];
  archivoPlantilla: string;
  onImportar: (estado: E, nombre: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [errores, setErrores] = useState<string[]>([]);
  const [ok, setOk] = useState("");

  async function alElegir(ev: React.ChangeEvent<HTMLInputElement>) {
    const archivo = ev.target.files?.[0];
    ev.target.value = "";
    if (!archivo) return;
    setErrores([]);
    setOk("");
    setLeyendo(true);
    try {
      const estado = importar(await leerArchivo(archivo, seccionesConocidas));
      onImportar(estado, archivo.name.replace(/\.[^.]+$/, "").slice(0, 60) || "Caso importado");
      setOk(`Datos importados de «${archivo.name}». Revisa las tablas y pulsa «Resolver».`);
    } catch (e) {
      setErrores(e instanceof ErrorImportar ? e.mensajes : ["No se pudo leer el archivo."]);
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <>
      <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="sr-only" tabIndex={-1} aria-hidden onChange={(ev) => void alElegir(ev)} />
      <Boton variante="secundario" disabled={leyendo} onClick={() => input.current?.click()}>
        {leyendo ? "Leyendo…" : "Importar Excel/CSV"}
      </Boton>
      <span className="flex items-center gap-1 text-[13px] text-ash">
        Plantilla:
        <Boton variante="enlace" onClick={() => void descargarPlantillaExcel(archivoPlantilla, plantilla())}>Excel</Boton>
        <Boton variante="enlace" onClick={() => descargarPlantillaCSV(archivoPlantilla, plantilla())}>CSV</Boton>
      </span>
      {errores.length > 0 && (
        <ul role="alert" className="basis-full space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
          <li className="font-medium">No se pudo importar:</li>
          {errores.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}
      {ok && (
        <p role="status" className="basis-full text-[13px] text-porcelain">
          {ok}
        </p>
      )}
    </>
  );
}
