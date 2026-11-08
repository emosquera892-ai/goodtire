"use client";

import type { ReactNode } from "react";
import { ejemploGoodTire } from "@/lib/formulario";
import { Tabla } from "./Resultados";

const num = (t: string) => Number(t).toLocaleString("es-CO");
const dinero = (t: string) => "$" + num(t);

function H({ n, children }: { n: number; children: ReactNode }) {
  return (
    <h4 className="mt-8 flex items-center gap-3 text-[19px] font-semibold tracking-[-0.2px] text-porcelain first:mt-0">
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

  return (
    <details className="group mt-8 rounded-[28px] bg-carbon">
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
          <B>Good Tire, Inc.</B> fabrica llantas en una sola planta, en <B>Akron (Ohio)</B>, y las vende en{" "}
          <B>{e.clientes.length} ciudades</B>. Para abastecerlas no envía directo: manda las llantas a{" "}
          <B>almacenes</B> y desde allí las reparte a los clientes.
        </P>
        <P>
          La empresa está evaluando <B>{e.almacenes.length} ciudades candidatas</B> para tener almacén. Abrir un almacén cuesta un{" "}
          <B>costo fijo</B> (se paga solo si se abre) y cada uno tiene una <B>capacidad</B> máxima. Además, enviar una llanta cuesta
          dinero en dos tramos: <B>planta → almacén</B> y <B>almacén → cliente</B>.
        </P>
        <P>
          <B>La pregunta:</B> ¿qué almacenes conviene abrir y cuántas llantas debe enviar por cada ruta para{" "}
          <B>cubrir toda la demanda</B> con el <B>menor costo total</B> (costos fijos + costos de transporte)?
        </P>
        <P>Las cantidades se miden en miles de llantas y los costos de envío en dólares por llanta.</P>

        <H n={2}>Los datos del caso</H>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-2 text-[13px] text-ash">Almacenes candidatos</p>
            <Tabla
              columnas={["Almacén", "Capacidad (miles)", "Costo fijo"]}
              filas={e.almacenes.map((a) => [a.nombre, num(a.capacidad), dinero(a.fijo)])}
            />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-[13px] text-ash">Clientes y demanda</p>
            <div className="overflow-hidden rounded-[20px] border border-steel">
              <table className="w-full border-collapse text-[13px]">
                <thead className="bg-carbon">
                  <tr>
                    <th scope="col" className="p-2.5 text-left font-medium text-ash">Cliente</th>
                    <th scope="col" className="p-2.5 text-right font-medium text-ash">Demanda (miles)</th>
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
        </div>
        <P>
          La demanda total es de <B>{num(String(dem))} mil llantas</B> y la capacidad de los cinco almacenes sumaría{" "}
          <B>{num(String(cap))} mil</B>: por eso no hace falta abrirlos todos, pero sí los suficientes. Las matrices de costo de envío
          las ves completas en las tablas de abajo al pulsar «Cargar caso Good Tire».
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

        <H n={4}>Cómo se resuelve</H>
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
