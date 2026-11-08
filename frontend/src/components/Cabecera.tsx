"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cerrarSesion } from "@/lib/api";
import { abrirLogin, useUsuario } from "@/lib/sesion";

const PROBLEMAS = [
  { nombre: "Ubicación de almacenes", nota: "Good Tire, Inc.", href: "/resolver" },
  { nombre: "Transporte", nota: "Origen → destino", href: "/resolver/transporte" },
  { nombre: "Transbordo", nota: "Con intermediarios", href: "/resolver/transbordo" },
  { nombre: "Asignación", nota: "Agente → tarea", href: "/resolver/asignacion" },
  { nombre: "Programación lineal", nota: "Gráfico y simplex", href: "/resolver/simplex" },
];

const base =
  "block rounded-full px-3 py-1.5 text-[13px] tracking-[-0.12px] transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-apple-blue";

function Enlace({ href, activo, onClick, children }: { href: string; activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={activo ? "page" : undefined}
      className={`${base} ${activo ? "text-white" : "text-white/70 hover:text-white"}`}
    >
      {children}
    </Link>
  );
}

export function Cabecera() {
  const ruta = usePathname();
  const usuario = useUsuario();
  const [menu, setMenu] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  const cerrar = () => {
    setAbierto(false);
    setMenu(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <nav aria-label="Principal" className="mx-auto flex h-11 max-w-6xl items-center justify-between px-6">
        <Link href="/" onClick={cerrar} className="text-[14px] font-semibold text-porcelain">
          Good Tire
        </Link>

        <button
          type="button"
          aria-label="Menú"
          aria-expanded={menu}
          aria-controls="menu-principal"
          onClick={() => setMenu((v) => !v)}
          className="rounded-full px-3 py-1 text-[16px] text-white/80 hover:text-white focus-visible:outline-2 focus-visible:outline-apple-blue md:hidden"
        >
          {menu ? "✕" : "☰"}
        </button>

        <ul
          id="menu-principal"
          className={`${menu ? "flex" : "hidden"} absolute inset-x-0 top-11 flex-col gap-1 border-b border-white/10 bg-black/95 p-4 md:static md:flex md:flex-row md:items-center md:gap-1 md:border-0 md:bg-transparent md:p-0`}
        >
          {!usuario && (
            <li>
              <Enlace href="/" activo={ruta === "/"} onClick={cerrar}>
                Inicio
              </Enlace>
            </li>
          )}

          <li ref={caja} className="relative">
            <button
              type="button"
              aria-expanded={abierto}
              aria-controls="menu-problemas"
              onClick={() => setAbierto((v) => !v)}
              className={`${base} w-full text-left ${ruta.startsWith("/resolver") ? "text-white" : "text-white/70 hover:text-white"}`}
            >
              Resolver <span aria-hidden>▾</span>
            </button>
            {abierto && (
              <ul
                id="menu-problemas"
                className="mt-1 space-y-0.5 pl-3 md:absolute md:left-0 md:top-full md:mt-2 md:w-80 md:rounded-[20px] md:border md:border-white/10 md:bg-carbon md:p-2"
              >
                {PROBLEMAS.map((p) => (
                  <li key={p.nombre}>
                    {p.href ? (
                      <Link
                        href={p.href}
                        onClick={cerrar}
                        className="flex items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-[13px] text-porcelain transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-apple-blue"
                      >
                        {p.nombre}
                        <span className="text-[12px] text-ash">{p.nota}</span>
                      </Link>
                    ) : (
                      <span
                        aria-disabled="true"
                        className="flex items-baseline justify-between gap-3 rounded-xl px-3 py-2 text-[13px] text-white/40"
                      >
                        {p.nombre}
                        <span className="text-[12px]">{p.nota}</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>

          <li>
            <Enlace href="/reglas" activo={ruta === "/reglas"} onClick={cerrar}>
              Reglas
            </Enlace>
          </li>
          <li>
            <Enlace href="/casos" activo={ruta === "/casos"} onClick={cerrar}>
              Mis casos
            </Enlace>
          </li>

          {usuario ? (
            <li className="flex items-center gap-1 md:ml-3">
              <span className="max-w-[170px] truncate px-3 text-[12px] text-ash">{usuario}</span>
              <button
                type="button"
                onClick={() => {
                  cerrarSesion();
                  cerrar();
                }}
                className={`${base} text-electric-link hover:underline`}
              >
                Salir
              </button>
            </li>
          ) : (
            <li className="md:ml-3">
              <button
                type="button"
                onClick={() => {
                  abrirLogin();
                  cerrar();
                }}
                className={`${base} text-electric-link hover:underline`}
              >
                Entrar
              </button>
            </li>
          )}
        </ul>
      </nav>
    </header>
  );
}
