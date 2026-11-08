"use client";

import { type Fase, type Iteracion, type Termino } from "@/lib/simplex";
import { Boton } from "./ui";

export type PasoFlat = { fase: Fase; it: Iteracion; idxFase: number };

export function aplanar(fases: Fase[]): PasoFlat[] {
  return fases.flatMap((fase, idxFase) => fase.iteraciones.map((it) => ({ fase, it, idxFase })));
}

const neg = (c: string) => c.startsWith("-");
const abs = (c: string) => c.replace(/^-/, "");
const coef = (c: string) => (abs(c) === "1" ? "" : abs(c).includes("/") ? `(${abs(c)})` : abs(c));

function Expr({ k, terminos }: { k: string; terminos: Termino[] }) {
  const sinK = k === "0" && terminos.length > 0;
  return (
    <>
      {!sinK && <span>{neg(k) ? `−${abs(k)}` : k}</span>}
      {terminos.map((t, i) => (
        <span key={t.var}>
          {i === 0 && sinK ? (neg(t.coef) ? "−" : "") : ` ${neg(t.coef) ? "−" : "+"} `}
          {coef(t.coef)}
          {t.var}
        </span>
      ))}
    </>
  );
}

function Navegacion({ i, total, setI }: { i: number; total: number; setI: (n: number) => void }) {
  return (
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
  );
}

function Cabecera({ p, i, total }: { p: PasoFlat; i: number; total: number }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="text-[19px] font-semibold text-porcelain">
          {p.fase.nombre} · Iteración {p.it.n}
        </h4>
        <span className="text-[13px] text-ash">
          Paso {i + 1} de {total}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-steel">
        <div className="h-full bg-apple-blue transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>
      {p.it.n === 1 && (
        <p className="mt-3 text-[14px] leading-[1.43] text-ash">
          {p.fase.texto}
          {p.fase.nota ? ` ${p.fase.nota}` : ""}
        </p>
      )}
    </>
  );
}

export function Tabular({ pasos, i, setI }: { pasos: PasoFlat[]; i: number; setI: (n: number) => void }) {
  const total = pasos.length;
  const idx = Math.min(i, total - 1);
  const p = pasos[idx];
  const it = p.it;
  const th = "px-2 py-1.5 text-[12px] font-normal text-ash";
  return (
    <div aria-live="polite">
      <Cabecera p={p} i={idx} total={total} />
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-1 text-center text-[14px] text-porcelain">
          <thead>
            <tr>
              <th className={th} />
              <th className={th}>Cj</th>
              {it.costos.map((c, j) => (
                <th key={j} className={th}>
                  {c}
                </th>
              ))}
              <th className={th} />
              <th className={th} />
            </tr>
            <tr>
              <th className={th}>Base</th>
              <th className={th}>Cb</th>
              {it.columnas.map((c, j) => (
                <th key={j} className={`${th} ${it.entra_idx === j ? "!font-semibold !text-electric-link" : ""}`}>
                  {c}
                </th>
              ))}
              <th className={th}>Solución</th>
              <th className={th}>Razón</th>
            </tr>
          </thead>
          <tbody>
            {it.base.map((b, r) => (
              <tr key={r}>
                <th className={`${th} ${it.sale_idx === r ? "!font-semibold !text-[#ff453a]" : "!text-porcelain"}`}>{b}</th>
                <td className="text-ash">{it.cb[r]}</td>
                {it.tabla[r].map((v, j) => {
                  const pivote = it.pivote && it.pivote[0] === r && it.pivote[1] === j;
                  const col = it.entra_idx === j;
                  const fila = it.sale_idx === r;
                  return (
                    <td
                      key={j}
                      className={`h-9 rounded-[8px] border ${
                        pivote ? "border-[#30d158] bg-[#30d158]/25 font-semibold" : col ? "border-electric-link/40 bg-electric-link/10" : fila ? "border-[#ff453a]/40 bg-[#ff453a]/10" : "border-steel"
                      }`}
                    >
                      {v}
                    </td>
                  );
                })}
                <td className="rounded-[8px] border border-steel font-semibold">{it.rhs[r]}</td>
                <td className={`text-ash ${it.sale_idx === r ? "!font-semibold !text-[#ff453a]" : ""}`}>{it.razones[r] ?? "—"}</td>
              </tr>
            ))}
            <tr>
              <th className={`${th} !text-porcelain`}>Zj − Cj</th>
              <td />
              {it.fila_z.map((v, j) => (
                <td key={j} className={`h-9 rounded-[8px] border bg-white/[0.03] ${neg(v) ? "border-[#ff453a]/50 text-[#ff453a]" : "border-steel"} ${it.entra_idx === j ? "font-semibold" : ""}`}>
                  {v}
                </td>
              ))}
              <td className="rounded-[8px] border border-steel font-semibold text-electric-link">{it.z}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[15px] leading-[1.47] text-porcelain">{it.texto}</p>
      {it.optimo && it.alternativos && it.alternativos.length > 0 && (
        <p className="mt-2 text-[14px] text-ash">
          {it.alternativos.join(", ")} tiene Zj − Cj = 0 y no está en la base: existen soluciones óptimas alternativas con el mismo valor de Z.
        </p>
      )}
      <p className="mt-2 text-[13px] text-ash">
        Azul: columna que entra · rojo: fila que sale · verde: pivote. La columna «Razón» es Solución ÷ elemento de la columna que entra (solo elementos positivos).
      </p>
      <Navegacion i={idx} total={total} setI={setI} />
    </div>
  );
}

