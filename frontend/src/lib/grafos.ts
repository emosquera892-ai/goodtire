/* Problemas de redes (grafos): ruta más corta, flujo máximo y árbol de expansión mínima.
   El paso a paso se calcula en el navegador; el servidor guarda el caso y verifica el resultado. */
import type { Hoja } from "./exportar";

export type Algoritmo = "ruta" | "flujo" | "arbol";

export type AristaE = { de: string; a: string; valor: string };
export type EstadoG = { nodos: string[]; aristas: AristaE[]; origen: string; destino: string; dirigido: boolean };

export const LIMITES_G = { nodos: 20, aristas: 60, nombre: 12 };

export const INFO: Record<Algoritmo, { nombre: string; nota: string; valor: string; metodo: string; dirigidoFijo?: boolean }> = {
  ruta: {
    nombre: "Ruta más corta",
    nota: "El camino de menor costo entre dos nodos.",
    valor: "Costo",
    metodo: "Dijkstra",
  },
  flujo: {
    nombre: "Flujo máximo",
    nota: "Cuántas unidades pueden pasar del origen al destino respetando la capacidad de cada arco.",
    valor: "Capacidad",
    metodo: "Edmonds-Karp",
    dirigidoFijo: true,
  },
  arbol: {
    nombre: "Árbol de expansión mínima",
    nota: "Conectar todos los nodos con el menor costo total, sin ciclos.",
    valor: "Costo",
    metodo: "Kruskal",
    dirigidoFijo: false,
  },
};

const ar = (de: string, a: string, valor: number): AristaE => ({ de, a, valor: String(valor) });

export function ejemplo(alg: Algoritmo): EstadoG {
  if (alg === "ruta")
    return {
      nodos: ["Cleveland", "Chicago", "Detroit", "Columbus", "Pittsburgh", "Louisville"],
      aristas: [
        ar("Cleveland", "Detroit", 170),
        ar("Cleveland", "Columbus", 140),
        ar("Cleveland", "Pittsburgh", 135),
        ar("Detroit", "Chicago", 280),
        ar("Columbus", "Chicago", 355),
        ar("Columbus", "Louisville", 210),
        ar("Pittsburgh", "Columbus", 185),
        ar("Louisville", "Chicago", 300),
      ],
      origen: "Cleveland",
      destino: "Chicago",
      dirigido: false,
    };
  if (alg === "flujo")
    return {
      nodos: ["Planta", "A", "B", "C", "D", "Cliente"],
      aristas: [
        ar("Planta", "A", 10),
        ar("Planta", "B", 8),
        ar("A", "B", 2),
        ar("A", "C", 5),
        ar("A", "D", 8),
        ar("B", "D", 5),
        ar("C", "Cliente", 7),
        ar("D", "C", 3),
        ar("D", "Cliente", 10),
      ],
      origen: "Planta",
      destino: "Cliente",
      dirigido: true,
    };
  return {
    nodos: ["Cleveland", "Chicago", "Detroit", "Columbus", "Pittsburgh", "Louisville"],
    aristas: [
      ar("Cleveland", "Detroit", 170),
      ar("Cleveland", "Columbus", 140),
      ar("Cleveland", "Pittsburgh", 135),
      ar("Detroit", "Chicago", 280),
      ar("Columbus", "Chicago", 355),
      ar("Columbus", "Louisville", 210),
      ar("Pittsburgh", "Columbus", 185),
      ar("Louisville", "Chicago", 300),
    ],
    origen: "",
    destino: "",
    dirigido: false,
  };
}

export const vacio = (alg: Algoritmo): EstadoG => ({
  nodos: ["", ""],
  aristas: [{ de: "", a: "", valor: "" }],
  origen: "",
  destino: "",
  dirigido: alg !== "arbol",
});

export const numero = (s: string) => {
  const t = s.trim().replace(",", ".");
  return t === "" ? NaN : Number(t);
};
const r6 = (x: number) => +x.toFixed(6);
export const fmt = (x: number) => r6(x).toLocaleString("es-CO", { maximumFractionDigits: 6 });

/* ---------- Validación ---------- */

export type ErroresG = { celdas: Record<string, string>; generales: string[] };

