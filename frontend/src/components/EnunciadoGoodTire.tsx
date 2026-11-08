"use client";

import type { ReactNode } from "react";
import { ejemploGoodTire } from "@/lib/formulario";
import { Tabla } from "./Resultados";

const num = (t: string) => Number(t).toLocaleString("es-CO");
const dinero = (t: string) => "$" + num(t);
const usd = (t: string) => "$" + Number(t).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Plan óptimo del caso (resultado del solver con los datos de arriba), en miles de llantas */
const PLAN_PA: Record<string, number> = { Cleveland: 80, Chicago: 50, Trenton: 58, Louisville: 60 };
const PLAN_AC: Record<string, number> = {
  "Cleveland|Cleveland": 30,
  "Cleveland|Dayton": 1,
  "Cleveland|Búfalo": 22,
  "Cleveland|Pittsburgh": 27,
  "Chicago|Dayton": 12,
  "Chicago|Chicago": 38,
  "Trenton|Filadelfia": 32,
  "Trenton|Boston": 26,
  "Louisville|Cincinnati": 20,
  "Louisville|Dayton": 5,
  "Louisville|Indianápolis": 16,
  "Louisville|Nashville": 19,
};

function Matriz({
  filasNombres,
  columnasNombres,
  valores,
  unidades,
}: {
  filasNombres: string[];
  columnasNombres: string[];
  valores: string[][];
  unidades: (fila: string, columna: string) => number | undefined;
}) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-steel">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th scope="col" className="bg-carbon p-2.5 text-left font-medium text-ash">Origen ↓ / Destino →</th>
            {columnasNombres.map((c) => (
              <th key={c} scope="col" className="bg-carbon p-2.5 text-right font-medium text-ash">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filasNombres.map((f, i) => {
            const usada = columnasNombres.some((c) => unidades(f, c) !== undefined);
            return (
              <tr key={f} className={`border-t border-steel ${usada ? "" : "opacity-50"}`}>
                <th scope="row" className="p-2.5 text-left font-medium text-porcelain">{f}</th>
                {valores[i].map((v, j) => {
                  const u = unidades(f, columnasNombres[j]);
                  return (
                    <td key={j} className={`p-2.5 text-right tabular-nums ${u !== undefined ? "bg-apple-blue/25 font-semibold text-porcelain" : "text-porcelain"}`}>
                      {usd(v)}
                      {u !== undefined && <span className="block text-[11px] font-medium text-electric-link">{num(String(u))} mil</span>}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const Leyenda = ({ children }: { children: ReactNode }) => (
  <p className="mt-2 flex items-start gap-2 text-[12px] leading-[1.5] text-ash">
    <span aria-hidden className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-[3px] bg-apple-blue/40" />
    <span>{children}</span>
  </p>
);

function H({ n, children, id }: { n: number; children: ReactNode; id?: string }) {
  return (
    <h4 id={id} className="mt-8 scroll-mt-20 flex items-center gap-3 text-[19px] font-semibold tracking-[-0.2px] text-porcelain first:mt-0">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-apple-blue/25 text-[13px] text-white">{n}</span>
      {children}
    </h4>
  );
}

const P = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 text-[15px] leading-[1.5] tracking-[-0.2px] text-ash">{children}</p>
);
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-porcelain">{children}</strong>;
const Li = ({ children }: { children: ReactNode }) => <li className="text-[15px] leading-[1.5] tracking-[-0.2px] text-ash">• {children}</li>;
const Formula = ({ children }: { children: ReactNode }) => (
  <pre className="mt-3 overflow-x-auto rounded-[16px] bg-obsidian p-4 text-[13px] leading-[1.7] text-porcelain">{children}</pre>
);

export function EnunciadoGoodTire() {
  const e = ejemploGoodTire();
  const cap = e.almacenes.reduce((s, a) => s + Number(a.capacidad), 0);
  const dem = e.clientes.reduce((s, c) => s + Number(c.demanda), 0);
  const ejemplo = (() => {
    const ic = e.clientes.length - 1;
    const i1 = 0;
    const i2 = e.almacenes.length - 2 >= 0 ? e.almacenes.length - 2 : 0;
    if (ic < 0 || i1 === i2) return null;
    const t1 = e.cpa[0][i1], t2 = e.cac[i1][ic], t3 = e.cpa[0][i2], t4 = e.cac[i2][ic];
    return {
      cliente: e.clientes[ic].nombre,
      a1: e.almacenes[i1].nombre, a2: e.almacenes[i2].nombre,
      t1, t2, t3, t4,
      r1: Number(t1) + Number(t2), r2: Number(t3) + Number(t4),
    };
  })();

  return (
    <details id="enunciado" className="group mt-8 scroll-mt-16 rounded-[28px] bg-carbon">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-[28px] p-5 text-porcelain outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-apple-blue sm:px-8 sm:py-6 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-[21px] font-semibold tracking-[-0.2px]">Enunciado del problema y cómo se resuelve</span>
          <span className="mt-1 block text-[14px] text-ash">El caso de Good Tire, Inc., paso a paso.</span>
        </span>
        <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-ash transition group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </summary>

      <div className="border-t border-steel p-5 sm:p-8">
        <H n={1}>El enunciado</H>
        <P>
          <B>Good Tire, Inc.</B> es una fabricante de llantas con <B>una sola planta</B>, ubicada en <B>{e.plantas[0].nombre} (Ohio)</B>. Vende sus
          llantas en <B>{e.clientes.length} ciudades</B> (los <B>clientes</B>): {e.clientes.map((c) => c.nombre).join(", ")}.
        </P>
        <P>
          La empresa <B>no envía directo</B> de la planta al cliente. Primero manda las llantas a <B>almacenes</B> (bodegas de distribución) y desde el
          almacén las reparte a cada cliente. Es decir, cada llanta recorre dos tramos: <B>planta → almacén</B> y <B>almacén → cliente</B>.
        </P>
        <P>
          Todavía no existen los almacenes: la empresa está evaluando <B>{e.almacenes.length} ciudades candidatas</B> ({e.almacenes.map((a) => a.nombre).join(", ")}).
          Abrir un almacén tiene un <B>costo fijo mensual</B> (se paga solo si se abre, venda mucho o poco) y cada uno tiene una <B>capacidad</B> máxima
          de llantas que puede repartir al mes. Además, mover cada llanta cuesta dinero en los dos tramos, y el costo cambia según el par de ciudades.
        </P>
        <P>
          <B>La pregunta:</B> ¿qué almacenes conviene abrir y cuántas llantas debe enviar por cada ruta para <B>cubrir toda la demanda</B> de los clientes
          con el <B>menor costo total mensual</B> (costos fijos + costos de transporte)?
        </P>
        <p className="mt-5 text-[13px] font-medium text-porcelain">Condiciones del caso</p>
        <ul className="mt-2 space-y-1.5">
          <Li>Toda la demanda de cada cliente debe cumplirse: no se puede dejar a ningún cliente sin llantas.</Li>
          <Li>Un cliente puede recibir llantas de <B>varios almacenes</B> a la vez, y un almacén puede atender a varios clientes.</Li>
          <Li>Un almacén cerrado no recibe ni envía nada y no cuesta nada; uno abierto paga su costo fijo completo.</Li>
          <Li>Ningún almacén puede enviar más de su capacidad. La planta de {e.plantas[0].nombre} se supone sin límite de producción.</Li>
          <Li>El costo de transporte es proporcional: enviar el doble de llantas por una ruta cuesta el doble.</Li>
          <Li>Las cantidades (capacidad y demanda) están en <B>miles de llantas</B> por mes y los costos de envío en <B>dólares por llanta</B>.</Li>
        </ul>

        <H n={2}>Los datos del caso (de dónde sale cada número)</H>
        <P>
          Son los datos del caso de estudio clásico de <B>Good Tire, Inc.</B> (Winston, tablas 9.23 y 9.24). Aquí están todos, para que no falte ninguno:
          cada tabla es un dato de entrada que luego llenarás en las secciones del mismo nombre al pulsar «Cargar caso Good Tire».
        </P>

        <p className="mb-2 mt-6 text-[14px] font-medium text-porcelain">2.1 Planta</p>
        <P>
          Una sola: <B>{e.plantas[0].nombre}</B>, con producción <B>{e.plantas[0].capacidad.trim() === "" ? "ilimitada" : num(e.plantas[0].capacidad) + " mil"}</B> (puede fabricar todo lo que
          los almacenes le pidan).
        </P>

        <p className="mb-2 mt-6 text-[14px] font-medium text-porcelain">2.2 Almacenes candidatos: capacidad y costo fijo</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <Tabla
              columnas={["Almacén", "Capacidad (miles de llantas)", "Costo fijo mensual"]}
              filas={e.almacenes.map((a) => [a.nombre, num(a.capacidad), dinero(a.fijo)])}
            />
          </div>
          <div className="min-w-0">
            <P>
              <B>Capacidad:</B> máximo de llantas (en miles) que ese almacén puede repartir a los clientes en un mes. <B>Costo fijo:</B> lo que cuesta mantenerlo
              abierto un mes (por ejemplo, arriendo y personal), independiente de cuántas llantas mueva. Si se cierra, no se paga.
            </P>
          </div>
        </div>

        <p className="mb-2 mt-6 text-[14px] font-medium text-porcelain">2.3 Clientes: demanda mensual</p>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-[20px] border border-steel">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th scope="col" className="bg-carbon p-2.5 text-left font-medium text-ash">Cliente</th>
                    <th scope="col" className="bg-carbon p-2.5 text-right font-medium text-ash">Demanda (miles de llantas)</th>
                  </tr>
                </thead>
                <tbody>
                  {e.clientes.map((c) => (
                    <tr key={c.nombre} className="border-t border-steel">
                      <td className="p-2.5 text-porcelain">{c.nombre}</td>
                      <td className="p-2.5 text-right tabular-nums text-porcelain">{num(c.demanda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="min-w-0">
            <P>
              <B>Demanda:</B> llantas (en miles) que ese cliente necesita recibir cada mes. La demanda total es de <B>{num(String(dem))} mil llantas</B> y la
              capacidad de los {e.almacenes.length} almacenes sumaría <B>{num(String(cap))} mil</B>: por eso no hace falta abrirlos todos, pero sí los
              suficientes.
            </P>
          </div>
        </div>

        <p className="mb-2 mt-6 text-[14px] font-medium text-porcelain">2.4 Costo de envío planta → almacén (dólares por llanta)</p>
        <Matriz filasNombres={e.plantas.map((p) => p.nombre)} columnasNombres={e.almacenes.map((a) => a.nombre)} valores={e.cpa} unidades={(_, a) => PLAN_PA[a]} />
        <Leyenda>Celda resaltada: ruta que usa el plan ganador. El número azul son las llantas (en miles) que se envían por esa ruta. Harrisburg no recibe nada: queda cerrado.</Leyenda>
        <P>
          Lo que cuesta llevar <B>una llanta</B> desde {e.plantas[0].nombre} hasta cada almacén. Lee la fila de la planta y busca la columna del almacén:
          por ejemplo, {e.plantas[0].nombre} → {e.almacenes[0].nombre} cuesta <B>{usd(e.cpa[0][0])}</B> por llanta.
        </P>

        <p className="mb-2 mt-6 text-[14px] font-medium text-porcelain">2.5 Costo de envío almacén → cliente (dólares por llanta)</p>
        <Matriz filasNombres={e.almacenes.map((a) => a.nombre)} columnasNombres={e.clientes.map((c) => c.nombre)} valores={e.cac} unidades={(a, c) => PLAN_AC[`${a}|${c}`]} />
        <Leyenda>Celdas resaltadas: las combinaciones almacén → cliente del plan ganador, con las llantas (en miles) de cada una. La fila atenuada es el almacén que se deja cerrado (Harrisburg). Cada columna suma exactamente la demanda del cliente: Dayton, por ejemplo, se abastece desde tres almacenes (1 + 12 + 5 = 18 mil).</Leyenda>
        <P>
          Lo que cuesta llevar <B>una llanta</B> desde un almacén (fila) hasta un cliente (columna). Por ejemplo, {e.almacenes[0].nombre} → {e.clientes[0].nombre}{" "}
          cuesta <B>{usd(e.cac[0][0])}</B>, mientras que {e.almacenes[0].nombre} → {e.clientes[e.clientes.length - 1].nombre} cuesta{" "}
          <B>{usd(e.cac[0][e.clientes.length - 1])}</B>: a mayor distancia, mayor costo.
        </P>

        <p className="mb-2 mt-6 text-[14px] font-medium text-porcelain">2.6 Cómo leer los costos: ejemplo completo</p>
        {ejemplo && (
          <>
            <P>
              Llevar llantas de {e.plantas[0].nombre} a <B>{ejemplo.cliente}</B> pasando por <B>{ejemplo.a1}</B> cuesta {usd(ejemplo.t1)} + {usd(ejemplo.t2)} ={" "}
              <B>{usd(String(ejemplo.r1))} por llanta</B>; pasando por <B>{ejemplo.a2}</B> cuesta {usd(ejemplo.t3)} + {usd(ejemplo.t4)} ={" "}
              <B>{usd(String(ejemplo.r2))} por llanta</B>. Pero el transporte no es lo único: el almacén elegido hay que abrirlo y pagar su costo fijo. (En el plan ganador, Boston se abastece desde Trenton: mira las celdas resaltadas arriba.)
            </P>
            <P>
              Como las cantidades van en miles, el costo se multiplica por 1.000: enviar <B>1 mil</B> llantas a {usd(ejemplo.t4)} cada una cuesta{" "}
              <B>{dinero(String(Number(ejemplo.t4) * 1000))}</B>. Por eso el modelo usa un <B>factor de unidades = 1.000</B>.
            </P>
          </>
        )}
        <P>
          Ese es justo el dilema del problema: <B>abrir más almacenes baja el transporte</B> (hay uno más cerca de cada cliente) pero <B>sube los costos fijos</B>.
          La app busca el punto donde la suma de ambos es la menor posible.
        </P>

        <H n={3}>Cómo se modela</H>
        <P>
          Es un problema de <B>programación lineal entera mixta</B>. Mixta porque mezcla dos tipos de decisiones:
        </P>
        <ul className="mt-3 space-y-1.5">
          <Li>
            <B>¿Abrir o no el almacén w?</B> Decisión sí/no: variable binaria <code className="text-porcelain">y(w)</code> (1 = abierto, 0 = cerrado). No se
            puede abrir «medio almacén».
          </Li>
          <Li>
            <B>¿Cuántas llantas por cada ruta?</B> Variables continuas: <code className="text-porcelain">x(p,w)</code> de la planta al almacén y{" "}
            <code className="text-porcelain">z(w,c)</code> del almacén al cliente.
          </Li>
        </ul>
        <p className="mt-5 text-[13px] font-medium text-porcelain">Objetivo: minimizar el costo total</p>
        <Formula>{`costo fijo de los almacenes abiertos  =  Σ fijo(w) · y(w)
costo de transporte                    =  1000 · [ Σ c(p,w) · x(p,w)  +  Σ c(w,c) · z(w,c) ]
costo total                            =  costo fijo + costo de transporte`}</Formula>
        <p className="mt-5 text-[13px] font-medium text-porcelain">Restricciones</p>
        <Formula>{`1. Demanda:        para cada cliente c,   Σ z(w,c) = demanda(c)
2. Conservación:   para cada almacén w,   lo que entra = lo que sale
                                          Σ x(p,w) = Σ z(w,c)
3. Capacidad:      para cada almacén w,   Σ z(w,c) ≤ capacidad(w) · y(w)
                   (si y(w)=0, no puede enviar nada)
4. Enlace:         z(w,c) ≤ demanda(c) · y(w)
5. Planta:         Σ x(p,w) ≤ capacidad(p)         (si la planta tiene límite)
6. Opcionales:     mínimo / máximo de almacenes, forzar abrir o cerrar uno`}</Formula>
        <P>
          La restricción 3 es la clave: une las dos decisiones. Si el almacén está cerrado, su capacidad efectiva es cero; si está abierto,
          se paga su costo fijo y puede enviar hasta su capacidad.
        </P>

        <H n={4} id="enunciado-como">Cómo se resuelve</H>
        <ul className="mt-3 space-y-1.5">
          <Li>
            Se envía el modelo a un solver (<B>CBC</B>, con la librería PuLP), que usa <B>ramificación y acotamiento</B> (branch and bound):
            primero resuelve el problema permitiendo que y(w) sea una fracción entre 0 y 1; si alguna sale fraccionaria, ramifica en «w
            cerrado» y «w abierto» y descarta las ramas que ya no pueden mejorar el mejor costo encontrado.
          </Li>
          <Li>
            Con pocos almacenes, la app también resuelve <B>cada combinación posible</B>: para cada una, el problema se vuelve un transporte
            sencillo (ya sabes cuáles están abiertos). Así ves la tabla de comparación y compruebas que la elegida es la más barata.
          </Li>
          <Li>
            Antes de resolver se valida que los datos sean coherentes (sin negativos, sin nombres repetidos, capacidad suficiente), y el cálculo
            se hace siempre en el servidor.
          </Li>
        </ul>

        <H n={5}>El resultado del caso Good Tire</H>
        <P>
          La solución óptima es abrir <B>Cleveland, Chicago, Trenton y Louisville</B> y <B>dejar cerrado Harrisburg</B>. El costo total es de{" "}
          <B>$422.540</B>: $115.000 de costos fijos más $307.540 de transporte.
        </P>
        <P>
          ¿Por qué no abrir también Harrisburg? Con los cinco almacenes el transporte bajaría a $292.850 (un ahorro de $14.690), pero su costo
          fijo es de $20.000 y el total subiría a $427.850. <B>El ahorro en transporte no compensa el costo de abrirlo.</B>
        </P>

        <H n={6}>Cómo probarlo aquí</H>
        <ul className="mt-3 space-y-1.5">
          <Li>Pulsa «Cargar caso Good Tire» y luego «Resolver»: verás los almacenes abiertos, las rutas y la comparación.</Li>
          <Li>Cambia un costo fijo, una capacidad o una demanda y vuelve a resolver para ver cómo cambia la decisión.</Li>
          <Li>Fuerza un almacén a abierto o cerrado, o limita el número máximo de almacenes, y compara el costo.</Li>
        </ul>
      </div>
    </details>
  );
}
