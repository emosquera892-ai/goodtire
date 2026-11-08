"use client";

import { useState } from "react";
import { numero } from "@/lib/api";
import { hojasTransbordo } from "@/lib/exportar";
import { ETIQUETA_TIPO, type ProblemaB, type SolucionB } from "@/lib/transbordo";
import { moneda } from "@/lib/transporte";
import { Contador } from "./Contador";
import { Exportar } from "./Exportar";
import { PasosTransporte } from "./PasosTransporte";
import { mapaTransbordo } from "@/lib/mapa";
import { MapaRed } from "./MapaRed";
import { RedTransbordo } from "./RedTransbordo";
import { Metrica, Tabla } from "./Resultados";
import { Seccion } from "./ui";

export function ResultadosTransbordo({ solucion, problema }: { solucion: SolucionB; problema: ProblemaB }) {
  const [sel, setSel] = useState<string | null>(null);
  const sobrante = solucion.oferta_total - solucion.demanda_total;
  const falta = solucion.faltante_total ?? 0;
  const entregado = solucion.entregado_total ?? solucion.demanda_total;
  return (
    <div className="imprimible space-y-6">
      <Exportar titulo="Problema de transbordo" archivo="transbordo" hojas={() => hojasTransbordo(problema, solucion)} />
      <div className="overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
        <RedTransbordo nodos={problema.nodos} solucion={solucion} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica etiqueta="Costo total mínimo">
          <Contador valor={solucion.costo_total} formato={moneda} />
        </Metrica>
        <Metrica etiqueta="Unidades entregadas">
          <Contador valor={entregado} formato={numero} />
        </Metrica>
        <Metrica etiqueta="Rutas utilizadas">
          <Contador valor={solucion.flujos.length} formato={numero} />
        </Metrica>
      </div>

      <p className="text-[17px] leading-[1.47] tracking-[-0.374px] text-porcelain">
        {falta > 1e-6 ? (
          <>
            La oferta o las rutas no alcanzan: se entregan <strong>{numero(entregado)}</strong> de {numero(solucion.demanda_total)} unidades y
            faltan <strong>{numero(falta)}</strong>. Enviar todo lo posible cuesta como mínimo <strong>{moneda(solucion.costo_total)}</strong>.
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
            filas={solucion.detalle_nodos
              .filter((n) => n.tipo === "destino" && (n.faltante ?? 0) > 1e-6)
              .map((n) => [n.nombre, numero(n.cantidad ?? 0), numero(n.entra - n.sale), numero(n.faltante ?? 0)])}
          />
        </Seccion>
      )}

      <MapaRed datos={mapaTransbordo(problema, solucion)} seleccion={sel} onSeleccion={setSel} />

      <Seccion titulo="Plan de envíos" nota="Unidades por cada ruta activa y su costo.">
        <Tabla
          columnas={["Desde", "Hacia", "Unidades", "Costo/u.", "Costo"]}
          resaltar={solucion.flujos.map((f) => sel === `n:${f.desde}` || sel === `n:${f.hasta}`)}
          filas={solucion.flujos.map((f) => [f.desde, f.hasta, numero(f.unidades), numero(f.costo_unitario), moneda(f.costo)])}
        />
      </Seccion>

      <Seccion titulo="Balance por nodo" nota="Lo que entra y sale de cada nodo. En los intermedios debe ser igual.">
        <Tabla
          columnas={["Nodo", "Tipo", "Cantidad", "Entra", "Sale"]}
          resaltar={solucion.detalle_nodos.map((n) => sel === `n:${n.nombre}`)}
          filas={solucion.detalle_nodos.map((n) => [
            n.nombre,
            ETIQUETA_TIPO[n.tipo],
            n.cantidad === null ? "—" : numero(n.cantidad),
            numero(n.entra),
            numero(n.sale),
          ])}
        />
      </Seccion>

      <div className="no-imprimir">
        <PasosTransporte tipo="transbordo" key={JSON.stringify(problema)} problema={problema} />
      </div>
    </div>
  );
}
