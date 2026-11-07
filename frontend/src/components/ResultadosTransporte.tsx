"use client";

import { numero } from "@/lib/api";
import { moneda, type ProblemaT, type SolucionT } from "@/lib/transporte";
import { Contador } from "./Contador";
import { RedTransporte } from "./RedTransporte";
import { Barra, Metrica, Tabla } from "./Resultados";
import { Seccion } from "./ui";

export function ResultadosTransporte({ solucion, problema }: { solucion: SolucionT; problema: ProblemaT }) {
  const enviadas = solucion.detalle_destinos.reduce((s, d) => s + d.recibido, 0);
  const sobrante = solucion.oferta_total - enviadas;
  return (
    <div className="space-y-6">
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
        Se cubre toda la demanda ({numero(solucion.demanda_total)} unidades) con un costo mínimo de{" "}
        <strong>{moneda(solucion.costo_total)}</strong>.
        <span className="text-ash">
          {solucion.balanceado
            ? " El problema está balanceado: oferta y demanda coinciden."
            : ` La oferta (${numero(solucion.oferta_total)}) supera la demanda: quedan ${numero(sobrante)} unidades sin enviar.`}
        </span>
      </p>

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

      <Seccion titulo="Plan de envíos" nota="Unidades enviadas por cada ruta y su costo.">
        <Tabla
          columnas={["Origen", "Destino", "Unidades", "Costo/u.", "Costo"]}
          filas={solucion.envios.map((e) => [
            e.origen,
            e.destino,
            numero(e.unidades),
            numero(e.costo_unitario),
            moneda(e.costo),
          ])}
        />
      </Seccion>
    </div>
  );
}
