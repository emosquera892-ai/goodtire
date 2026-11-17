"use client";

import { useState } from "react";
import { INFO, hojasGrafos, type Algoritmo, type ResultadoG } from "@/lib/grafos";
import { Exportar } from "./Exportar";
import { GrafoSvg } from "./GrafoSvg";
import { Metrica } from "./Resultados";
import { Boton, Seccion } from "./ui";

function Punto({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  );
}

function Leyenda({ alg }: { alg: Algoritmo }) {
  return (
    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ash">
      {alg === "ruta" && (
        <>
          <Punto color="var(--color-apple-blue)" texto="Camino más corto" />
          <Punto color="#ff9f0a" texto="Tramo que se está revisando" />
        </>
      )}
      {alg === "flujo" && (
        <>
          <Punto color="var(--color-apple-blue)" texto="Arco con flujo (flujo/capacidad)" />
          <Punto color="#ff453a" texto="Cuello de botella (corte mínimo)" />
          <Punto color="#30d158" texto="Lado de la fuente" />
        </>
      )}
      {alg === "arbol" && (
        <>
          <Punto color="var(--color-apple-blue)" texto="Conexión aceptada" />
          <Punto color="#ff453a" texto="Descartada (haría un ciclo)" />
        </>
      )}
    </p>
  );
}

/** Resultado y paso a paso de un problema de redes (se usa al resolver y al ver un caso compartido). */
export function ResultadosGrafos({ resultado }: { resultado: ResultadoG }) {
  const [paso, setPaso] = useState(0);
  const total = resultado.pasos.length;
  const i = Math.min(paso, total - 1);
  const actual = resultado.pasos[i];
  const final = resultado.pasos[total - 1];
  const info = INFO[resultado.algoritmo];

  return (
    <div className="imprimible space-y-6">
      <Exportar titulo={`${info.nombre} (${info.metodo})`} archivo={`grafos-${resultado.algoritmo}`} hojas={() => hojasGrafos(resultado)} />
      <Seccion id="resultado" titulo={info.nombre} nota={`Método: ${info.metodo}.`}>
        <div className={`grid gap-4 ${resultado.metricas.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {resultado.metricas.map((m) => (
            <Metrica key={m.titulo} etiqueta={m.titulo}>
              {m.valor}
            </Metrica>
          ))}
        </div>
        <p className="mt-5 max-w-3xl text-[15px] leading-[1.5] text-porcelain">{resultado.mensaje}</p>
        <div className="mt-6 rounded-[20px] bg-obsidian p-3">
          <GrafoSvg nodos={resultado.nodos} aristas={resultado.aristas} dirigido={resultado.dirigido} estilos={final.aristas} etiquetas={final.etiquetas} estilosNodo={final.nodos} />
        </div>
        <Leyenda alg={resultado.algoritmo} />
      </Seccion>

      <Seccion id="paso-a-paso" titulo="Paso a paso" nota="Avanza de a un paso para ver qué decide el algoritmo y por qué." className="no-imprimir">
        <div className="flex flex-wrap items-center gap-3">
          <Boton variante="secundario" disabled={i <= 0} onClick={() => setPaso(i - 1)}>
            ← Anterior
          </Boton>
          <Boton variante="secundario" disabled={i >= total - 1} onClick={() => setPaso(i + 1)}>
            Siguiente →
          </Boton>
          <input type="range" aria-label="Paso" min={0} max={total - 1} value={i} onChange={(e) => setPaso(Number(e.target.value))} className="min-w-40 flex-1 accent-apple-blue" />
          <span className="text-[13px] text-ash">
            Paso {i + 1} de {total}
          </span>
        </div>
        <h4 className="mt-5 text-[19px] font-semibold text-porcelain">{actual.titulo}</h4>
        <p className="mt-1 max-w-3xl text-[15px] leading-[1.5] text-ash">{actual.texto}</p>
        <div className="mt-4 rounded-[20px] bg-obsidian p-3">
          <GrafoSvg nodos={resultado.nodos} aristas={resultado.aristas} dirigido={resultado.dirigido} estilos={actual.aristas} etiquetas={actual.etiquetas} estilosNodo={actual.nodos} />
        </div>
        {actual.tabla && actual.tabla.filas.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-[13px]">
              <thead>
                <tr className="text-ash">
                  {actual.tabla.cab.map((c) => (
                    <th key={c} className="px-2 py-1.5 font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {actual.tabla.filas.map((f, k) => (
                  <tr key={k} className="border-t border-white/10 text-porcelain">
                    {f.map((c, j) => (
                      <td key={j} className="px-2 py-1.5">
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Seccion>
    </div>
  );
}
