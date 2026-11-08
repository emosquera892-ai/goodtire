"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import type { FlujoMapa, Rol } from "@/lib/mapa";

export type PuntoCalle = { id: string; nombre: string; rol: Rol; abierto?: boolean; valor?: number; lat: number; lon: number };

const COLOR: Record<Rol, string> = {
  planta: "#ff9f0a",
  origen: "#ff9f0a",
  almacen: "#30d158",
  intermedio: "#bf5af2",
  cliente: "#2997ff",
  destino: "#2997ff",
};
// Teselas de OpenStreetMap (sin clave). El modo oscuro se logra con un filtro CSS (ver .mapa-calles en globals.css).
const TESELAS = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATRIBUCION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Colaboradores de OpenStreetMap</a>';

type Props = {
  puntos: PuntoCalle[];
  flujos: FlujoMapa[];
  capa1: boolean;
  capa2: boolean;
  cerrados: boolean;
  foco: string | null;
  seleccion: string | null;
  onSeleccion?: (id: string | null) => void;
  onActivo: (id: string | null) => void;
};

function icono(L: typeof Leaflet, p: PuntoCalle, sel: boolean, maxV: number, dx: number, dy: number) {
  const cliente = p.rol === "cliente" || p.rol === "destino";
  const s = cliente ? Math.round(2 * (5 + 5 * Math.sqrt((p.valor ?? 0) / maxV))) + 4 : 22;
  const cerrado = p.rol === "almacen" && p.abierto === false;
  const relleno = cerrado ? "#1d1d1f" : COLOR[p.rol];
  const borde = sel ? "#f5f5f7" : cerrado ? "#6e6e73" : "#000";
  const ancho = sel ? 3 : 1.6;
  const trazo = cerrado ? ' stroke-dasharray="3 2"' : "";
  let forma: string;
  if (p.rol === "planta" || p.rol === "origen") forma = `<polygon points="12,2 22.5,21 1.5,21" fill="${relleno}" stroke="${borde}" stroke-width="${ancho}" stroke-linejoin="round"/>`;
  else if (p.rol === "almacen") forma = `<rect x="3" y="3" width="18" height="18" rx="3" fill="${relleno}" stroke="${borde}" stroke-width="${ancho}"${trazo}/>`;
  else if (p.rol === "intermedio") forma = `<polygon points="12,1.5 22.5,12 12,22.5 1.5,12" fill="${relleno}" stroke="${borde}" stroke-width="${ancho}" stroke-linejoin="round"/>`;
  else forma = `<circle cx="12" cy="12" r="10" fill="${relleno}" fill-opacity="0.92" stroke="${borde}" stroke-width="${ancho}"/>`;
  return {
    s,
    icon: L.divIcon({
      className: "",
      html: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="display:block;overflow:visible">${forma}</svg>`,
      iconSize: [s, s],
      iconAnchor: [s / 2 - dx, s / 2 - dy],
    }),
  };
}

export function MapaCalles({ puntos, flujos, capa1, capa2, cerrados, foco, seleccion, onSeleccion, onActivo }: Props) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const lib = useRef<typeof Leaflet | null>(null);
  const capaMarcas = useRef<Leaflet.LayerGroup | null>(null);
  const capaLineas = useRef<Leaflet.LayerGroup | null>(null);
  const claveAjustada = useRef("");
  const cbSel = useRef(onSeleccion);
  const cbAct = useRef(onActivo);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    cbSel.current = onSeleccion;
    cbAct.current = onActivo;
  });

  // crear el mapa una sola vez
  useEffect(() => {
    let vivo = true;
    void import("leaflet")
      .then((m) => {
        if (!vivo || !caja.current) return;
        const L = (m.default ?? m) as typeof Leaflet;
        lib.current = L;
        const mp = L.map(caja.current, { scrollWheelZoom: false, dragging: !L.Browser.mobile, minZoom: 2, worldCopyJump: true });
        L.tileLayer(TESELAS, { maxZoom: 19, attribution: ATRIBUCION }).addTo(mp);
        mp.setView([20, 0], 2);
        // la rueda hace zoom solo después de hacer clic en el mapa (así no estorba al desplazar la página)
        mp.on("click", () => {
          mp.scrollWheelZoom.enable();
          cbSel.current?.(null);
        });
        mp.getContainer().addEventListener("mouseleave", () => mp.scrollWheelZoom.disable());
        const etiquetas = () => caja.current?.classList.toggle("sin-etiquetas-calle", mp.getZoom() < 4);
        mp.on("zoomend", etiquetas);
        etiquetas();
        capaLineas.current = L.layerGroup().addTo(mp);
        capaMarcas.current = L.layerGroup().addTo(mp);
        mapa.current = mp;
        setListo(true);
      })
      .catch(() => setError(true));
    return () => {
      vivo = false;
      mapa.current?.remove();
      mapa.current = null;
      setListo(false);
    };
  }, []);

  const maxV = Math.max(1, ...puntos.filter((p) => p.rol === "cliente" || p.rol === "destino").map((p) => p.valor ?? 0));
  const maxU = Math.max(1, ...flujos.map((f) => f.unidades));

  // marcadores
  useEffect(() => {
    const L = lib.current;
    if (!listo || !L || !mapa.current || !capaMarcas.current) return;
    capaMarcas.current.clearLayers();
    const grupos = new Map<string, PuntoCalle[]>();
    for (const p of puntos) {
      if (!cerrados && p.rol === "almacen" && p.abierto === false) continue;
      const k = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      grupos.set(k, [...(grupos.get(k) ?? []), p]);
    }
    for (const g of grupos.values()) {
      g.forEach((p, i) => {
        // varios nodos en la misma ciudad: se separan unos píxeles para que se vean todos
        const ang = (2 * Math.PI * i) / g.length - Math.PI / 2;
        const dx = g.length > 1 ? Math.cos(ang) * 13 : 0;
        const dy = g.length > 1 ? Math.sin(ang) * 13 : 0;
        const sel = seleccion === p.id;
        const { s, icon } = icono(L, p, sel, maxV, dx, dy);
        const mk = L.marker([p.lat, p.lon], { icon, keyboard: true, title: p.nombre, riseOnHover: true, zIndexOffset: sel ? 1000 : 0 });
        mk.bindTooltip(p.nombre, { permanent: true, direction: "bottom", offset: [-dx, s / 2 - dy], className: "etiqueta-calle" });
        mk.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          cbSel.current?.(sel ? null : p.id);
        });
        mk.on("mouseover", () => cbAct.current(p.id));
        mk.on("mouseout", () => cbAct.current(null));
        mk.addTo(capaMarcas.current!);
      });
    }
    const clave = puntos.map((p) => p.id).join("|");
    if (clave !== claveAjustada.current && puntos.length) {
      claveAjustada.current = clave;
      mapa.current.fitBounds(L.latLngBounds(puntos.map((p) => [p.lat, p.lon] as [number, number])), { padding: [60, 60], maxZoom: 12 });
    }
  }, [listo, puntos, cerrados, seleccion, maxV]);

  // líneas de envío
  useEffect(() => {
    const L = lib.current;
    if (!listo || !L || !capaLineas.current) return;
    capaLineas.current.clearLayers();
    const por = new Map(puntos.map((p) => [p.id, p]));
    for (const f of flujos) {
      if ((f.capa === 1 && !capa1) || (f.capa === 2 && !capa2)) continue;
      const a = por.get(f.desde);
      const b = por.get(f.hasta);
      if (!a || !b) continue;
      if (!cerrados && ((a.rol === "almacen" && a.abierto === false) || (b.rol === "almacen" && b.abierto === false))) continue;
      const conectado = foco ? f.desde === foco || f.hasta === foco : true;
      L.polyline(
        [
          [a.lat, a.lon],
          [b.lat, b.lon],
        ],
        { color: f.capa === 1 ? "#2997ff" : "#30d158", weight: 1.5 + 5 * (f.unidades / maxU), opacity: conectado ? 0.9 : 0.15, className: "flujo-mapa", interactive: false, lineCap: "round" },
      ).addTo(capaLineas.current);
    }
  }, [listo, puntos, flujos, capa1, capa2, cerrados, foco, maxU]);

  return (
    <div className="relative isolate">
      <div ref={caja} role="application" aria-label="Mapa de calles con las ciudades y los envíos del plan" className="mapa-calles h-[460px] w-full rounded-[20px] sm:h-[560px]" />
      {error && <p className="absolute inset-0 grid place-items-center p-6 text-center text-[14px] text-ash">No se pudo cargar el mapa de calles. Usa la vista Esquemático.</p>}
    </div>
  );
}
