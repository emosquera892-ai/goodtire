"use client";

import { numero } from "@/lib/api";
import type { ProblemaA, SolucionA } from "@/lib/asignacion";
import { hojasAsignacion } from "@/lib/exportar";
import { Contador } from "./Contador";
import { Exportar } from "./Exportar";
import { RedTransporte } from "./RedTransporte";
import { Metrica, Tabla } from "./Resultados";
import { Seccion } from "./ui";

export function ResultadosAsignacion({ solucion, problema }: { solucion: SolucionA; problema: ProblemaA }) {
  const min = solucion.objetivo === "minimizar";
  const sin = solucion.agentes_sin_tarea.length + solucion.tareas_sin_agente.length;
  return (
    <div className="imprimible space-y-6">
      <Exportar titulo="Problema de asignación" archivo="asignacion" hojas={() => hojasAsignacion(problema, solucion)} />
      <div className="overflow-hidden rounded-[28px] bg-obsidian p-4 sm:p-8">
        <RedTransporte
          origenes={problema.agentes}
          destinos={problema.tareas}
          solucion={{
            envios: solucion.asignaciones.map((a) => ({ origen: a.agente, destino: a.tarea, unidades: 1 })),
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Metrica etiqueta={min ? "Valor total mínimo" : "Valor total máximo"}>
          <Contador valor={solucion.costo_total} formato={numero} />
        </Metrica>
        <Metrica etiqueta="Asignaciones">
          <Contador valor={solucion.asignaciones.length} formato={numero} />
        </Metrica>
        <Metrica etiqueta="Sin asignar">
          <Contador valor={sin} formato={numero} />
        </Metrica>
      </div>

      <p className="text-[17px] leading-[1.47] tracking-[-0.374px] text-porcelain">
        La mejor asignación {min ? "minimiza" : "maximiza"} el total en <strong>{numero(solucion.costo_total)}</strong>.
        <span className="text-ash">
          {solucion.equilibrado
            ? " Cada agente queda con una tarea y cada tarea con un agente."
            : solucion.agentes_sin_tarea.length > 0
              ? ` Hay más agentes que tareas: quedan sin tarea ${solucion.agentes_sin_tarea.join(", ")}.`
              : ` Hay más tareas que agentes: quedan sin agente ${solucion.tareas_sin_agente.join(", ")}.`}
        </span>
      </p>

      <Seccion titulo="Asignaciones" nota="Qué agente hace cada tarea y el valor de esa asignación.">
        <Tabla
          columnas={["Agente", "Tarea", "Valor"]}
          filas={solucion.asignaciones.map((a) => [a.agente, a.tarea, numero(a.costo)])}
        />
      </Seccion>
    </div>
  );
}
