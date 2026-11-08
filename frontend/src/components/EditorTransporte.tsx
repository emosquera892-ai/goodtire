"use client";

import { Fragment } from "react";
import { OBLIGATORIO, pegar } from "@/lib/formulario";
import {
  LIMITES_T,
  agregarDestino,
  agregarOrigen,
  quitarDestino,
  quitarOrigen,
  type ErroresT,
  type EstadoT,
} from "@/lib/transporte";
import { Matriz } from "./Editor";
import { Boton, BotonQuitar, Campo, Seccion, Th } from "./ui";

export function ReglasTransporte() {
  return (
    <section className="scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8">
      <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">
        Transporte: qué puedes introducir
      </h3>
      <div className="mt-6 grid gap-6 text-[14px] leading-[1.43] tracking-[-0.224px] sm:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold text-porcelain">Sí puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Hasta {LIMITES_T.origenes} orígenes y {LIMITES_T.destinos} destinos, con nombres de 1 a {LIMITES_T.nombre} caracteres.</li>
            <li>• Que la oferta sea mayor que la demanda: lo que sobra queda sin enviar.</li>
            <li>• Que la oferta sea menor que la demanda: se envía todo lo posible al menor costo y se muestra lo que falta.</li>
            <li>• Dejar vacío un costo para indicar que esa ruta no existe.</li>
            <li>• Números con punto o coma decimal (0.75 o 0,75).</li>
            <li>• Pegar celdas copiadas de Excel en la matriz de costos.</li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-porcelain">No puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Números negativos, letras ni notación científica (1e5).</li>
            <li>• Dejar vacías la oferta de un origen ni la demanda de un destino.</li>
            <li>• Repetir nombres dentro de orígenes o de destinos.</li>
            <li>• Un destino con demanda y todas sus rutas vacías.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

type Props = { estado: EstadoT; onCambio: (e: EstadoT) => void; errores: ErroresT; intentado: boolean };

export function EditorTransporte({ estado, onCambio, errores, intentado }: Props) {
  const err = (clave: string) => {
    const m = errores.celdas[clave];
    return m && (m !== OBLIGATORIO || intentado) ? m : undefined;
  };
  const mod = (fn: (c: EstadoT) => void) => {
    const c = structuredClone(estado);
    fn(c);
    onCambio(c);
  };
  const O = estado.origenes.length;
  const D = estado.destinos.length;

  return (
    <div className="space-y-6">
      <ReglasTransporte />

      <Seccion
        titulo="Orígenes"
        nota="De dónde sale la mercancía y cuánto puede enviar como máximo."
        acciones={
          <Boton variante="secundario" disabled={O >= LIMITES_T.origenes} onClick={() => onCambio(agregarOrigen(estado))}>
            + Origen
          </Boton>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[480px] grid-cols-[1.5fr_1fr_40px] items-start gap-x-3 gap-y-3">
            <Th>Nombre</Th>
            <Th>Oferta</Th>
            <span />
            {estado.origenes.map((o, i) => (
              <Fragment key={i}>
                <Campo
                  aria-label={`Nombre del origen ${i + 1}`}
                  value={o.nombre}
                  error={err(`o.${i}.n`)}
                  onChange={(ev) => mod((c) => void (c.origenes[i].nombre = ev.target.value))}
                />
                <Campo
                  aria-label={`Oferta de ${o.nombre || `el origen ${i + 1}`}`}
                  inputMode="decimal"
                  value={o.oferta}
                  error={err(`o.${i}.of`)}
                  onChange={(ev) => mod((c) => void (c.origenes[i].oferta = ev.target.value))}
                />
                <BotonQuitar aria-label={`Quitar origen ${i + 1}`} disabled={O <= 1} onClick={() => onCambio(quitarOrigen(estado, i))} />
              </Fragment>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Destinos"
        nota="Quiénes reciben la mercancía y cuánto necesitan."
        acciones={
          <Boton variante="secundario" disabled={D >= LIMITES_T.destinos} onClick={() => onCambio(agregarDestino(estado))}>
            + Destino
          </Boton>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[480px] grid-cols-[1.5fr_1fr_40px] items-start gap-x-3 gap-y-3">
            <Th>Nombre</Th>
            <Th>Demanda</Th>
            <span />
            {estado.destinos.map((d, j) => (
              <Fragment key={j}>
                <Campo
                  aria-label={`Nombre del destino ${j + 1}`}
                  value={d.nombre}
                  error={err(`d.${j}.n`)}
                  onChange={(ev) => mod((c) => void (c.destinos[j].nombre = ev.target.value))}
                />
                <Campo
                  aria-label={`Demanda de ${d.nombre || `el destino ${j + 1}`}`}
                  inputMode="decimal"
                  value={d.demanda}
                  error={err(`d.${j}.dem`)}
                  onChange={(ev) => mod((c) => void (c.destinos[j].demanda = ev.target.value))}
                />
                <BotonQuitar aria-label={`Quitar destino ${j + 1}`} disabled={D <= 1} onClick={() => onCambio(quitarDestino(estado, j))} />
              </Fragment>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Costo de envío por unidad"
        nota="Origen (fila) → destino (columna). Deja una celda vacía si esa ruta no está disponible. Puedes pegar una tabla de Excel."
      >
        <Matriz
          filas={estado.origenes.map((o) => o.nombre)}
          columnas={estado.destinos.map((d) => d.nombre)}
          valores={estado.costos}
          prefijo="c"
          err={err}
          onCelda={(i, j, v) => mod((c) => void (c.costos[i][j] = v))}
          onPegar={(i, j, t) => mod((c) => void (c.costos = pegar(c.costos, i, j, t)))}
        />
      </Seccion>
    </div>
  );
}