export function validar(alg: Algoritmo, e: EstadoG): ErroresG {
  const celdas: Record<string, string> = {};
  const generales: string[] = [];
  const nombres = e.nodos.map((n) => n.trim());
  nombres.forEach((n, i) => {
    if (!n) celdas[`n.${i}`] = "Escribe un nombre";
    else if (nombres.indexOf(n) !== i) celdas[`n.${i}`] = "Nombre repetido";
  });
  const validos = new Set(nombres.filter(Boolean));
  if (nombres.length < 2) generales.push("Agrega al menos 2 nodos.");
  if (e.aristas.length < 1) generales.push("Agrega al menos una conexión.");
  e.aristas.forEach((x, i) => {
    if (!validos.has(x.de.trim())) celdas[`a.${i}.de`] = "Elige un nodo";
    if (!validos.has(x.a.trim())) celdas[`a.${i}.a`] = "Elige un nodo";
    else if (x.de.trim() === x.a.trim()) celdas[`a.${i}.a`] = "Debe ser otro nodo";
    const v = numero(x.valor);
    if (!Number.isFinite(v)) celdas[`a.${i}.valor`] = "Escribe un número";
    else if (v < 0) celdas[`a.${i}.valor`] = "No puede ser negativo";
    else if (v > 1e9) celdas[`a.${i}.valor`] = "Demasiado grande";
  });
  if (alg !== "arbol") {
    if (!validos.has(e.origen.trim())) celdas["origen"] = "Elige el nodo de salida";
    if (!validos.has(e.destino.trim())) celdas["destino"] = "Elige el nodo de llegada";
    else if (e.origen.trim() === e.destino.trim()) celdas["destino"] = "Debe ser distinto del origen";
  }
  return { celdas, generales };
}
export const hayErrores = (e: ErroresG) => Object.keys(e.celdas).length > 0 || e.generales.length > 0;

/* ---------- Resultado ---------- */

export type EstiloArista = "normal" | "elegida" | "activa" | "rechazada";
export type EstiloNodo = "normal" | "fijo" | "actual" | "corte";
export type Tabla = { cab: string[]; filas: string[][] };
export type Paso = {
  titulo: string;
  texto: string;
  aristas: Record<number, EstiloArista>;
  etiquetas?: Record<number, string>;
  nodos: Record<string, EstiloNodo>;
  tabla?: Tabla;
};
export type ResultadoG = {
  algoritmo: Algoritmo;
  dirigido: boolean;
  nodos: string[];
  aristas: { de: string; a: string; valor: number }[];
  metricas: { titulo: string; valor: string }[];
  mensaje: string;
  pasos: Paso[];
};

type A = { de: string; a: string; valor: number };

function normalizar(e: EstadoG, dirigido: boolean) {
  return {
    nodos: e.nodos.map((n) => n.trim()),
    aristas: e.aristas.map((x): A => ({ de: x.de.trim(), a: x.a.trim(), valor: numero(x.valor) })),
    origen: e.origen.trim(),
    destino: e.destino.trim(),
    dirigido,
  };
}

export function resolver(alg: Algoritmo, e: EstadoG): ResultadoG {
  const dirigido = alg === "flujo" ? true : alg === "arbol" ? false : e.dirigido;
  const g = normalizar(e, dirigido);
  if (alg === "ruta") return dijkstra(g);
  if (alg === "flujo") return edmondsKarp(g);
  return kruskal(g);
}

type G = ReturnType<typeof normalizar>;

/* ----- Ruta más corta (Dijkstra) ----- */

