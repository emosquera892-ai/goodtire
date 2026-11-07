"use client";

import { Fragment } from "react";
import { OBLIGATORIO, pegar } from "@/lib/formulario";
import {
  LIMITES_A,
  agregarAgente,
  agregarTarea,
  quitarAgente,
  quitarTarea,
  type ErroresA,
  type EstadoA,
  type Objetivo,
} from "@/lib/asignacion";
import { Matriz } from "./Editor";
import { Boton, BotonQuitar, Campo, Seccion, claseCampo } from "./ui";

export function ReglasAsignacion() {
  return (
    <section className="scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8">
      <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">
        Asignación: qué puedes introducir
      </h3>
      <div className="mt-6 grid gap-6 text-[14px] leading-[1.43] tracking-[-0.224px] sm:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold text-porcelain">Sí puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Hasta {LIMITES_A.agentes} agentes y {LIMITES_A.tareas} tareas, con nombres de 1 a {LIMITES_A.nombre} caracteres.</li>
            <li>• Minimizar (costos, tiempos) o maximizar (beneficios, puntajes).</li>
            <li>• Tener distinto número de agentes y de tareas: se asigna el menor de los dos.</li>
            <li>• Dejar vacía una celda para prohibir esa asignación.</li>
            <li>• Pegar celdas copiadas de Excel en la matriz.</li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-porcelain">No puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Números negativos, letras ni notación científica (1e5).</li>
            <li>• Repetir nombres dentro de agentes o de tareas.</li>
            <li>• Dejar vacía toda la fila de un agente (si hay igual o más tareas que agentes).</li>
            <li>• Dejar vacía toda la columna de una tarea (si hay igual o más agentes que tareas).</li>
            <li>• Prohibiciones que no dejen ninguna asignación posible.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Lista({
  titulo,
  nota,
  etiqueta,
  prefijo,
  valores,
  max,
  onAgregar,
  onQuitar,
  onCambio,
  err,
}: {
  titulo: string;
  nota: string;
  etiqueta: string;
  prefijo: string;
  valores: string[];
  max: number;
  onAgregar: () => void;
  onQuitar: (i: number) => void;
  onCambio: (i: number, v: string) => void;
  err: (clave: string) => string | undefined;
}) {
  return (
    <Seccion
      titulo={titulo}
      nota={nota}
      acciones={
        <Boton variante="secundario" disabled={valores.length >= max} onClick={onAgregar}>
          + {etiqueta}
        </Boton>
      }
    >
      <div className="grid grid-cols-[1fr_40px] items-start gap-x-3 gap-y-3">
        {valores.map((v, i) => (
          <Fragment key={i}>
            <Campo
              aria-label={`Nombre de ${etiqueta.toLowerCase()} ${i + 1}`}
              value={v}
              error={err(`${prefijo}.${i}.n`)}
              onChange={(ev) => onCambio(i, ev.target.value)}
            />
            <BotonQuitar aria-label={`Quitar ${etiqueta.toLowerCase()} ${i + 1}`} disabled={valores.length <= 1} onClick={() => onQuitar(i)} />
          </Fragment>
        ))}
      </div>
    </Seccion>
  );
}

type Props = { estado: EstadoA; onCambio: (e: EstadoA) => void; errores: ErroresA; intentado: boolean };

export function EditorAsignacion({ estado, onCambio, errores, intentado }: Props) {
  const err = (clave: string) => {
    const m = errores.celdas[clave];
    return m && (m !== OBLIGATORIO || intentado) ? m : undefined;
  };
  const mod = (fn: (c: EstadoA) => void) => {
    const c = structuredClone(estado);
    fn(c);
    onCambio(c);
  };

  return (
    <div className="space-y-6">
      <ReglasAsignacion />

      <div className="grid gap-6 lg:grid-cols-2">
        <Lista
          titulo="Agentes"
          nota="Quién hace el trabajo: personas, máquinas, vehículos…"
          etiqueta="Agente"
          prefijo="a"
          valores={estado.agentes}
          max={LIMITES_A.agentes}
          onAgregar={() => onCambio(agregarAgente(estado))}
          onQuitar={(i) => onCambio(quitarAgente(estado, i))}
          onCambio={(i, v) => mod((c) => void (c.agentes[i] = v))}
          err={err}
        />
        <Lista
          titulo="Tareas"
          nota="Qué hay que hacer: trabajos, rutas, puestos…"
          etiqueta="Tarea"
          prefijo="t"
          valores={estado.tareas}
          max={LIMITES_A.tareas}
          onAgregar={() => onCambio(agregarTarea(estado))}
          onQuitar={(j) => onCambio(quitarTarea(estado, j))}
          onCambio={(j, v) => mod((c) => void (c.tareas[j] = v))}
          err={err}
        />
      </div>

      <Seccion
        titulo="Costo de cada asignación"
        nota="Agente (fila) → tarea (columna). Deja una celda vacía si esa asignación está prohibida. Puedes pegar una tabla de Excel."
      >
        <Matriz
          filas={estado.agentes}
          columnas={estado.tareas}
          valores={estado.costos}
          prefijo="c"
          err={err}
          onCelda={(i, j, v) => mod((c) => void (c.costos[i][j] = v))}
          onPegar={(i, j, t) => mod((c) => void (c.costos = pegar(c.costos, i, j, t)))}
        />
      </Seccion>

      <Seccion titulo="Objetivo" nota="¿Los valores son costos que quieres minimizar o beneficios que quieres maximizar?">
        <select
          aria-label="Objetivo"
          value={estado.objetivo}
          onChange={(ev) => mod((c) => void (c.objetivo = ev.target.value as Objetivo))}
          className={`${claseCampo()} max-w-sm [color-scheme:dark]`}
        >
          <option value="minimizar">Minimizar (costos, tiempos)</option>
          <option value="maximizar">Maximizar (beneficios, puntajes)</option>
        </select>
      </Seccion>
    </div>
  );
}
