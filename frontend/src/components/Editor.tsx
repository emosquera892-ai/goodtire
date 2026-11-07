"use client";

import { Fragment } from "react";
import {
  LIMITES,
  OBLIGATORIO,
  agregarAlmacen,
  agregarCliente,
  agregarPlanta,
  pegar,
  quitarAlmacen,
  quitarCliente,
  quitarPlanta,
  type Errores,
  type Estado,
  type Modo,
} from "@/lib/formulario";
import { Boton, BotonQuitar, Campo, Seccion, Th, claseCampo } from "./ui";

type Props = {
  estado: Estado;
  onCambio: (e: Estado) => void;
  errores: Errores;
  intentado: boolean;
};

export function Reglas() {
  return (
    <section id="reglas" className="scroll-mt-16 rounded-[28px] bg-carbon p-5 sm:p-8">
      <h3 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Qué puedes introducir</h3>
      <div className="mt-6 grid gap-6 text-[14px] leading-[1.43] tracking-[-0.224px] sm:grid-cols-2">
        <div>
          <p className="mb-2 font-semibold text-porcelain">Sí puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Hasta {LIMITES.plantas} plantas, {LIMITES.almacenes} almacenes candidatos y {LIMITES.clientes} clientes.</li>
            <li>• Nombres de 1 a {LIMITES.nombre} caracteres, distintos dentro de cada grupo.</li>
            <li>• Números con punto o coma decimal (0.75 o 0,75).</li>
            <li>• Dejar vacía la capacidad de una planta: significa ilimitada.</li>
            <li>• Marcar un almacén como «Abierto» (obligado) o «Cerrado» (excluido), y limitar cuántos se abren.</li>
            <li>• Pegar celdas copiadas de Excel en las matrices de costos.</li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-porcelain">No puedes</p>
          <ul className="space-y-1.5 text-ash">
            <li>• Números negativos, letras, símbolos ni notación científica (1e5).</li>
            <li>• Dejar vacíos: capacidad y costo fijo de almacenes, demanda y costos de envío.</li>
            <li>• Repetir nombres dentro de plantas, almacenes o clientes.</li>
            <li>• Una capacidad de almacenes menor que la demanda total (ni plantas con capacidad menor, si todas tienen límite).</li>
            <li>• Un mínimo mayor que el máximo, ni más almacenes «Abiertos» que el máximo.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Matriz({
  filas,
  columnas,
  valores,
  prefijo,
  err,
  onCelda,
  onPegar,
}: {
  filas: string[];
  columnas: string[];
  valores: string[][];
  prefijo: string;
  err: (clave: string) => string | undefined;
  onCelda: (i: number, j: number, v: string) => void;
  onPegar: (i: number, j: number, texto: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[20px] border border-steel">
      <table className="w-max min-w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-carbon p-2" />
            {columnas.map((c, j) => (
              <th key={j} scope="col" className="min-w-[92px] max-w-[140px] truncate p-2 text-left font-medium text-ash">
                {c || `#${j + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="border-t border-steel">
              <th
                scope="row"
                className="sticky left-0 z-10 max-w-[160px] truncate whitespace-nowrap bg-carbon p-2 text-left font-medium text-porcelain"
              >
                {f || `#${i + 1}`}
              </th>
              {valores[i].map((v, j) => {
                const e = err(`${prefijo}.${i}.${j}`);
                return (
                  <td key={j} className="p-1">
                    <input
                      value={v}
                      inputMode="decimal"
                      aria-label={`${f || i + 1} a ${columnas[j] || j + 1}`}
                      aria-invalid={!!e}
                      title={e}
                      onChange={(ev) => onCelda(i, j, ev.target.value)}
                      onPaste={(ev) => {
                        const t = ev.clipboardData.getData("text");
                        if (/[\t\n]/.test(t.trim())) {
                          ev.preventDefault();
                          onPegar(i, j, t);
                        }
                      }}
                      className={`${claseCampo(!!e)} !rounded-xl !px-2 text-center`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Editor({ estado, onCambio, errores, intentado }: Props) {
  const err = (clave: string) => {
    const m = errores.celdas[clave];
    return m && (m !== OBLIGATORIO || intentado) ? m : undefined;
  };
  const mod = (fn: (c: Estado) => void) => {
    const c = structuredClone(estado);
    fn(c);
    onCambio(c);
  };

  const P = estado.plantas.length;
  const W = estado.almacenes.length;
  const C = estado.clientes.length;
  const nombresP = estado.plantas.map((p) => p.nombre);
  const nombresA = estado.almacenes.map((a) => a.nombre);
  const nombresC = estado.clientes.map((c) => c.nombre);

  return (
    <div className="space-y-6">
      <Reglas />

      <Seccion
        titulo="Plantas"
        nota="De dónde salen las llantas. Deja la capacidad vacía si la planta puede producir sin límite."
        acciones={
          <Boton variante="secundario" disabled={P >= LIMITES.plantas} onClick={() => onCambio(agregarPlanta(estado))}>
            + Planta
          </Boton>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[480px] grid-cols-[1.5fr_1fr_40px] items-start gap-x-3 gap-y-3">
            <Th>Nombre</Th>
            <Th>Capacidad (vacío = ilimitada)</Th>
            <span />
            {estado.plantas.map((p, i) => (
              <Fragment key={i}>
                <Campo
                  aria-label={`Nombre de la planta ${i + 1}`}
                  value={p.nombre}
                  error={err(`p.${i}.n`)}
                  onChange={(ev) => mod((c) => void (c.plantas[i].nombre = ev.target.value))}
                />
                <Campo
                  aria-label={`Capacidad de ${p.nombre || `la planta ${i + 1}`}`}
                  inputMode="decimal"
                  placeholder="ilimitada"
                  value={p.capacidad}
                  error={err(`p.${i}.cap`)}
                  onChange={(ev) => mod((c) => void (c.plantas[i].capacidad = ev.target.value))}
                />
                <BotonQuitar aria-label={`Quitar planta ${i + 1}`} disabled={P <= 1} onClick={() => onCambio(quitarPlanta(estado, i))} />
              </Fragment>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Almacenes candidatos"
        nota="Libre: el modelo decide si abrirlo. Abierto: se abre obligatoriamente. Cerrado: queda excluido."
        acciones={
          <Boton variante="secundario" disabled={W >= LIMITES.almacenes} onClick={() => onCambio(agregarAlmacen(estado))}>
            + Almacén
          </Boton>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-[1.4fr_1fr_1fr_0.9fr_40px] items-start gap-x-3 gap-y-3">
            <Th>Nombre</Th>
            <Th>Capacidad</Th>
            <Th>Costo fijo mensual ($)</Th>
            <Th>Estado</Th>
            <span />
            {estado.almacenes.map((a, i) => (
              <Fragment key={i}>
                <Campo
                  aria-label={`Nombre del almacén ${i + 1}`}
                  value={a.nombre}
                  error={err(`a.${i}.n`)}
                  onChange={(ev) => mod((c) => void (c.almacenes[i].nombre = ev.target.value))}
                />
                <Campo
                  aria-label={`Capacidad de ${a.nombre || `el almacén ${i + 1}`}`}
                  inputMode="decimal"
                  value={a.capacidad}
                  error={err(`a.${i}.cap`)}
                  onChange={(ev) => mod((c) => void (c.almacenes[i].capacidad = ev.target.value))}
                />
                <Campo
                  aria-label={`Costo fijo de ${a.nombre || `el almacén ${i + 1}`}`}
                  inputMode="decimal"
                  value={a.fijo}
                  error={err(`a.${i}.fijo`)}
                  onChange={(ev) => mod((c) => void (c.almacenes[i].fijo = ev.target.value))}
                />
                <select
                  aria-label={`Estado de ${a.nombre || `el almacén ${i + 1}`}`}
                  value={a.modo}
                  onChange={(ev) => mod((c) => void (c.almacenes[i].modo = ev.target.value as Modo))}
                  className={`${claseCampo()} [color-scheme:dark]`}
                >
                  <option value="libre">Libre</option>
                  <option value="abierto">Abierto</option>
                  <option value="cerrado">Cerrado</option>
                </select>
                <BotonQuitar aria-label={`Quitar almacén ${i + 1}`} disabled={W <= 1} onClick={() => onCambio(quitarAlmacen(estado, i))} />
              </Fragment>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Clientes"
        nota="Quiénes reciben las llantas y cuánto necesitan por mes."
        acciones={
          <Boton variante="secundario" disabled={C >= LIMITES.clientes} onClick={() => onCambio(agregarCliente(estado))}>
            + Cliente
          </Boton>
        }
      >
        <div className="overflow-x-auto">
          <div className="grid min-w-[480px] grid-cols-[1.5fr_1fr_40px] items-start gap-x-3 gap-y-3">
            <Th>Nombre</Th>
            <Th>Demanda</Th>
            <span />
            {estado.clientes.map((c, i) => (
              <Fragment key={i}>
                <Campo
                  aria-label={`Nombre del cliente ${i + 1}`}
                  value={c.nombre}
                  error={err(`c.${i}.n`)}
                  onChange={(ev) => mod((x) => void (x.clientes[i].nombre = ev.target.value))}
                />
                <Campo
                  aria-label={`Demanda de ${c.nombre || `el cliente ${i + 1}`}`}
                  inputMode="decimal"
                  value={c.demanda}
                  error={err(`c.${i}.dem`)}
                  onChange={(ev) => mod((x) => void (x.clientes[i].demanda = ev.target.value))}
                />
                <BotonQuitar aria-label={`Quitar cliente ${i + 1}`} disabled={C <= 1} onClick={() => onCambio(quitarCliente(estado, i))} />
              </Fragment>
            ))}
          </div>
        </div>
      </Seccion>

      <Seccion
        titulo="Costo de envío: planta → almacén"
        nota="Costo por unidad enviada desde cada planta (fila) a cada almacén (columna)."
      >
        <Matriz
          filas={nombresP}
          columnas={nombresA}
          valores={estado.cpa}
          prefijo="cpa"
          err={err}
          onCelda={(i, j, v) => mod((c) => void (c.cpa[i][j] = v))}
          onPegar={(i, j, t) => mod((c) => void (c.cpa = pegar(c.cpa, i, j, t)))}
        />
      </Seccion>

      <Seccion
        titulo="Costo de envío: almacén → cliente"
        nota="Costo por unidad enviada desde cada almacén (fila) a cada cliente (columna). Puedes pegar una tabla de Excel."
      >
        <Matriz
          filas={nombresA}
          columnas={nombresC}
          valores={estado.cac}
          prefijo="cac"
          err={err}
          onCelda={(i, j, v) => mod((c) => void (c.cac[i][j] = v))}
          onPegar={(i, j, t) => mod((c) => void (c.cac = pegar(c.cac, i, j, t)))}
        />
      </Seccion>

      <Seccion titulo="Opciones" nota="Ajustes opcionales del modelo.">
        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-porcelain">Factor de unidades</span>
            <Campo
              inputMode="decimal"
              value={estado.factor}
              error={err("factor")}
              onChange={(ev) => mod((c) => void (c.factor = ev.target.value))}
            />
            <span className="mt-1 block text-[12px] text-ash">Multiplica los costos de envío. Usa 1000 si capacidades y demanda están en miles.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-porcelain">Mínimo de almacenes abiertos</span>
            <Campo
              inputMode="numeric"
              value={estado.min}
              error={err("min")}
              onChange={(ev) => mod((c) => void (c.min = ev.target.value))}
            />
            <span className="mt-1 block text-[12px] text-ash">Entero. Vacío = 0.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-porcelain">Máximo de almacenes abiertos</span>
            <Campo
              inputMode="numeric"
              placeholder="sin límite"
              value={estado.max}
              error={err("max")}
              onChange={(ev) => mod((c) => void (c.max = ev.target.value))}
            />
            <span className="mt-1 block text-[12px] text-ash">Entero. Vacío = sin límite.</span>
          </label>
        </div>
      </Seccion>
    </div>
  );
}
