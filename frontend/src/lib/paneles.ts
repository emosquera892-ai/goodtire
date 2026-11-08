import type { EntradaPanel } from "@/components/PanelLateral";

const introducir: EntradaPanel = { etiqueta: "Qué puedes introducir", ids: ["reglas", "introducir"] };

const resolver = (extra: EntradaPanel[] = []): EntradaPanel => ({
  etiqueta: "Resolver",
  ids: ["accion"],
  hijos: [
    { etiqueta: "Resultado", ids: ["resultado"] },
    ...extra,
    { etiqueta: "Paso a paso", ids: ["paso-a-paso"], resultado: true },
    { etiqueta: "Comparar escenarios", ids: ["escenarios"] },
    { etiqueta: "Guardar caso", ids: ["guardar-caso"] },
  ],
});
const mapaPlan: EntradaPanel = { etiqueta: "Mapa y plan de envíos", ids: ["res-mapa", "plan"], resultado: true };

export const PANEL_UBICACION: EntradaPanel[] = [
  introducir,
  {
    etiqueta: "Enunciado del problema",
    ids: ["enunciado"],
    hijos: [{ etiqueta: "Cómo se resuelve", ids: ["enunciado-como"] }],
  },
  {
    etiqueta: "Datos del problema",
    ids: ["d-plantas"],
    hijos: [
      { etiqueta: "Plantas", ids: ["d-plantas"] },
      { etiqueta: "Almacenes candidatos", ids: ["d-almacenes"] },
      { etiqueta: "Clientes", ids: ["d-clientes"] },
      { etiqueta: "Costo de envío: planta → almacén", ids: ["d-costo-pa"] },
      { etiqueta: "Costo de envío: almacén → cliente", ids: ["d-costo-ac"] },
      { etiqueta: "Opciones", ids: ["d-opciones"] },
    ],
  },
  resolver([mapaPlan]),
];

export const PANEL_TRANSPORTE: EntradaPanel[] = [
  introducir,
  {
    etiqueta: "Datos del problema",
    ids: ["d-origenes"],
    hijos: [
      { etiqueta: "Orígenes", ids: ["d-origenes"] },
      { etiqueta: "Destinos", ids: ["d-destinos"] },
      { etiqueta: "Costo de envío por unidad", ids: ["d-costos"] },
    ],
  },
  resolver([mapaPlan]),
];

export const PANEL_TRANSBORDO: EntradaPanel[] = [
  introducir,
  {
    etiqueta: "Datos del problema",
    ids: ["d-nodos"],
    hijos: [
      { etiqueta: "Nodos de la red", ids: ["d-nodos"] },
      { etiqueta: "Costo de envío por unidad", ids: ["d-costos"] },
    ],
  },
  resolver([mapaPlan]),
];

export const PANEL_ASIGNACION: EntradaPanel[] = [
  introducir,
  {
    etiqueta: "Datos del problema",
    ids: ["d-agentes"],
    hijos: [
      { etiqueta: "Agentes y tareas", ids: ["d-agentes"] },
      { etiqueta: "Costo de cada asignación", ids: ["d-costos"] },
      { etiqueta: "Objetivo", ids: ["d-objetivo"] },
    ],
  },
  resolver([{ etiqueta: "Asignaciones", ids: ["plan"], resultado: true }]),
];

export const PANEL_SIMPLEX: EntradaPanel[] = [
  { etiqueta: "Modelo", ids: ["modelo"] },
  { etiqueta: "Resultado", ids: ["resultado"], resultado: true },
  { etiqueta: "Cómo se resuelve", ids: ["como-se-resuelve"], resultado: true },
];