export function Algebraico({ pasos, i, setI }: { pasos: PasoFlat[]; i: number; setI: (n: number) => void }) {
  const total = pasos.length;
  const idx = Math.min(i, total - 1);
  const p = pasos[idx];
  const it = p.it;
  const col = it.entra_idx;
  const mono = "font-mono text-[14px] leading-[1.9] text-porcelain";
  const minRazon = it.sale_idx;
  return (
    <div aria-live="polite">
      <Cabecera p={p} i={idx} total={total} />
      <p className="mt-4 text-[13px] text-ash">
        Variables no básicas (valen 0): <strong className="text-porcelain">{it.algebraico.no_basicas.join(", ") || "—"}</strong>. Las básicas se despejan en función de ellas.
      </p>
      <div className="mt-3 rounded-[16px] border border-steel bg-obsidian p-4">
        <p className={mono}>
          <strong>Z</strong> = <Expr k={it.algebraico.z.const} terminos={it.algebraico.z.terminos} />
        </p>
        {it.algebraico.filas.map((f, r) => (
          <p key={r} className={`${mono} ${minRazon === r ? "text-[#ff453a]" : ""}`}>
            <strong>{f.basica}</strong> = <Expr k={f.const} terminos={f.terminos} />
          </p>
        ))}
      </div>
      <p className="mt-3 text-[14px] text-ash">
        Solución actual: {Object.entries(it.valores_base).map(([v, x]) => `${v} = ${x}`).join(", ")}; las demás valen 0. Z = <strong className="text-porcelain">{it.z}</strong>.
      </p>
      {it.entra && col !== undefined && (
        <div className="mt-4 rounded-[16px] border border-steel p-4 text-[14px] leading-[1.6] text-porcelain">
          <p>
            <strong className="text-electric-link">{it.entra}</strong> entra: es la variable que más mejora Z. Se la hace crecer hasta que alguna básica llegue a 0:
          </p>
          <ul className="mt-2 space-y-1">
            {it.algebraico.filas.map((f, r) => {
              const razon = it.razones[r];
              return (
                <li key={r} className={minRazon === r ? "font-semibold text-[#ff453a]" : "text-ash"}>
                  {razon === null ? `${f.basica}: no se hace 0 al crecer ${it.entra} (su coeficiente no es positivo).` : `${f.basica} ≥ 0 ⇒ ${it.entra} ≤ ${razon}${minRazon === r ? "  ← límite más estricto: sale " + f.basica : ""}`}
                </li>
              );
            })}
          </ul>
          {it.sale && (
            <p className="mt-2">
              Se despeja {it.entra} de la ecuación de <strong>{it.sale}</strong> y se sustituye en las demás: nueva base con {it.entra} en lugar de {it.sale}.
            </p>
          )}
          {it.ilimitado && <p className="mt-2 text-[#ff453a]">Ninguna básica limita a {it.entra}: Z crece sin límite (no acotado).</p>}
        </div>
      )}
      {it.optimo && <p className="mt-4 text-[15px] text-porcelain">{it.texto} Ya no hay variable no básica que mejore Z (todos sus coeficientes en Z empeoran o no cambian).</p>}
      <Navegacion i={idx} total={total} setI={setI} />
    </div>
  );
}
