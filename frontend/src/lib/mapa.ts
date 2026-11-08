import type { Problema, Solucion } from "./api";
import type { ProblemaB, SolucionB } from "./transbordo";
import type { ProblemaT, SolucionT } from "./transporte";

export type Rol = "planta" | "almacen" | "cliente" | "origen" | "intermedio" | "destino";
export type NodoMapa = { id: string; nombre: string; rol: Rol; abierto?: boolean; valor?: number; detalle?: string };
export type FlujoMapa = { desde: string; hasta: string; unidades: number; capa: 1 | 2 };
export type DatosMapa = { nodos: NodoMapa[]; flujos: FlujoMapa[] };

export function mapaUbicacion(p: Problema, s: Solucion): DatosMapa {
  const abiertos = new Set(s.almacenes_abiertos);
  const nodos: NodoMapa[] = [
    ...p.plantas.map((n, i) => ({
      id: `p:${n}`,
      nombre: n,
      rol: "planta" as const,
      detalle: p.capacidad_plantas[i] == null ? "Capacidad ilimitada" : `Capacidad ${p.capacidad_plantas[i]}`,
    })),
    ...p.almacenes.map((n, i) => {
      const d = s.detalle_almacenes.find((x) => x.almacen === n);
      return {
        id: `a:${n}`,
        nombre: n,
        rol: "almacen" as const,
        abierto: abiertos.has(n),
        valor: d?.uso,
        detalle: abiertos.has(n) ? `Abierto · usa ${d?.uso ?? 0} de ${p.capacidad_almacenes[i]}` : "Cerrado",
      };
    }),
    ...p.clientes.map((n, i) => ({ id: `c:${n}`, nombre: n, rol: "cliente" as const, valor: p.demanda[i], detalle: `Demanda ${p.demanda[i]}` })),
  ];
  return {
    nodos,
    flujos: [
      ...s.envios_planta_almacen.map((e) => ({ desde: `p:${e.planta}`, hasta: `a:${e.almacen}`, unidades: e.unidades, capa: 1 as const })),
      ...s.envios_almacen_cliente.map((e) => ({ desde: `a:${e.almacen}`, hasta: `c:${e.cliente}`, unidades: e.unidades, capa: 2 as const })),
    ],
  };
}

export function mapaTransporte(p: ProblemaT, s: SolucionT): DatosMapa {
  return {
    nodos: [
      ...p.origenes.map((n, i) => ({ id: `o:${n}`, nombre: n, rol: "origen" as const, valor: p.oferta[i], detalle: `Oferta ${p.oferta[i]}` })),
      ...p.destinos.map((n, j) => ({ id: `d:${n}`, nombre: n, rol: "destino" as const, valor: p.demanda[j], detalle: `Demanda ${p.demanda[j]}` })),
    ],
    flujos: s.envios.map((e) => ({ desde: `o:${e.origen}`, hasta: `d:${e.destino}`, unidades: e.unidades, capa: 1 as const })),
  };
}

export function mapaTransbordo(p: ProblemaB, s: SolucionB): DatosMapa {
  return {
    nodos: p.nodos.map((n) => ({
      id: `n:${n.nombre}`,
      nombre: n.nombre,
      rol: n.tipo,
      valor: n.cantidad ?? undefined,
      detalle: n.cantidad == null ? n.tipo : `${n.tipo} · ${n.cantidad}`,
    })),
    flujos: s.flujos.map((f) => ({ desde: `n:${f.desde}`, hasta: `n:${f.hasta}`, unidades: f.unidades, capa: 1 as const })),
  };
}
