"use client";

import { useState } from "react";
import { dinero, numero } from "@/lib/api";
import type { ResumenEsc } from "@/lib/escenarios";
import { Boton, Campo, Seccion } from "./ui";

type Esc = ResumenEsc & { id: number; nombre: string };
const MAX = 4;

export function Escenarios({ actual }: { actual: ResumenEsc | null }) {
  const [lista, setLista] = useState<Esc[]>([]);
  const [siguiente, setSiguiente] = useState(1);
  const [nombre, setNombre] = useState("");

  const fmt = (v: number, moneda: boolean) => (moneda ? dinero(v) : numero(v));

  function guardar() {
    if (!actual || lista.length >= MAX) return;
    const n = nombre.trim() || `Escenario ${siguiente}`;
    setLista([...lista, { ...actual, id: siguiente, nombre: n.slice(0, 40) }]);
    setSiguiente(siguiente + 1);
    setNombre("");
  }

  const base = lista[0];
  // Estrella solo para quien gana de verdad: si todos dan el mismo valor, no hay mejor.
  const valorMejor = lista.length
    ? lista.reduce((a, b) => ((b.maximizar ? b.valor > a.valor : b.valor < a.valor) ? b : a)).valor
    : 0;
  const esMejor = (e: Esc) => Math.abs(e.valor - valorMejor) < 1e-9;
  const todosIguales = lista.length > 1 && lista.every(esMejor);
  const maxValor = Math.max(1, ...lista.map((e) => Math.abs(e.valor)));

  function cambios(e: Esc) {
    if (!base || e.id === base.id) return "Escenario base";
    const nuevos = e.items.filter((x) => !base.items.includes(x));
    const quitados = base.items.filter((x) => !e.items.includes(x));
    if (!nuevos.length && !quitados.length) return "Mismo plan";
    const corta = (v: string[], s: string) => v.slice(0, 4).map((x) => `${s} ${x}`).join(" · ") + (v.length > 4 ? ` · …(+${v.length - 4})` : "");
    return [nuevos.length ? corta(nuevos, "+") : "", quitados.length ? corta(quitados, "−") : ""].filter(Boolean).join("  |  ");
  }

  return (
    <Seccion
      id="escenarios" titulo="Comparar escenarios"
      nota="Prueba «qué pasa si…»: guarda este resultado, cambia un dato arriba (una capacidad, un costo, una restricción), pulsa «Resolver» y guarda otro. Se comparan hasta 4 escenarios; el primero es la base."
      className="mt-6"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="w-full sm:w-72">
          <Campo
            aria-label="Nombre del escenario"
            placeholder={`Escenario ${siguiente}`}
            maxLength={40}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        <Boton disabled={!actual || lista.length >= MAX} onClick={guardar}>
          Guardar resultado como escenario
        </Boton>
        {lista.length > 0 && (
          <Boton variante="secundario" onClick={() => setLista([])}>
            Limpiar
          </Boton>
        )}
      </div>
      {!actual && <p className="mt-3 text-[13px] text-ash">Primero pulsa «Resolver» para tener un resultado que guardar.</p>}
      {todosIguales && (
        <p className="mt-3 text-[13px] text-ash">Todos los escenarios dan el mismo valor: ninguno es mejor. Cambia algún dato antes de guardar el siguiente.</p>
      )}
      {lista.length >= MAX && <p className="mt-3 text-[13px] text-ash">Llegaste a {MAX} escenarios. Quita alguno para agregar otro.</p>}

      {lista.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-[20px] border border-steel">
          <table className="w-full min-w-[520px] border-collapse text-[13px]">
            <thead>
              <tr className="bg-carbon">
                <th className="p-3 text-left font-medium text-ash" />
                {lista.map((e) => (
                  <th key={e.id} scope="col" className="p-3 text-left align-top font-semibold text-porcelain">
                    <div className="flex items-start justify-between gap-2">
                      <span>
                        {e.nombre}
                        {lista.length > 1 && !todosIguales && esMejor(e) && <span className="ml-1 text-[#30d158]">★</span>}
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar ${e.nombre}`}
                        onClick={() => setLista(lista.filter((x) => x.id !== e.id))}
                        className="text-ash hover:text-porcelain"
                      >
                        ✕
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-steel">
                <th scope="row" className="p-3 text-left font-medium text-ash">
                  {base.etiquetaValor}
                </th>
                {lista.map((e) => {
                  const dif = e.valor - base.valor;
                  const bueno = base.maximizar ? dif > 0 : dif < 0;
                  const pct = base.valor !== 0 ? (100 * dif) / Math.abs(base.valor) : 0;
                  return (
                    <td key={e.id} className="p-3 align-top">
                      <p className="text-[17px] font-semibold tabular-nums text-porcelain">{fmt(e.valor, e.moneda)}</p>
                      {e.id !== base.id && Math.abs(dif) > 1e-9 && (
                        <p className={`mt-0.5 tabular-nums ${bueno ? "text-[#30d158]" : "text-[#ff453a]"}`}>
                          {dif > 0 ? "+" : "−"}
                          {fmt(Math.abs(dif), e.moneda)} ({pct > 0 ? "+" : ""}
                          {numero(Math.round(pct * 10) / 10)}%)
                        </p>
                      )}
                      {e.id !== base.id && Math.abs(dif) <= 1e-9 && <p className="mt-0.5 text-ash">Igual que la base</p>}
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-steel" aria-hidden>
                        <div className="h-full rounded-full bg-apple-blue" style={{ width: `${(100 * Math.abs(e.valor)) / maxValor}%` }} />
                      </div>
                    </td>
                  );
                })}
              </tr>
              {base.metricas.map((m, k) => (
                <tr key={m.etiqueta} className="border-t border-steel">
                  <th scope="row" className="p-3 text-left font-medium text-ash">
                    {m.etiqueta}
                  </th>
                  {lista.map((e) => (
                    <td key={e.id} className="p-3 tabular-nums text-porcelain">
                      {e.metricas[k]?.valor ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-steel">
                <th scope="row" className="p-3 text-left font-medium text-ash">
                  Cambios vs. base ({base.etiquetaItems.toLowerCase()})
                </th>
                {lista.map((e) => (
                  <td key={e.id} className="p-3 align-top text-[12px] leading-[1.4] text-porcelain">
                    {cambios(e)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Seccion>
  );
}
