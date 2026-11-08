"use client";

import { useState } from "react";
import { ErrorApi, numero } from "@/lib/api";
import type { ProblemaA } from "@/lib/asignacion";
import { pasosA, type PasoA, type PasosAsig } from "@/lib/pasosAsignacion";
import { Tabla } from "./Resultados";
import { Boton, Seccion } from "./ui";

function Matriz({ d, p }: { d: PasosAsig; p: PasoA }) {
  const n = d.filas.length;
  const cf = p.cobertura?.filas ?? [];
  const cc = p.cobertura?.columnas ?? [];
  const elegidas = new Set((p.elegidas ?? []).map(([i, j]) => `${i},${j}`));
  const th = "px-2 py-1 text-[12px] font-normal text-ash";
  const ficticio = (idx: number, esFila: boolean) => (esFila ? idx >= d.n_agentes : idx >= d.n_tareas);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-separate border-spacing-1 text-center text-[14px] text-porcelain">
        <thead>
          <tr>
            <th className={th} />
            {d.columnas.map((c, j) => (
              <th key={j} className={`${th} ${ficticio(j, false) ? "italic" : ""} ${cc.includes(j) ? "!text-electric-link" : ""}`}>
                {c}
              </th>
            ))}
            {p.minimos && <th className={th}>mín. fila</th>}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: n }, (_, i) => (
            <tr key={i}>
              <th className={`${th} text-left ${ficticio(i, true) ? "italic" : ""} ${cf.includes(i) ? "!text-electric-link" : ""}`}>{d.filas[i]}</th>
              {Array.from({ length: n }, (_, j) => {
                const v = p.matriz[i][j];
                const el = elegidas.has(`${i},${j}`);
                const f = cf.includes(i);
                const c = cc.includes(j);
                const cero = v === 0;
                let marco = "border-steel";
                if (el) marco = "border-[#30d158] bg-[#30d158]/20";
                else if (p.tipo === "ajustar" && !f && !c) marco = "border-[#30d158]/60 bg-[#30d158]/10";
                else if (p.tipo === "ajustar" && f && c) marco = "border-[#ff453a]/60 bg-[#ff453a]/10";
                else if (f && c) marco = "border-electric-link/60 bg-electric-link/25";
                else if (f || c) marco = "border-electric-link/40 bg-electric-link/10";
                return (
                  <td key={j} className={`h-11 min-w-14 rounded-[10px] border ${marco}`}>
                    <span className={cero ? "font-semibold text-electric-link" : ""}>{v === null ? "M" : numero(v)}</span>
                    {el && d.originales[i]?.[j] !== undefined && j < d.n_tareas && i < d.n_agentes && (
                      <span className="ml-1 text-[11px] text-ash">({d.originales[i][j] === null ? "—" : numero(d.originales[i][j] as number)})</span>
                    )}
                  </td>
                );
              })}
              {p.minimos && <td className="text-[#ff453a]">−{numero(p.minimos[i])}</td>}
            </tr>
          ))}
          {p.minimos_col && (
            <tr>
              <th className={`${th} text-left`}>mín. col.</th>
              {p.minimos_col.map((m, j) => (
                <td key={j} className="text-[#ff453a]">
                  −{numero(m)}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PasosAsignacion({ problema }: { problema: ProblemaA }) {
  const [datos, setDatos] = useState<PasosAsig | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const [i, setI] = useState(0);

  async function cargar() {
    setCargando(true);
    setError([]);
    try {
      setDatos(await pasosA(problema));
      setI(0);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.detalle : ["No se pudieron generar los pasos."]);
    } finally {
      setCargando(false);
    }
  }

  const total = datos?.pasos.length ?? 0;
  const idx = Math.min(i, Math.max(total - 1, 0));
  const p = datos?.pasos[idx];

  return (
    <Seccion
      titulo="Solución paso a paso"
      nota="Método húngaro: se crean ceros restando mínimos, se cubren con el menor número de líneas y, cuando hacen falta tantas líneas como filas, se escoge un cero por fila y columna."
    >
      {!datos && (
        <Boton disabled={cargando} onClick={() => void cargar()}>
          {cargando ? "Calculando…" : "Ver paso a paso"}
        </Boton>
      )}
      {error.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 rounded-[20px] border border-[#ff453a] p-4 text-[14px] text-porcelain">
          {error.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}
      {datos && p && (
        <div aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[19px] font-semibold text-porcelain">{p.titulo}</h4>
            <span className="text-[13px] text-ash">
              Paso {idx + 1} de {total}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-steel">
            <div className="h-full bg-apple-blue transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          <p className="mt-4 text-[15px] leading-[1.47] text-porcelain">{p.texto}</p>
          <div className="mt-4">
            <Matriz d={datos} p={p} />
          </div>
          {p.cobertura && (
            <p className="mt-3 text-[13px] text-ash">
              Las filas y columnas en <span className="text-electric-link">azul</span> son las líneas que cubren los ceros
              {p.tipo === "ajustar" ? " · verde: celdas sin cubrir (se resta) · rojo: cruces (se suma)" : ""}.
            </p>
          )}
          {p.tipo === "final" && (
            <div className="mt-5 space-y-3">
              <p className="text-[15px] text-porcelain">
                {datos.objetivo === "minimizar" ? "Costo mínimo" : "Valor máximo"}: <strong>{numero(datos.resultado.costo_total)}</strong>
                {datos.resultado.agentes_sin_tarea.length > 0 && ` · sin tarea: ${datos.resultado.agentes_sin_tarea.join(", ")}`}
                {datos.resultado.tareas_sin_agente.length > 0 && ` · sin agente: ${datos.resultado.tareas_sin_agente.join(", ")}`}
              </p>
              <Tabla columnas={["Agente", "Tarea", "Valor"]} filas={datos.resultado.asignaciones.map((a) => [a.agente, a.tarea, numero(a.costo)])} />
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Boton variante="secundario" disabled={idx === 0} onClick={() => setI(Math.max(0, idx - 1))}>
              ← Anterior
            </Boton>
            <Boton disabled={idx >= total - 1} onClick={() => setI(Math.min(total - 1, idx + 1))}>
              Siguiente →
            </Boton>
            <Boton variante="secundario" disabled={idx >= total - 1} onClick={() => setI(total - 1)}>
              Ir al final
            </Boton>
          </div>
        </div>
      )}
    </Seccion>
  );
}
