"use client";

import { useMemo, useState } from "react";
import { ErrorApi, numero } from "@/lib/api";
import { METODOS, pasosB, pasosT, type Iteracion, type Matriz, type MetodoInicial, type PasoInicial, type PasosT } from "@/lib/pasosTransporte";
import type { ProblemaB } from "@/lib/transbordo";
import { moneda, type ProblemaT } from "@/lib/transporte";
import { Tabla as TablaSimple } from "./Resultados";
import { Boton, Seccion } from "./ui";

type Paso =
  | { tipo: "extra_intro" }
  | { tipo: "extra_final" }
  | { tipo: "balanceo" }
  | { tipo: "inicial"; paso: PasoInicial }
  | { tipo: "resumen_inicial" }
  | { tipo: "iter"; it: Iteracion }
  | { tipo: "final" };

type Resalte = Record<string, "entra" | "mas" | "menos" | "sale" | "nueva">;
const k = (i: number, j: number) => `${i},${j}`;

function Tabla({
  d,
  asig,
  tachF = [],
  tachC = [],
  ofertaRest,
  demandaRest,
  u,
  v,
  delta,
  resalte = {},
  pen,
  linea,
}: {
  d: PasosT;
  asig: Matriz;
  tachF?: number[];
  tachC?: number[];
  ofertaRest?: number[];
  demandaRest?: number[];
  u?: number[];
  v?: number[];
  delta?: Matriz;
  resalte?: Resalte;
  pen?: PasoInicial["penalizaciones"];
  linea?: PasoInicial["linea"];
}) {
  const clase = {
    entra: "border-electric-link bg-electric-link/20",
    mas: "border-[#30d158] bg-[#30d158]/15",
    menos: "border-[#ff453a] bg-[#ff453a]/15",
    sale: "border-[#ff453a] bg-[#ff453a]/15",
    nueva: "border-electric-link",
  } as const;
  const th = "px-2 py-1 text-[12px] font-normal text-ash";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-separate border-spacing-1 text-center text-[14px] text-porcelain">
        <thead>
          <tr>
            <th className={th} />
            {d.columnas.map((c, j) => (
              <th key={j} className={`${th} ${tachC.includes(j) ? "line-through opacity-50" : ""} ${linea?.tipo === "columna" && linea.indice === j ? "!text-electric-link" : ""}`}>
                {c}
              </th>
            ))}
            <th className={th}>{ofertaRest ? "Oferta rest." : "Oferta"}</th>
            {u && <th className={th}>u</th>}
            {pen && <th className={th}>Penaliz.</th>}
          </tr>
        </thead>
        <tbody>
          {d.filas.map((f, i) => (
            <tr key={i} className={tachF.includes(i) ? "opacity-50" : ""}>
              <th className={`${th} text-left ${tachF.includes(i) ? "line-through" : ""} ${linea?.tipo === "fila" && linea.indice === i ? "!text-electric-link" : ""}`}>{f}</th>
              {d.columnas.map((_, j) => {
                const r = resalte[k(i, j)];
                const val = asig[i][j];
                const dl = delta?.[i]?.[j];
                const tach = tachF.includes(i) || tachC.includes(j);
                return (
                  <td
                    key={j}
                    className={`relative h-14 min-w-16 rounded-[10px] border ${r ? clase[r] : "border-steel"} ${tach && !r ? "opacity-40" : ""}`}
                  >
                    <span className="absolute right-1.5 top-0.5 text-[11px] text-ash">{d.costos[i][j] === null ? "M" : numero(d.costos[i][j] as number)}</span>
                    <span className="text-[16px] font-semibold">
                      {val !== null && val !== undefined ? numero(val) : ""}
                      {r === "mas" && <sup className="ml-0.5 text-[#30d158]">+</sup>}
                      {r === "menos" && <sup className="ml-0.5 text-[#ff453a]">−</sup>}
                      {r === "entra" && <span className="text-electric-link">+θ</span>}
                    </span>
                    {val === null && dl !== null && dl !== undefined && (
                      <span className={`absolute bottom-0.5 left-1.5 text-[11px] ${dl < 0 ? "text-[#ff453a]" : "text-ash"}`}>Δ {numero(dl)}</span>
                    )}
                  </td>
                );
              })}
              <td className="text-ash">{numero(ofertaRest ? ofertaRest[i] : d.oferta[i])}</td>
              {u && <td className="font-semibold text-electric-link">{numero(u[i])}</td>}
              {pen && <td className="text-ash">{pen.filas[String(i)] !== undefined ? pen.filas[String(i)] : ""}</td>}
            </tr>
          ))}
          <tr>
            <th className={`${th} text-left`}>{demandaRest ? "Demanda rest." : "Demanda"}</th>
            {d.columnas.map((_, j) => (
              <td key={j} className="text-ash">
                {numero(demandaRest ? demandaRest[j] : d.demanda[j])}
              </td>
            ))}
            <td />
            {u && <td />}
            {pen && <td />}
          </tr>
          {v && (
            <tr>
              <th className={`${th} text-left`}>v</th>
              {v.map((x, j) => (
                <td key={j} className="font-semibold text-electric-link">
                  {numero(x)}
                </td>
              ))}
              <td />
              <td />
            </tr>
          )}
          {pen && (
            <tr>
              <th className={`${th} text-left`}>Penaliz.</th>
              {d.columnas.map((_, j) => (
                <td key={j} className="text-ash">
                  {pen.columnas[String(j)] !== undefined ? pen.columnas[String(j)] : ""}
                </td>
              ))}
              <td />
              <td />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function PasosTransporte({ problema, tipo = "transporte" }: { problema: ProblemaT | ProblemaB; tipo?: "transporte" | "transbordo" }) {
  const [datos, setDatos] = useState<PasosT | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const [i, setI] = useState(0);

  async function cargar(m: MetodoInicial) {
    setCargando(true);
    setError([]);
    try {
      setDatos(tipo === "transbordo" ? await pasosB(problema as ProblemaB, m) : await pasosT(problema as ProblemaT, m));
      setI(0);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.detalle : ["No se pudieron generar los pasos."]);
    } finally {
      setCargando(false);
    }
  }

  const pasos = useMemo<Paso[]>(() => {
    if (!datos) return [];
    return [
      ...(datos.extra ? [{ tipo: "extra_intro" } as Paso] : []),
      { tipo: "balanceo" },
      ...datos.inicial.pasos.map((paso) => ({ tipo: "inicial" as const, paso })),
      { tipo: "resumen_inicial" },
      ...datos.optimizacion.iteraciones.map((it) => ({ tipo: "iter" as const, it })),
      { tipo: "final" },
      ...(datos.extra ? [{ tipo: "extra_final" } as Paso] : []),
    ];
  }, [datos]);

  const total = pasos.length;
  const actual = pasos[Math.min(i, Math.max(total - 1, 0))];

  function contenido(d: PasosT, p: Paso) {
    const vacio: Matriz = d.filas.map(() => d.columnas.map(() => null));
    if (p.tipo === "extra_intro" && d.extra)
      return {
        titulo: d.extra.intro.titulo,
        texto: d.extra.intro.texto,
        tabla: (
          <TablaSimple
            columnas={["Nodo", "Tipo", "Oferta", "Demanda"]}
            filas={d.extra.intro.nodos.map((n) => [n.nombre, n.tipo, numero(n.oferta), numero(n.demanda)])}
          />
        ),
      };
    if (p.tipo === "extra_final" && d.extra)
      return {
        titulo: d.extra.final.titulo,
        texto: `${d.extra.final.texto} Costo total: ${moneda(d.extra.final.costo_total)}.`,
        tabla: (
          <TablaSimple
            columnas={["Desde", "Hasta", "Unidades", "Costo/u.", "Costo"]}
            filas={d.extra.final.flujos.map((f) => [f.desde, f.hasta, numero(f.unidades), numero(f.costo_unitario), moneda(f.costo)])}
          />
        ),
      };
    if (p.tipo === "balanceo")
      return {
        titulo: "Paso 0 · Preparar la tabla",
        texto: d.balanceo.texto,
        tabla: <Tabla d={d} asig={vacio} />,
      };
    if (p.tipo === "inicial") {
      const [ci, cj] = p.paso.celda;
      return {
        titulo: `${d.metodo_nombre} · ${p.paso.titulo}`,
        texto: p.paso.texto,
        tabla: (
          <Tabla
            d={d}
            asig={p.paso.asignacion}
            tachF={p.paso.tachadas.filas}
            tachC={p.paso.tachadas.columnas}
            ofertaRest={p.paso.oferta_restante}
            demandaRest={p.paso.demanda_restante}
            resalte={{ [k(ci, cj)]: "nueva" }}
            pen={p.paso.penalizaciones}
            linea={p.paso.linea}
          />
        ),
      };
    }
    if (p.tipo === "resumen_inicial") {
      const ult = d.inicial.pasos[d.inicial.pasos.length - 1];
      return {
        titulo: "Solución inicial lista",
        texto: d.extra
          ? `Con ${d.metodo_nombre.toLowerCase()} se obtiene una solución de partida (puede usar rutas ficticias de costo M). Ahora se mejora con el método MODI hasta el óptimo.`
          : `Con ${d.metodo_nombre.toLowerCase()} el costo inicial es ${moneda(d.inicial.costo)}. Es una solución factible, pero puede no ser la mejor: ahora se mejora con el método MODI.`,
        tabla: <Tabla d={d} asig={ult.asignacion} />,
      };
    }
    if (p.tipo === "iter") {
      const it = p.it;
      const r: Resalte = {};
      if (it.entrante) r[k(...it.entrante)] = "entra";
      it.ciclo?.forEach((c) => {
        if (it.entrante && c.celda[0] === it.entrante[0] && c.celda[1] === it.entrante[1]) return;
        r[k(...c.celda)] = c.signo === "+" ? "mas" : "menos";
      });
      return {
        titulo: `MODI · Iteración ${it.n}`,
        texto: `Se calculan u y v con u₁ = 0 y u + v = costo en las celdas con envío. Δ = costo − u − v en las demás. Costo actual: ${moneda(it.costo)}. ${it.texto}`,
        tabla: <Tabla d={d} asig={it.asignacion} u={it.u} v={it.v} delta={it.delta} resalte={r} />,
      };
    }
    return {
      titulo: "Solución óptima",
      texto:
        d.resultado.sin_cubrir > 1e-6
          ? `Costo mínimo ${moneda(d.resultado.costo_total)}. La oferta no alcanza: quedan ${numero(d.resultado.sin_cubrir)} unidades sin cubrir.`
          : `Costo mínimo ${moneda(d.resultado.costo_total)}. Coincide con la solución del solver.`,
      tabla: <Tabla d={d} asig={d.resultado.asignacion} />,
    };
  }

  const c = datos && actual ? contenido(datos, actual) : null;

  return (
    <Seccion
      titulo="Solución paso a paso"
      nota={
        tipo === "transbordo"
          ? "El transbordo se convierte en un problema de transporte (todos los nodos son origen y destino) y se resuelve con solución inicial + método MODI."
          : "Cómo se llega al óptimo a mano: primero una solución inicial y luego se mejora con el método MODI (u-v) hasta que ya no se pueda bajar el costo."
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[14px] text-ash">Solución inicial con:</span>
        {METODOS.map((m) => (
          <Boton key={m.id} variante="secundario" activo={datos?.metodo === m.id} disabled={cargando} onClick={() => void cargar(m.id)}>
            {m.nombre}
          </Boton>
        ))}
        {!datos && !cargando && <span className="text-[13px] text-ash">Elige un método para empezar.</span>}
        {cargando && <span className="text-[13px] text-ash">Calculando…</span>}
      </div>
      {error.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 rounded-[20px] border border-[#ff453a] p-4 text-[14px] text-porcelain">
          {error.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}
      {datos && c && (
        <div className="mt-6" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[19px] font-semibold text-porcelain">{c.titulo}</h4>
            <span className="text-[13px] text-ash">
              Paso {Math.min(i, total - 1) + 1} de {total}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-steel">
            <div className="h-full bg-apple-blue transition-all" style={{ width: `${((Math.min(i, total - 1) + 1) / total) * 100}%` }} />
          </div>
          <p className="mt-4 text-[15px] leading-[1.47] text-porcelain">{c.texto}</p>
          <div className="mt-4">{c.tabla}</div>
          {actual?.tipo === "iter" && actual.it.ciclo && (
            <p className="mt-3 text-[13px] text-ash">
              <span className="text-electric-link">Azul</span>: celda que entra · <span className="text-[#30d158]">verde (+)</span>: recibe θ ·{" "}
              <span className="text-[#ff453a]">rojo (−)</span>: cede θ = {numero(actual.it.theta ?? 0)}.
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Boton variante="secundario" disabled={i === 0} onClick={() => setI(Math.max(0, i - 1))}>
              ← Anterior
            </Boton>
            <Boton disabled={i >= total - 1} onClick={() => setI(Math.min(total - 1, i + 1))}>
              Siguiente →
            </Boton>
            <Boton variante="secundario" disabled={i >= total - 1} onClick={() => setI(total - 1)}>
              Ir al final
            </Boton>
          </div>
        </div>
      )}
    </Seccion>
  );
}
