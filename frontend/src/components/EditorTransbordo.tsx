"use client";

import { Fragment } from "react";
import { OBLIGATORIO, pegar } from "@/lib/formulario";
import {
  ETIQUETA_TIPO,
  LIMITES_B,
  agregarNodo,
  quitarNodo,
  type ErroresB,
  type EstadoB,
  type TipoNodo,
} from "@/lib/transbordo";
import { Matriz } from "./Editor";
import { Boton, BotonQuitar, Campo, Seccion, Th, claseCampo } from "./ui";

export function ReglasTransbordo() {
  return (
    <section id="introducir" className="scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8">
      <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">
        Transbordo: qué puedes introducir
      </h3>
      <div className="mt-6 grid gap-6 text-[14px] leading-[1.43] tracking-[-0.224px] sm:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold text-porcelain">Sí puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Hasta {LIMITES_B.nodos} nodos de tres tipos: origen, intermedio y destino.</li>
            <li>• Rutas entre cualquier par de nodos (también origen → destino directo).</li>
            <li>• Dejar vacío un costo para indicar que esa ruta no existe.</li>
            <li>• Que la oferta sea mayor que la demanda: lo que sobra queda sin enviar.</li>
            <li>• Que la oferta sea menor que la demanda: se envía todo lo posible al menor costo y se muestra lo que falta.</li>
            <li>• Limitar cuánto puede pasar por un intermedio (capacidad opcional).</li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-porcelain">No puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Números negativos, letras ni notación científica (1e5).</li>
            <li>• Dejar vacía la oferta de un origen ni la demanda de un destino.</li>
            <li>• Repetir nombres de nodos.</li>
            <li>• Un destino con demanda y sin ninguna ruta que llegue a él.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

type Props = { estado: EstadoB; onCambio: (e: EstadoB) => void; errores: ErroresB; intentado: boolean };

const AYUDA: Record<TipoNodo, string> = {
  origen: "Oferta",
  intermedio: "Capacidad (opcional)",
  destino: "Demanda",
};

export function EditorTransbordo({ estado, onCambio, errores, intentado }: Props) {
  const err = (clave: string) => {
    const m = errores.celdas[clave];
    return m && (m !== OBLIGATORIO || intentado) ? m : undefined;
  };
  const mod = (fn: (c: EstadoB) => void) => {
    const c = structuredClone(estado);
    fn(c);
    onCambio(c);
  };
  const N = estado.nodos.length;
  const lleno = N >= LIMITES_B.nodos;

  return (
    <div className="space-y-6">
      <ReglasTransbordo />

      <Seccion
        id="d-nodos" titulo="Nodos de la red"
        nota="Origen: ofrece unidades. Intermedio: solo reenvía (bodega, centro). Destino: necesita unidades."
        acciones={
          <div className="flex flex-wrap gap-2">
            {(["origen", "intermedio", "destino"] as TipoNodo[]).map((t) => (
              <Boton key={t} variante="secundario" disabled={lleno} onClick={() => onCambio(agregarNodo(estado, t))}>
                + {ETIQUETA_TIPO[t]}
              </Boton>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[560px] grid-cols-[1.5fr_1fr_1.2fr_40px] items-start gap-x-3 gap-y-3">
            <Th>Nombre</Th>
            <Th>Tipo</Th>
            <Th>Cantidad</Th>
            <span />
            {estado.nodos.map((n, i) => (
              <Fragment key={i}>
                <Campo
                  aria-label={`Nombre del nodo ${i + 1}`}
                  value={n.nombre}
                  error={err(`n.${i}.n`)}
                  onChange={(ev) => mod((c) => void (c.nodos[i].nombre = ev.target.value))}
                />
                <select
                  aria-label={`Tipo de ${n.nombre || `el nodo ${i + 1}`}`}
                  value={n.tipo}
                  onChange={(ev) => mod((c) => void (c.nodos[i].tipo = ev.target.value as TipoNodo))}
                  className={`${claseCampo()} [color-scheme:dark]`}
                >
                  {(["origen", "intermedio", "destino"] as TipoNodo[]).map((t) => (
                    <option key={t} value={t}>
                      {ETIQUETA_TIPO[t]}
                    </option>
                  ))}
                </select>
                <Campo
                  aria-label={`${AYUDA[n.tipo]} de ${n.nombre || `el nodo ${i + 1}`}`}
                  placeholder={AYUDA[n.tipo]}
                  inputMode="decimal"
                  value={n.cantidad}
                  error={err(`n.${i}.q`)}
                  onChange={(ev) => mod((c) => void (c.nodos[i].cantidad = ev.target.value))}
                />
                <BotonQuitar aria-label={`Quitar nodo ${i + 1}`} disabled={N <= 2} onClick={() => onCambio(quitarNodo(estado, i))} />
              </Fragment>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        id="d-costos" titulo="Costo de envío por unidad"
        nota="Desde (fila) → hacia (columna). Deja vacía la celda si esa ruta no existe. La diagonal está desactivada. Puedes pegar una tabla de Excel."
      >
        <Matriz
          filas={estado.nodos.map((n) => n.nombre)}
          columnas={estado.nodos.map((n) => n.nombre)}
          valores={estado.costos}
          prefijo="c"
          err={err}
          bloqueada={(i, j) => i === j}
          onCelda={(i, j, v) => mod((c) => void (c.costos[i][j] = v))}
          onPegar={(i, j, t) => mod((c) => void (c.costos = pegar(c.costos, i, j, t)))}
        />
      </Seccion>
    </div>
  );
}