function dijkstra(g: G): ResultadoG {
  const { nodos, aristas, origen, destino, dirigido } = g;
  const dist: Record<string, number> = {};
  const previa: Record<string, number | null> = {};
  nodos.forEach((n) => ((dist[n] = Infinity), (previa[n] = null)));
  dist[origen] = 0;
  const fijos: string[] = [];
  const pasos: Paso[] = [];

  const vecinos = (n: string) =>
    aristas.flatMap((x, i) => {
      if (x.de === n) return [{ i, a: x.a, w: x.valor }];
      if (!dirigido && x.a === n) return [{ i, a: x.de, w: x.valor }];
      return [];
    });
  const tabla = (): Tabla => ({
    cab: ["Nodo", "Distancia", "Viene de", "Estado"],
    filas: nodos.map((n) => {
      const p = previa[n];
      const desde = p === null ? "—" : aristas[p].de === n ? aristas[p].a : aristas[p].de;
      return [n, Number.isFinite(dist[n]) ? fmt(dist[n]) : "∞", desde, fijos.includes(n) ? "Fijo" : "Provisional"];
    }),
  });
  const estNodos = (actual?: string): Record<string, EstiloNodo> =>
    Object.fromEntries(nodos.map((n) => [n, n === actual ? "actual" : fijos.includes(n) ? "fijo" : "normal"]));
  const arbolPrevio = () => {
    const o: Record<number, EstiloArista> = {};
    fijos.forEach((n) => {
      const p = previa[n];
      if (p !== null) o[p] = "elegida";
    });
    return o;
  };

  pasos.push({
    titulo: "Inicio",
    texto: `La distancia a «${origen}» es 0 y a todos los demás es infinita (aún no sabemos llegar). En cada paso se fija el nodo provisional más cercano y se revisa si, pasando por él, se mejora la distancia de sus vecinos.`,
    aristas: {},
    nodos: estNodos(origen),
    tabla: tabla(),
  });

  for (;;) {
    let mejor: string | null = null;
    for (const n of nodos) if (!fijos.includes(n) && Number.isFinite(dist[n]) && (mejor === null || dist[n] < dist[mejor])) mejor = n;
    if (mejor === null) break;
    fijos.push(mejor);
    const activas: Record<number, EstiloArista> = arbolPrevio();
    const lineas: string[] = [];
    for (const v of vecinos(mejor)) {
      if (fijos.includes(v.a)) continue;
      const nueva = dist[mejor] + v.w;
      if (nueva < dist[v.a]) {
        lineas.push(`${v.a}: ${Number.isFinite(dist[v.a]) ? fmt(dist[v.a]) : "∞"} → ${fmt(nueva)} (${fmt(dist[mejor])} + ${fmt(v.w)})`);
        dist[v.a] = nueva;
        previa[v.a] = v.i;
        activas[v.i] = "activa";
      } else lineas.push(`${v.a}: se queda en ${fmt(dist[v.a])} (pasando por aquí sería ${fmt(nueva)})`);
    }
    // el tramo que llevó hasta «mejor» sigue resaltado como parte del árbol de caminos
    pasos.push({
      titulo: `Se fija «${mejor}» (distancia ${fmt(dist[mejor])})`,
      texto: lineas.length ? `Revisamos sus vecinos: ${lineas.join("; ")}.` : "No tiene vecinos pendientes por revisar.",
      aristas: { ...arbolPrevio(), ...activas },
      nodos: estNodos(mejor),
      tabla: tabla(),
    });
    if (mejor === destino) break;
  }

  const hayRuta = fijos.includes(destino);
  const camino: string[] = [];
  const idx: number[] = [];
  if (hayRuta) {
    let n = destino;
    camino.unshift(n);
    while (previa[n] !== null) {
      const i = previa[n] as number;
      idx.unshift(i);
      n = aristas[i].de === n ? aristas[i].a : aristas[i].de;
      camino.unshift(n);
    }
  }
  const est: Record<number, EstiloArista> = {};
  idx.forEach((i) => (est[i] = "elegida"));
  const nod: Record<string, EstiloNodo> = Object.fromEntries(nodos.map((n) => [n, camino.includes(n) ? "fijo" : "normal"]));
  pasos.push({
    titulo: hayRuta ? "Ruta más corta" : "Sin ruta",
    texto: hayRuta
      ? `Se llega a «${destino}» siguiendo el camino ${camino.join(" → ")}, con un costo total de ${fmt(dist[destino])}.`
      : `Desde «${origen}» no se puede llegar a «${destino}»: no hay conexiones que los unan${dirigido ? " (revisa el sentido de las flechas)" : ""}.`,
    aristas: est,
    nodos: nod,
    tabla: tabla(),
  });

  return {
    algoritmo: "ruta",
    dirigido,
    nodos,
    aristas,
    metricas: hayRuta
      ? [
          { titulo: "Costo total", valor: fmt(dist[destino]) },
          { titulo: "Tramos", valor: String(idx.length) },
        ]
      : [{ titulo: "Costo total", valor: "Sin ruta" }],
    mensaje: pasos[pasos.length - 1].texto,
    pasos,
  };
}

