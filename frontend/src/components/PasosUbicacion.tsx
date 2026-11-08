"use client";

import { useMemo, useState } from "react";
import { ErrorApi, dinero, numero, type Problema } from "@/lib/api";
import { pasosU, type Evaluacion, type PasosU } from "@/lib/pasosUbicacion";
import { Tabla } from "./Resultados";
import { Boton, Seccion } from "./ui";

type Paso = { tipo: "modelo" } | { tipo: "descartes" } | { tipo: "eval"; e: Evaluacion } | { tipo: "final" };

function Ranking({ d }: { d: PasosU }) {
  const orden = [...d.evaluaciones].sort((a, b) => a.costo_total - b.costo_total);
  return (
    <Tabla
      columnas={["Almacenes abiertos", "Costo fijo", "Transporte", "Total"]}
      filas={orden.map((e) => [(e.es_optima ? "★ " : "") + e.almacenes.join(", "), dinero(e.costo_fijo), dinero(e.costo_transporte), dinero(e.costo_total)])}
    />
  );
}

export function PasosUbicacion({ problema }: { problema: Problema }) {
  const [datos, setDatos] = useState<PasosU | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string[]>([]);
  const [i, setI] = useState(0);

  async function cargar() {
    setCargando(true);
    setError([]);
    try {
      setDatos(await pasosU(problema));
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
      { tipo: "modelo" },
      ...(datos.descartes.length ? [{ tipo: "descartes" } as Paso] : []),
      ...datos.evaluaciones.map((e) => ({ tipo: "eval" as const, e })),
      { tipo: "final" },
    ];
  }, [datos]);
  const total = pasos.length;
  const idx = Math.min(i, Math.max(total - 1, 0));
  const p = pasos[idx];

  function vista(d: PasosU, p: Paso) {
    if (p.tipo === "modelo")
      return {
        titulo: "Paso 1 · Plantear el problema",
        cuerpo: (
          <div className="space-y-3 text-[15px] leading-[1.47] text-porcelain">
            <p>{d.modelo.idea}</p>
            <p className="text-ash">{d.modelo.objetivo}</p>
            <ul className="list-disc space-y-1 pl-5 text-ash">
              {d.modelo.variables.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <p className="font-semibold">Restricciones</p>
            <ul className="list-disc space-y-1 pl-5 text-ash">
              {d.modelo.restricciones.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>
        ),
      };
    if (p.tipo === "descartes")
      return {
        titulo: `Paso 2 · Descartar combinaciones imposibles (${d.descartes.length})`,
        cuerpo: (
          <>
            <p className="mb-3 text-[15px] text-porcelain">
              Estas combinaciones no se evalúan porque no cumplen las reglas o no alcanzan a abastecer la demanda total ({numero(d.demanda_total)}).
            </p>
            <Tabla columnas={["Combinación", "Motivo"]} filas={d.descartes.map((x) => [x.almacenes.join(", "), x.motivo])} />
          </>
        ),
      };
    if (p.tipo === "eval") {
      const e = p.e;
      return {
        titulo: `Combinación ${e.n} de ${d.evaluaciones.length} · ${e.almacenes.join(" + ")}`,
        cuerpo: (
          <div className="space-y-4">
            <p className="text-[15px] leading-[1.47] text-porcelain">
              Costo fijo: {e.detalle_fijo.map((f) => dinero(f.costo)).join(" + ")} = <strong>{dinero(e.costo_fijo)}</strong>. Al resolver el
              transporte con solo estos almacenes, el envío cuesta <strong>{dinero(e.costo_transporte)}</strong> (por el factor {numero(d.factor_unidades)}).
              Total: <strong>{dinero(e.costo_total)}</strong>.
            </p>
            <p className={`rounded-[16px] border p-3 text-[14px] ${e.mejora ? "border-[#30d158] text-[#30d158]" : "border-steel text-ash"}`}>
              {e.mejor_previo === null
                ? "Es la primera combinación factible: queda como la mejor hasta ahora."
                : e.mejora
                  ? `Mejora: ${dinero(e.costo_total)} < ${dinero(e.mejor_previo)}. Es la nueva mejor.`
                  : `No mejora: ${dinero(e.costo_total)} ≥ ${dinero(e.mejor_previo)}. Se mantiene la anterior.`}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <Tabla columnas={["Planta", "Almacén", "Unidades"]} filas={e.envios_planta_almacen.map((x) => [x.planta, x.almacen, numero(x.unidades)])} />
              <Tabla columnas={["Almacén", "Cliente", "Unidades"]} filas={e.envios_almacen_cliente.map((x) => [x.almacen, x.cliente, numero(x.unidades)])} />
            </div>
          </div>
        ),
      };
    }
    const r = d.resultado;
    return {
      titulo: "Resultado · la combinación más barata",
      cuerpo: (
        <div className="space-y-4">
          <p className="text-[15px] leading-[1.47] text-porcelain">
            Se compararon {r.evaluadas} combinaciones (y se descartaron {r.descartadas}). La mejor abre <strong>{r.almacenes.join(", ")}</strong>:
            fijo {dinero(r.costo_fijo)} + transporte {dinero(r.costo_transporte)} = <strong>{dinero(r.costo_total)}</strong>. La peor evaluada
            cuesta {dinero(r.peor)}, es decir {dinero(r.peor - r.costo_total)} más.
          </p>
          <Ranking d={d} />
        </div>
      ),
    };
  }

  const v = datos && p ? vista(datos, p) : null;

  return (
    <Seccion
      titulo="Solución paso a paso"
      nota="Cómo se decide qué almacenes abrir: se prueba cada combinación, se suma su costo fijo al de transporte y se elige la más barata."
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
      {datos && v && (
        <div aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[19px] font-semibold text-porcelain">{v.titulo}</h4>
            <span className="text-[13px] text-ash">
              Paso {idx + 1} de {total}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-steel">
            <div className="h-full bg-apple-blue transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          <div className="mt-4">{v.cuerpo}</div>
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
