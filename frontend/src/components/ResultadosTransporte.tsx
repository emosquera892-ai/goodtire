"use client";

import { useState } from "react";
import { numero } from "@/lib/api";
import { hojasTransporte } from "@/lib/exportar";
import { moneda, type ProblemaT, type SolucionT } from "@/lib/transporte";
import { Contador } from "./Contador";
import { Exportar } from "./Exportar";
import { PasosTransporte } from "./PasosTransporte";
import { mapaTransporte } from "@/lib/mapa";
import { MapaRed } from "./MapaRed";
import { RedTransporte } from "./RedTransporte";
import { Barra, Metrica, Tabla } from "./Resultados";
import { Seccion } from "./ui";

export function ResultadosTransporte({ solucion, problema }: { solucion: SolucionT; problema: ProblemaT }) {
  const [sel, setSel] = useState<string | null>(null);
  const enviadas = solucion.detalle_destinos.reduce((s, d) => s + d.recibido, 0);
  const sobrante = solucion.oferta_total - enviadas;
  const falta = solucion.faltante_total ?? 0;
  return (
    <div className="imprimible space-y-6">
      <Exportar titulo="Problema de transporte" archivo="transporte" hojas={() => hojasTransporte(problema, solucion)} />
      <div className="overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
        <RedTransporte origenes={problema.origenes} destinos={problema.destinos} solucion={solucion} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica etiqueta="Costo total mínimo">
          <Contador valor={solucion.costo_total} formato={moneda} />
        </Metrica>
        <Metrica etiqueta="Unidades enviadas">
          <Contador valor={enviadas} formato={numero} />
        </Metrica>
        <Metrica etiqueta="Rutas utilizadas">
          <Contador valor={solucion.envios.length} formato={numero} />
        </Metrica>
      </div>

      <p className="text-[17px] leading-[1.47] tracking-[-0.374px] text-porcelain">
        {falta > 1e-6 ? (
          <>
            La oferta no alcanza: se entregan <strong>{numero(enviadas)}</strong> de {numero(solucion.demanda_total)} unidades y faltan{" "}
            <strong>{numero(falta)}</strong>. Enviar todo lo posible cuesta como mínimo <strong>{moneda(solucion.costo_total)}</strong>.
          </>
        ) : (
          <>
            Se cubre toda la demanda ({numero(solucion.demanda_total)} unidades) con un costo mínimo de{" "}
            <strong>{moneda(solucion.costo_total)}</strong>.
            <span className="text-ash">
              {solucion.balanceado
                ? " El problema está balanceado: oferta y demanda coinciden."
                : ` La oferta (${numero(solucion.oferta_total)}) supera la demanda: quedan ${numero(sobrante)} unidades sin enviar.`}
            </span>
          </>
        )}
      </p>

      {falta > 1e-6 && (
        <Seccion titulo="Demanda sin cubrir" nota="Destinos que no reciben todo lo que piden. Quedan sin cubrir donde resulta más caro abastecer.">
          <Tabla
            columnas={["Destino", "Demanda", "Recibido", "Faltante"]}
            filas={solucion.detalle_destinos
              .filter((d) => (d.faltante ?? 0) > 1e-6)
              .map((d) => [d.destino, numero(d.demanda), numero(d.recibido), numero(d.faltante ?? 0)])}
          />
        </Seccion>
      )}

      <Seccion titulo="Uso de la oferta" nota="Cuánto envía cada origen respecto a lo que puede ofrecer.">
        <div className="space-y-5">
          {solucion.detalle_origenes.map((o) => (
            <Barra
              key={o.origen}
              etiqueta={o.origen}
              uso={o.uso}
              capacidad={o.oferta}
              pct={o.oferta > 0 ? Math.round((1000 * o.uso) / o.oferta) / 10 : null}
            />
          ))}
        </div>
      </Seccion>

      <MapaRed datos={mapaTransporte(problema, solucion)} seleccion={sel} onSeleccion={setSel} />

      <Seccion id="plan" titulo="Plan de envíos" nota="Unidades enviadas por cada ruta y su costo.">
        <Tabla
          columnas={["Origen", "Destino", "Unidades", "Costo/u.", "Costo"]}
          resaltar={solucion.envios.map((e) => sel === `o:${e.origen}` || sel === `d:${e.destino}`)}
          filas={solucion.envios.map((e) => [
            e.origen,
            e.destino,
            numero(e.unidades),
            numero(e.costo_unitario),
            moneda(e.costo),
          ])}
        />
      </Seccion>

      <div className="no-imprimir">
        <PasosTransporte key={JSON.stringify(problema)} problema={problema} />
      </div>
    </div>
  );
}
