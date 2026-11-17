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
    hijos: [
      { etiqueta: "1. El enunciado", ids: ["en-1"] },
      {
        etiqueta: "2. Los datos del caso",
        ids: ["en-2"],
        abierto: true,
        hijos: [
          { etiqueta: "2.1 Planta", ids: ["en-2-1"] },
          { etiqueta: "2.2 Almacenes candidatos", ids: ["en-2-2"] },
          { etiqueta: "2.3 Clientes y demanda", ids: ["en-2-3"] },
          { etiqueta: "2.4 Costo planta → almacén", ids: ["en-2-4"] },
          { etiqueta: "2.5 Costo almacén → cliente", ids: ["en-2-5"] },
          { etiqueta: "2.6 Cómo leer los costos", ids: ["en-2-6"] },
        ],
      },
      { etiqueta: "3. Cómo se modela", ids: ["en-3"] },
      { etiqueta: "4. Cómo se resuelve", ids: ["enunciado-como"] },
      { etiqueta: "5. El resultado", ids: ["en-5"] },
      { etiqueta: "6. Cómo probarlo aquí", ids: ["en-6"] },
    ],
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
  resolver([mapaPlan, { etiqueta: "Sensibilidad", ids: ["sensibilidad"], resultado: true }]),
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
  resolver([mapaPlan, { etiqueta: "Sensibilidad", ids: ["sensibilidad"], resultado: true }]),
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
  resolver([mapaPlan, { etiqueta: "Sensibilidad", ids: ["sensibilidad"], resultado: true }]),
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
  resolver([{ etiqueta: "Asignaciones", ids: ["plan"], resultado: true }, { etiqueta: "Sensibilidad", ids: ["sensibilidad"], resultado: true }]),
];

export const PANEL_SIMPLEX: EntradaPanel[] = [
  { etiqueta: "Modelo", ids: ["modelo"] },
  { etiqueta: "Resultado", ids: ["resultado"], resultado: true },
  { etiqueta: "Cómo se resuelve", ids: ["como-se-resuelve"], resultado: true },
];

export const PANEL_GRAFOS: EntradaPanel[] = [
  { etiqueta: "Tipo de problema", ids: ["tipo"] },
  {
    etiqueta: "Datos de la red",
    ids: ["nodos"],
    hijos: [
      { etiqueta: "Nodos", ids: ["nodos"] },
      { etiqueta: "Conexiones", ids: ["conexiones"] },
      { etiqueta: "Origen y destino", ids: ["extremos"] },
      { etiqueta: "Vista previa", ids: ["vista-previa"] },
    ],
  },
  { etiqueta: "Resolver", ids: ["accion"], hijos: [
    { etiqueta: "Resultado", ids: ["resultado"], resultado: true },
    { etiqueta: "Paso a paso", ids: ["paso-a-paso"], resultado: true },
  ] },
];