/* ----- Flujo máximo (Edmonds-Karp) ----- */

function edmondsKarp(g: G): ResultadoG {
  const { nodos, aristas, origen, destino } = g;
  const res: number[] = [];
  aristas.forEach((x) => res.push(x.valor, 0));
  const salidas: Record<string, number[]> = Object.fromEntries(nodos.map((n) => [n, [] as number[]]));
  aristas.forEach((x, i) => {
    salidas[x.de].push(2 * i);
    salidas[x.a].push(2 * i + 1);
  });
  const destinoDe = (arco: number) => (arco % 2 === 0 ? aristas[arco >> 1].a : aristas[arco >> 1].de);
  const EPS = 1e-9;

  const flujo = (i: number) => res[2 * i + 1];
  const etiquetas = (): Record<number, string> =>
    Object.fromEntries(aristas.map((x, i) => [i, `${fmt(flujo(i))}/${fmt(x.valor)}`]));
  const tabla = (): Tabla => ({
    cab: ["Arco", "Flujo", "Capacidad", "Libre"],
    filas: aristas.map((x, i) => [`${x.de} → ${x.a}`, fmt(flujo(i)), fmt(x.valor), fmt(x.valor - flujo(i))]),
  });
  const usados = (): Record<number, EstiloArista> =>
    Object.fromEntries(aristas.flatMap((_, i) => (flujo(i) > EPS ? [[i, "elegida" as EstiloArista]] : [])));

  const pasos: Paso[] = [
    {
      titulo: "Inicio",
      texto: `Todos los arcos empiezan sin flujo (0). Cada etiqueta muestra «flujo/capacidad». Se busca un camino de «${origen}» a «${destino}» con capacidad libre (el de menos arcos), se envía por él lo que permita su arco más estrecho, y se repite hasta que no quede camino.`,
      aristas: {},
      etiquetas: etiquetas(),
      nodos: Object.fromEntries(nodos.map((n) => [n, n === origen || n === destino ? "actual" : "normal"])),
      tabla: tabla(),
    },
  ];

  const bfs = () => {
    const via: Record<string, number | null> = { [origen]: null };
    const cola = [origen];
    while (cola.length) {
      const u = cola.shift() as string;
      for (const arco of salidas[u]) {
        const v = destinoDe(arco);
        if (res[arco] > EPS && !(v in via)) {
          via[v] = arco;
          if (v === destino) return via;
          cola.push(v);
        }
      }
    }
    return null;
  };

  let total = 0;
  let k = 0;
  for (;;) {
    const via = bfs();
    if (!via) break;
    const camino: number[] = [];
    let n = destino;
    while (via[n] !== null && via[n] !== undefined) {
      const arco = via[n] as number;
      camino.unshift(arco);
      n = arcaOrigen(arco, aristas);
    }
    const cuello = Math.min(...camino.map((a) => res[a]));
    camino.forEach((a) => {
      res[a] -= cuello;
      res[a ^ 1] += cuello;
    });
    total += cuello;
    k += 1;
    const ruta = [origen, ...camino.map((a) => destinoDe(a))];
    const retro = camino.some((a) => a % 2 === 1);
    pasos.push({
      titulo: `Camino ${k}: se envían ${fmt(cuello)}`,
      texto: `Camino con capacidad libre: ${ruta.join(" → ")}. El tramo más estrecho deja pasar ${fmt(cuello)}, así que se envían ${fmt(cuello)} unidades. Flujo acumulado: ${fmt(total)}.${retro ? " Algún tramo se recorre «hacia atrás»: eso reduce el flujo que ya iba por ese arco y lo reencamina." : ""}`,
      aristas: { ...usados(), ...Object.fromEntries(camino.map((a) => [a >> 1, "activa" as EstiloArista])) },
      etiquetas: etiquetas(),
      nodos: Object.fromEntries(nodos.map((x) => [x, ruta.includes(x) ? "actual" : "normal"])),
      tabla: tabla(),
    });
    if (k > 5000) break;
  }

  // corte mínimo: lo alcanzable desde el origen con capacidad libre
  const alcance = new Set<string>([origen]);
  const cola = [origen];
  while (cola.length) {
    const u = cola.shift() as string;
    for (const arco of salidas[u]) {
      const v = destinoDe(arco);
      if (res[arco] > EPS && !alcance.has(v)) {
        alcance.add(v);
        cola.push(v);
      }
    }
  }
  const corte = aristas.flatMap((x, i) => (alcance.has(x.de) && !alcance.has(x.a) ? [i] : []));
  const capCorte = corte.reduce((s, i) => s + aristas[i].valor, 0);
  pasos.push({
    titulo: `Flujo máximo: ${fmt(total)}`,
    texto: `Ya no hay camino con capacidad libre entre «${origen}» y «${destino}». El flujo máximo es ${fmt(total)}. Los arcos en rojo forman el cuello de botella (corte mínimo): separan lo que aún se alcanza desde «${origen}» del resto y suman ${fmt(capCorte)} de capacidad, igual al flujo: ampliar cualquier otro arco no ayudaría.`,
    aristas: { ...usados(), ...Object.fromEntries(corte.map((i) => [i, "rechazada" as EstiloArista])) },
    etiquetas: etiquetas(),
    nodos: Object.fromEntries(nodos.map((x) => [x, alcance.has(x) ? "corte" : "normal"])),
    tabla: tabla(),
  });

  return {
    algoritmo: "flujo",
    dirigido: true,
    nodos,
    aristas,
    metricas: [
      { titulo: "Flujo máximo", valor: fmt(total) },
      { titulo: "Caminos usados", valor: String(k) },
      { titulo: "Cuello de botella", valor: corte.map((i) => `${aristas[i].de}→${aristas[i].a}`).join(", ") || "—" },
    ],
    mensaje: pasos[pasos.length - 1].texto,
    pasos,
  };
}

