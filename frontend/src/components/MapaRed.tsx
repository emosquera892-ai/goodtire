"use client";

import { useEffect, useMemo, useState } from "react";
import { numero } from "@/lib/api";
import { ubicarNombres, type TablaCiudades } from "@/lib/ciudades";
import { trazo, type Caja, type GeoMundo } from "@/lib/geo";
import type { DatosMapa, NodoMapa, Rol } from "@/lib/mapa";
import { Boton, Seccion } from "./ui";

type Base = { geo: GeoMundo; tabla: TablaCiudades };
type Punto = NodoMapa & { x: number; y: number; bx: number; by: number };

const COLOR: Record<Rol, string> = {
  planta: "#ff9f0a",
  origen: "#ff9f0a",
  almacen: "#30d158",
  intermedio: "#bf5af2",
  cliente: "#2997ff",
  destino: "#2997ff",
};
const NOMBRE_ROL: Record<Rol, string> = {
  planta: "Planta",
  origen: "Origen",
  almacen: "Almacén abierto",
  intermedio: "Intermedio",
  cliente: "Cliente",
  destino: "Destino",
};
const ASPECTO = 1.6;

export function MapaRed({
  datos,
  seleccion = null,
  onSeleccion,
}: {
  datos: DatosMapa;
  seleccion?: string | null;
  onSeleccion?: (id: string | null) => void;
}) {
  const [base, setBase] = useState<Base | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [capa1, setCapa1] = useState(true);
  const [capa2, setCapa2] = useState(true);
  const [cerrados, setCerrados] = useState(true);

  useEffect(() => {
    let vivo = true;
    void Promise.all([import("@/lib/mundoGeo"), import("@/lib/mundoCiudades"), import("@/lib/geo")]).then(([g, c, lib]) => {
      if (vivo) setBase({ geo: lib.cargarGeo(g.GEO_JSON), tabla: JSON.parse(c.CIUDADES_JSON) as TablaCiudades });
    });
    return () => {
      vivo = false;
    };
  }, []);

  const m = useMemo(() => {
    if (!base) return null;
    const pos = ubicarNombres(datos.nodos.map((n) => n.nombre), base.tabla);
    const ubicados = datos.nodos.map((n, i) => ({ n, xy: pos[i] }));
    const con = ubicados.filter((u) => u.xy);
    const sin = ubicados.filter((u) => !u.xy).map((u) => u.n.nombre);
    const distintos = new Set(con.map((u) => `${u.xy![0]},${u.xy![1]}`));
    if (distintos.size < 2) return null;
    const xs = con.map((u) => u.xy![0]);
    const ys = con.map((u) => u.xy![1]);
    const bw = Math.max(...xs) - Math.min(...xs);
    const bh = Math.max(...ys) - Math.min(...ys);
    let w = Math.min(Math.max(bw * 1.6 + 1.2, 3.2), 360);
    let h = Math.max(bh * 1.6 + 0.8, 2);
    if (w / h > ASPECTO) h = w / ASPECTO;
    else w = h * ASPECTO;
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const u = w / 720;
    // varios nodos en la misma ciudad (p. ej. almacén y cliente de Cleveland) se separan un poco
    const grupos = new Map<string, typeof con>();
    con.forEach((c) => {
      const k = `${c.xy![0]},${c.xy![1]}`;
      grupos.set(k, [...(grupos.get(k) ?? []), c]);
    });
    const puntos: Punto[] = [];
    grupos.forEach((g) => {
      const k = g.length;
      g.forEach((c, i) => {
        const ang = (2 * Math.PI * i) / k - Math.PI / 2;
        const r = k > 1 ? 9 * u : 0;
        puntos.push({ ...c.n, bx: c.xy![0], by: c.xy![1], x: c.xy![0] + Math.cos(ang) * r, y: c.xy![1] + Math.sin(ang) * r });
      });
    });
    // separar marcadores que quedan demasiado juntos (p. ej. Akron y Cleveland)
    const minD = 17 * u;
    for (let it = 0; it < 60; it++) {
      let movido = false;
      for (let i = 0; i < puntos.length; i++) {
        for (let j = i + 1; j < puntos.length; j++) {
          const dx = puntos[j].x - puntos[i].x;
          const dy = puntos[j].y - puntos[i].y;
          const d = Math.hypot(dx, dy);
          if (d < minD) {
            const ux = d > 1e-9 ? dx / d : Math.cos(i + 1);
            const uy = d > 1e-9 ? dy / d : Math.sin(i + 1);
            const e = (minD - d) / 2;
            puntos[i].x -= ux * e;
            puntos[i].y -= uy * e;
            puntos[j].x += ux * e;
            puntos[j].y += uy * e;
            movido = true;
          }
        }
      }
      if (!movido) break;
    }
    // etiquetas: debajo, encima, a la derecha o a la izquierda, evitando solaparse
    const choca = (a: Caja, b: Caja) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    const ocupadas: Caja[] = puntos.map((p) => ({ x0: p.x - 10 * u, y0: p.y - 10 * u, x1: p.x + 10 * u, y1: p.y + 10 * u }));
    const orden = [...puntos].sort((p, q) => Number(q.rol === "planta" || q.rol === "origen") - Number(p.rol === "planta" || p.rol === "origen") || Number(q.rol === "almacen") - Number(p.rol === "almacen"));
    const etiquetas: { x: number; y: number; texto: string; ancla: "middle" | "start" | "end" }[] = [];
    for (const p of orden) {
      if (etiquetas.some((e) => e.texto === p.nombre && Math.hypot(e.x - p.x, e.y - p.y) < 40 * u)) continue;
      const w = p.nombre.length * 6.6 * u + 4 * u;
      const h = 13 * u;
      const cand = [
        { x: p.x, y: p.y + 21 * u, ancla: "middle" as const, caja: { x0: p.x - w / 2, y0: p.y + 11 * u, x1: p.x + w / 2, y1: p.y + 11 * u + h } },
        { x: p.x, y: p.y - 14 * u, ancla: "middle" as const, caja: { x0: p.x - w / 2, y0: p.y - 24 * u, x1: p.x + w / 2, y1: p.y - 24 * u + h } },
        { x: p.x + 13 * u, y: p.y + 4 * u, ancla: "start" as const, caja: { x0: p.x + 11 * u, y0: p.y - 9 * u, x1: p.x + 11 * u + w, y1: p.y + 4 * u } },
        { x: p.x - 13 * u, y: p.y + 4 * u, ancla: "end" as const, caja: { x0: p.x - 11 * u - w, y0: p.y - 9 * u, x1: p.x - 11 * u, y1: p.y + 4 * u } },
      ];
      const elegido = cand.find((c) => !ocupadas.some((o) => choca(c.caja, o))) ?? cand[0];
      ocupadas.push(elegido.caja);
      etiquetas.push({ x: elegido.x, y: elegido.y, texto: p.nombre, ancla: elegido.ancla });
    }
    const caja: Caja = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
    return { puntos, etiquetas, sin, vista: `${caja.x0} ${caja.y0} ${w} ${h}`, u, caja };
  }, [datos, base]);

  const rutas = useMemo(() => {
    if (!m || !base) return null;
    const tol = m.u * 0.6;
    return { paises: trazo(base.geo.paises, m.caja, true, tol), estados: trazo(base.geo.estados, m.caja, false, tol), lagos: trazo(base.geo.lagos, m.caja, true, tol) };
  }, [m, base]);

  if (!m) return null;
  const { puntos, etiquetas, sin, vista, u } = m;
  const porId = new Map(puntos.map((p) => [p.id, p]));
  const flujos = datos.flujos.filter((f) => porId.has(f.desde) && porId.has(f.hasta) && f.unidades > 0);
  const maxU = Math.max(1, ...flujos.map((f) => f.unidades));
  const hayCapa2 = datos.flujos.some((f) => f.capa === 2);
  const hayCerrados = datos.nodos.some((n) => n.rol === "almacen" && n.abierto === false);
  const maxV = Math.max(1, ...puntos.filter((p) => p.rol === "cliente" || p.rol === "destino").map((p) => p.valor ?? 0));
  const foco = activo ?? seleccion;
  const nodoActivo = foco ? porId.get(foco) : null;
  const rolesPresentes = Array.from(new Set(puntos.map((p) => (p.rol === "almacen" && p.abierto === false ? null : p.rol)).filter(Boolean))) as Rol[];

  const forma = (p: Punto) => {
    const act = foco === p.id;
    const sel = seleccion === p.id;
    const color = COLOR[p.rol];
    const cerrado = p.rol === "almacen" && p.abierto === false;
    const r = (p.rol === "cliente" || p.rol === "destino" ? 4.5 + 4.5 * Math.sqrt((p.valor ?? 0) / maxV) : 7) * u * (act ? 1.25 : 1);
    const común = {
      stroke: sel ? "var(--color-porcelain)" : "var(--color-obsidian)",
      strokeWidth: (sel ? 3 : 1.5) * u,
      tabIndex: 0,
      role: "button" as const,
      "aria-pressed": sel,
      "aria-label": `${p.nombre}: resaltar en el plan de envíos`,
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onSeleccion?.(sel ? null : p.id);
      },
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSeleccion?.(sel ? null : p.id);
        }
      },
      onMouseEnter: () => setActivo(p.id),
      onMouseLeave: () => setActivo(null),
      onFocus: () => setActivo(p.id),
      onBlur: () => setActivo(null),
      style: { cursor: "pointer", outline: "none" } as const,
    };
    if (p.rol === "planta" || p.rol === "origen")
      return <polygon {...común} fill={color} points={`${p.x},${p.y - r * 1.2} ${p.x + r * 1.1},${p.y + r * 0.8} ${p.x - r * 1.1},${p.y + r * 0.8}`} />;
    if (p.rol === "almacen")
      return cerrado ? (
        <rect {...común} x={p.x - r} y={p.y - r} width={2 * r} height={2 * r} rx={2 * u} fill="var(--color-carbon)" stroke="var(--color-slate)" strokeDasharray={`${3 * u} ${2 * u}`} />
      ) : (
        <rect {...común} x={p.x - r} y={p.y - r} width={2 * r} height={2 * r} rx={2 * u} fill={color} />
      );
    if (p.rol === "intermedio")
      return <polygon {...común} fill={color} points={`${p.x},${p.y - r * 1.2} ${p.x + r * 1.2},${p.y} ${p.x},${p.y + r * 1.2} ${p.x - r * 1.2},${p.y}`} />;
    return <circle {...común} cx={p.x} cy={p.y} r={r} fill={color} fillOpacity={0.9} />;
  };

  return (
    <Seccion
      titulo="Mapa"
      nota="Ubicación de las ciudades y envíos del plan (el grosor de la línea es proporcional a las unidades). Toca un punto para resaltar sus envíos en el plan de abajo; toca de nuevo o el fondo para quitar la selección."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Boton variante="secundario" activo={capa1} onClick={() => setCapa1(!capa1)}>
          {hayCapa2 ? "Planta → almacén" : "Envíos"}
        </Boton>
        {hayCapa2 && (
          <Boton variante="secundario" activo={capa2} onClick={() => setCapa2(!capa2)}>
            Almacén → cliente
          </Boton>
        )}
        {hayCerrados && (
          <Boton variante="secundario" activo={cerrados} onClick={() => setCerrados(!cerrados)}>
            Almacenes cerrados
          </Boton>
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-[20px] bg-obsidian">
        <svg viewBox={vista} role="img" aria-label="Mapa con las ciudades y los envíos del plan" className="block h-auto w-full" onClick={() => onSeleccion?.(null)}>
          {rutas && (
            <>
              <path d={rutas.paises} fill="var(--color-carbon)" fillRule="evenodd" stroke="var(--color-slate)" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
              <path d={rutas.estados} fill="none" stroke="var(--color-steel)" strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
              <path d={rutas.lagos} fill="var(--color-obsidian)" fillRule="evenodd" stroke="var(--color-slate)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
            </>
          )}
          {flujos.map((f, i) => {
            if ((f.capa === 1 && !capa1) || (f.capa === 2 && !capa2)) return null;
            const a = porId.get(f.desde)!;
            const b = porId.get(f.hasta)!;
            const conectado = foco ? f.desde === foco || f.hasta === foco : true;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                className="flujo-mapa"
                stroke={f.capa === 1 ? "var(--color-electric-link)" : "#30d158"}
                strokeWidth={1.5 + 5 * (f.unidades / maxU)}
                strokeLinecap="round"
                opacity={conectado ? 0.9 : 0.15}
                vectorEffect="non-scaling-stroke"
              >
                <title>{`${a.nombre} → ${b.nombre}: ${numero(f.unidades)} unidades`}</title>
              </line>
            );
          })}
          {puntos.map((p) => (!cerrados && p.rol === "almacen" && p.abierto === false ? null : <g key={p.id}>{forma(p)}</g>))}
          {etiquetas.map((e, i) => (
            <text
              key={i}
              x={e.x}
              y={e.y}
              textAnchor={e.ancla}
              fontSize={11 * u}
              fontWeight={600}
              fill="var(--color-porcelain)"
              stroke="var(--color-obsidian)"
              strokeWidth={3 * u}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {e.texto}
            </text>
          ))}
        </svg>
      </div>

      <p className="mt-3 min-h-[1.5em] text-[14px] text-porcelain" aria-live="polite">
        {nodoActivo ? (
          <>
            <strong>{nodoActivo.nombre}</strong> · {NOMBRE_ROL[nodoActivo.rol] ?? nodoActivo.rol}
            {nodoActivo.detalle ? ` · ${nodoActivo.detalle}` : ""}
            {seleccion === nodoActivo.id && onSeleccion && (
              <button type="button" onClick={() => onSeleccion(null)} className="ml-3 text-[13px] text-electric-link underline">
                Quitar selección
              </button>
            )}
          </>
        ) : (
          <span className="text-ash">Toca o pasa el cursor sobre un punto del mapa.</span>
        )}
      </p>

      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ash">
        {rolesPresentes.map((r) => (
          <li key={r} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5" style={{ background: COLOR[r], borderRadius: r === "cliente" || r === "destino" ? 999 : 2 }} />
            {NOMBRE_ROL[r]}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-ash">Mapa: Natural Earth y us-atlas (dominio público) · ciudades: GeoNames (CC BY 4.0)</p>
      {sin.length > 0 && (
        <p className="mt-3 text-[13px] text-ash">
          No se pudieron ubicar en el mapa: {sin.join(", ")}. El mapa reconoce por su nombre (en español o inglés) las ciudades de más de 100 000 habitantes y las capitales de todo el mundo.
        </p>
      )}
    </Seccion>
  );
}
