import type { Problema, Solucion } from "./api";
import type { ProblemaA, SolucionA } from "./asignacion";
import type { ProblemaB, SolucionB } from "./transbordo";
import type { ProblemaT, SolucionT } from "./transporte";

export type Celda = string | number | null;
export type Bloque = { titulo?: string; columnas?: string[]; filas: Celda[][] };
export type Hoja = { nombre: string; bloques: Bloque[] };

const hoy = () => new Date().toLocaleDateString("es-CO", { dateStyle: "long" });
const nombreHoja = (n: string) => n.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

/** Arma y descarga un .xlsx (la librería se carga solo al pulsar el botón). */
export async function descargarExcel(archivo: string, hojas: Hoja[]) {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Good Tire";
  libro.created = new Date();

  for (const h of hojas) {
    const ws = libro.addWorksheet(nombreHoja(h.nombre));
    const anchos: number[] = [];
    const medir = (j: number, v: Celda) => {
      const largo = v === null ? 0 : String(v).length;
      anchos[j] = Math.min(48, Math.max(anchos[j] ?? 10, largo + 2));
    };
    for (const b of h.bloques) {
      if (b.titulo) {
        const f = ws.addRow([b.titulo]);
        f.font = { bold: true, size: 13 };
      }
      if (b.columnas) {
        const f = ws.addRow(b.columnas);
        f.font = { bold: true, color: { argb: "FFFFFFFF" } };
        f.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D1D1F" } };
          c.alignment = { horizontal: "center" };
        });
        b.columnas.forEach((c, j) => medir(j, c));
      }
      for (const fila of b.filas) {
        ws.addRow(fila.map((v) => (v === null ? "" : v)));
        fila.forEach((v, j) => medir(j, v));
      }
      ws.addRow([]);
    }
    anchos.forEach((a, j) => (ws.getColumn(j + 1).width = a));
  }

  const buf = await libro.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${archivo}-${new Date().toLocaleDateString("sv-SE")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const resumen = (problema: string, pares: [string, Celda][]): Hoja => ({
  nombre: "Resumen",
  bloques: [{ columnas: ["Concepto", "Valor"], filas: [["Problema", problema], ["Fecha", hoy()], ...pares] }],
});

const matriz = (titulo: string, filas: string[], columnas: string[], valores: Celda[][]): Bloque => ({
  titulo,
  columnas: ["", ...columnas],
  filas: filas.map((f, i) => [f, ...valores[i]]),
});

/* ---------- Ubicación de almacenes ---------- */

export function hojasUbicacion(p: Problema, s: Solucion): Hoja[] {
  const hojas: Hoja[] = [
    resumen("Ubicación de almacenes", [
      ["Costo total", s.costo_total],
      ["Costos fijos", s.costo_fijo_total],
      ["Costo de transporte", s.costo_transporte_total],
      ["Almacenes abiertos", s.almacenes_abiertos.join(", ")],
    ]),
    {
      nombre: "Datos",
      bloques: [
        { titulo: "Plantas", columnas: ["Planta", "Capacidad"], filas: p.plantas.map((n, i) => [n, p.capacidad_plantas[i] ?? "ilimitada"]) },
        {
          titulo: "Almacenes candidatos",
          columnas: ["Almacén", "Capacidad", "Costo fijo"],
          filas: p.almacenes.map((n, i) => [n, p.capacidad_almacenes[i], p.costo_fijo[i]]),
        },
        { titulo: "Clientes", columnas: ["Cliente", "Demanda"], filas: p.clientes.map((n, i) => [n, p.demanda[i]]) },
        matriz("Costo por unidad: planta → almacén", p.plantas, p.almacenes, p.costo_planta_almacen),
        matriz("Costo por unidad: almacén → cliente", p.almacenes, p.clientes, p.costo_almacen_cliente),
        { titulo: "Parámetros", columnas: ["Concepto", "Valor"], filas: [["Factor de unidades", p.factor_unidades]] },
      ],
    },
    {
      nombre: "Almacenes abiertos",
      bloques: [
        {
          columnas: ["Almacén", "Capacidad", "Uso", "Utilización (%)", "Costo fijo"],
          filas: s.detalle_almacenes.map((a) => [a.almacen, a.capacidad, a.uso, a.utilizacion_pct, a.costo_fijo]),
        },
        {
          titulo: "Plantas",
          columnas: ["Planta", "Capacidad", "Uso", "Utilización (%)"],
          filas: s.detalle_plantas.map((a) => [a.planta, a.capacidad ?? "ilimitada", a.uso, a.utilizacion_pct]),
        },
      ],
    },
    {
      nombre: "Envíos",
      bloques: [
        {
          titulo: "Planta → almacén",
          columnas: ["Planta", "Almacén", "Unidades", "Costo/u."],
          filas: s.envios_planta_almacen.map((e) => [e.planta, e.almacen, e.unidades, e.costo_unitario]),
        },
        {
          titulo: "Almacén → cliente",
          columnas: ["Almacén", "Cliente", "Unidades", "Costo/u."],
          filas: s.envios_almacen_cliente.map((e) => [e.almacen, e.cliente, e.unidades, e.costo_unitario]),
        },
      ],
    },
  ];
  if (s.comparacion) {
    hojas.push({
      nombre: "Comparación",
      bloques: [
        {
          columnas: ["Almacenes abiertos", "Costo fijo", "Transporte", "Costo total"],
          filas: s.comparacion.map((f) => [f.almacenes.join(", "), f.costo_fijo, f.costo_transporte, f.costo_total]),
        },
      ],
    });
  }
  return hojas;
}

/* ---------- Transporte ---------- */

export function hojasTransporte(p: ProblemaT, s: SolucionT): Hoja[] {
  const falta = s.faltante_total ?? 0;
  return [
    resumen("Transporte", [
      ["Costo total mínimo", s.costo_total],
      ["Oferta total", s.oferta_total],
      ["Demanda total", s.demanda_total],
      ["Unidades entregadas", s.entregado_total ?? s.demanda_total],
      ["Demanda sin cubrir", falta],
    ]),
    {
      nombre: "Datos",
      bloques: [
        { titulo: "Orígenes", columnas: ["Origen", "Oferta"], filas: p.origenes.map((n, i) => [n, p.oferta[i]]) },
        { titulo: "Destinos", columnas: ["Destino", "Demanda"], filas: p.destinos.map((n, i) => [n, p.demanda[i]]) },
        matriz("Costo por unidad (vacío = ruta no disponible)", p.origenes, p.destinos, p.costos),
      ],
    },
    {
      nombre: "Plan de envíos",
      bloques: [
        {
          columnas: ["Origen", "Destino", "Unidades", "Costo/u.", "Costo"],
          filas: s.envios.map((e) => [e.origen, e.destino, e.unidades, e.costo_unitario, e.costo]),
        },
      ],
    },
    {
      nombre: "Oferta y demanda",
      bloques: [
        {
          titulo: "Uso de la oferta",
          columnas: ["Origen", "Oferta", "Uso", "Sobrante"],
          filas: s.detalle_origenes.map((o) => [o.origen, o.oferta, o.uso, o.sobrante]),
        },
        {
          titulo: "Cobertura de la demanda",
          columnas: ["Destino", "Demanda", "Recibido", "Faltante"],
          filas: s.detalle_destinos.map((d) => [d.destino, d.demanda, d.recibido, d.faltante ?? 0]),
        },
      ],
    },
  ];
}

/* ---------- Transbordo ---------- */

export function hojasTransbordo(p: ProblemaB, s: SolucionB): Hoja[] {
  const nombres = p.nodos.map((n) => n.nombre);
  const falta = s.faltante_total ?? 0;
  return [
    resumen("Transbordo", [
      ["Costo total mínimo", s.costo_total],
      ["Oferta total", s.oferta_total],
      ["Demanda total", s.demanda_total],
      ["Unidades entregadas", s.entregado_total ?? s.demanda_total],
      ["Demanda sin cubrir", falta],
    ]),
    {
      nombre: "Datos",
      bloques: [
        {
          titulo: "Nodos",
          columnas: ["Nodo", "Tipo", "Cantidad (oferta, demanda o capacidad)"],
          filas: p.nodos.map((n) => [n.nombre, n.tipo, n.cantidad]),
        },
        matriz("Costo por unidad (vacío = no hay ruta)", nombres, nombres, p.costos),
      ],
    },
    {
      nombre: "Plan de envíos",
      bloques: [
        {
          columnas: ["Desde", "Hacia", "Unidades", "Costo/u.", "Costo"],
          filas: s.flujos.map((f) => [f.desde, f.hasta, f.unidades, f.costo_unitario, f.costo]),
        },
      ],
    },
    {
      nombre: "Balance por nodo",
      bloques: [
        {
          columnas: ["Nodo", "Tipo", "Cantidad", "Entra", "Sale", "Faltante"],
          filas: s.detalle_nodos.map((n) => [n.nombre, n.tipo, n.cantidad, n.entra, n.sale, n.faltante ?? 0]),
        },
      ],
    },
  ];
}

/* ---------- Asignación ---------- */

export function hojasAsignacion(p: ProblemaA, s: SolucionA): Hoja[] {
  return [
    resumen("Asignación", [
      ["Objetivo", s.objetivo === "minimizar" ? "Minimizar" : "Maximizar"],
      ["Valor total", s.costo_total],
      ["Asignaciones", s.asignaciones.length],
      ["Agentes sin tarea", s.agentes_sin_tarea.join(", ") || "ninguno"],
      ["Tareas sin agente", s.tareas_sin_agente.join(", ") || "ninguna"],
    ]),
    { nombre: "Datos", bloques: [matriz("Valor de cada asignación (vacío = prohibida)", p.agentes, p.tareas, p.costos)] },
    {
      nombre: "Asignaciones",
      bloques: [{ columnas: ["Agente", "Tarea", "Valor"], filas: s.asignaciones.map((a) => [a.agente, a.tarea, a.costo]) }],
    },
  ];
}