function arcaOrigen(arco: number, aristas: A[]) {
  return arco % 2 === 0 ? aristas[arco >> 1].de : aristas[arco >> 1].a;
}

/* ----- Árbol de expansión mínima (Kruskal) ----- */

function kruskal(g: G): ResultadoG {
  const { nodos, aristas } = g;
  const padre: Record<string, string> = Object.fromEntries(nodos.map((n) => [n, n]));
  const raiz = (n: string): string => (padre[n] === n ? n : (padre[n] = raiz(padre[n])));
  const orden = aristas.map((_, i) => i).sort((a, b) => aristas[a].valor - aristas[b].valor || a - b);
  const estado: Record<number, EstiloArista> = {};
  const filas: string[][] = [];
  const pasos: Paso[] = [];
  let total = 0;
  let n = 0;
  const comp = () => new Set(nodos.map(raiz)).size;
  const nodosEst = (): Record<string, EstiloNodo> => {
    const enArbol = new Set(Object.entries(estado).flatMap(([i, s]) => (s === "elegida" ? [aristas[+i].de, aristas[+i].a] : [])));
    return Object.fromEntries(nodos.map((x) => [x, enArbol.has(x) ? "fijo" : "normal"]));
  };

  pasos.push({
    titulo: "Inicio",
    texto: `Se ordenan todas las conexiones de la más barata a la más cara. Cada nodo empieza solo, en su propio grupo. Se recorre la lista: una conexión se acepta si une dos grupos distintos y se descarta si cerraría un ciclo. Se termina al tener ${nodos.length - 1} conexiones.`,
    aristas: {},
    nodos: nodosEst(),
    tabla: { cab: ["#", "Conexión", "Costo", "Decisión"], filas: [] },
  });

  orden.forEach((i, pos) => {
    if (n >= nodos.length - 1) return;
    const x = aristas[i];
    const a = raiz(x.de);
    const b = raiz(x.a);
    const acepta = a !== b;
    if (acepta) {
      padre[a] = b;
      total += x.valor;
      n += 1;
      estado[i] = "elegida";
    } else estado[i] = "rechazada";
    filas.push([String(pos + 1), `${x.de} — ${x.a}`, fmt(x.valor), acepta ? "Aceptada" : "Descartada (ciclo)"]);
    pasos.push({
      titulo: `${acepta ? "Se acepta" : "Se descarta"} ${x.de} — ${x.a} (${fmt(x.valor)})`,
      texto: acepta
        ? `Une dos grupos distintos, así que se acepta. Costo acumulado: ${fmt(total)}. Quedan ${comp()} grupo(s).`
        : `«${x.de}» y «${x.a}» ya están conectados entre sí: aceptarla cerraría un ciclo, por eso se descarta.`,
      aristas: { ...estado, [i]: acepta ? "activa" : "rechazada" },
      nodos: nodosEst(),
      tabla: { cab: ["#", "Conexión", "Costo", "Decisión"], filas: filas.map((f) => [...f]) },
    });
  });

  const conexo = comp() === 1;
  const sinRechazo: Record<number, EstiloArista> = Object.fromEntries(Object.entries(estado).filter(([, s]) => s === "elegida"));
  pasos.push({
    titulo: conexo ? `Árbol completo: costo ${fmt(total)}` : "Grafo no conexo",
    texto: conexo
      ? `Todos los nodos quedaron conectados con ${n} conexiones y un costo total mínimo de ${fmt(total)}.`
      : `Los nodos no se pueden conectar todos: quedan ${comp()} grupos separados. Lo marcado es el mejor «bosque» posible, con costo ${fmt(total)}.`,
    aristas: sinRechazo,
    nodos: nodosEst(),
    tabla: { cab: ["#", "Conexión", "Costo", "Decisión"], filas },
  });

  return {
    algoritmo: "arbol",
    dirigido: false,
    nodos,
    aristas,
    metricas: [
      { titulo: "Costo total", valor: fmt(total) },
      { titulo: "Conexiones", valor: String(n) },
      { titulo: "¿Conecta todo?", valor: conexo ? "Sí" : `No (${comp()} grupos)` },
    ],
    mensaje: pasos[pasos.length - 1].texto,
    pasos,
  };
}

/* ---------- Guardar casos ---------- */

export type DatosG = {
  algoritmo: Algoritmo;
  nodos: string[];
  aristas: { de: string; a: string; valor: number }[];
  origen: string | null;
  destino: string | null;
  dirigido: boolean;
};
export function aDatos(alg: Algoritmo, e: EstadoG): DatosG {
  const g = normalizar(e, alg === "flujo" ? true : alg === "arbol" ? false : e.dirigido);
  return {
    algoritmo: alg,
    nodos: g.nodos,
    aristas: g.aristas,
    origen: alg === "arbol" ? null : g.origen,
    destino: alg === "arbol" ? null : g.destino,
    dirigido: g.dirigido,
  };
}

export function desdeDatos(d: DatosG): EstadoG {
  return {
    nodos: d.nodos,
    aristas: d.aristas.map((x) => ({ de: x.de, a: x.a, valor: String(x.valor) })),
    origen: d.origen ?? "",
    destino: d.destino ?? "",
    dirigido: d.dirigido,
  };
}

/* ---------- Exportar ---------- */

export function hojasGrafos(r: ResultadoG): Hoja[] {
  const valor = INFO[r.algoritmo].valor;
  return [
    {
      nombre: "Resumen",
      bloques: [
        {
          columnas: ["Concepto", "Valor"],
          filas: [
            ["Problema", INFO[r.algoritmo].nombre],
            ["Método", INFO[r.algoritmo].metodo],
            ["Fecha", new Date().toLocaleDateString("es-CO", { dateStyle: "long" })],
            ...r.metricas.map((m): [string, string] => [m.titulo, m.valor]),
            ["Conclusión", r.mensaje],
          ],
        },
      ],
    },
    {
      nombre: "Datos",
      bloques: [
        { titulo: "Nodos", columnas: ["Nodo"], filas: r.nodos.map((n) => [n]) },
        { titulo: "Conexiones", columnas: ["Desde", "Hasta", valor], filas: r.aristas.map((x) => [x.de, x.a, x.valor]) },
      ],
    },
    {
      nombre: "Paso a paso",
      bloques: [{ columnas: ["#", "Paso", "Qué pasó"], filas: r.pasos.map((p, i) => [i + 1, p.titulo, p.texto]) }],
    },
  ];
}
