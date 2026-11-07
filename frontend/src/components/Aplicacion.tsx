"use client";

import { useState, useSyncExternalStore } from "react";
import { cerrarSesion, suscribirSesion, usuarioSnapshot } from "@/lib/api";
import { AuthModal } from "./AuthModal";
import { Hero } from "./Hero";
import { Solver } from "./Solver";
import { Boton } from "./ui";

export function Aplicacion() {
  const usuario = useSyncExternalStore(suscribirSesion, usuarioSnapshot, () => null);
  const [modal, setModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/70 backdrop-blur-xl">
        <nav className="mx-auto flex h-11 max-w-6xl items-center justify-between px-6 text-[12px] tracking-[-0.12px] text-white/80">
          <a href="#" className="text-[14px] font-semibold text-porcelain">
            Good Tire
          </a>
          <div className="flex items-center gap-5">
            <a href="#reglas" className="transition hover:text-white">
              Reglas
            </a>
            <a href="#resolver" className="transition hover:text-white">
              Resolver
            </a>
            {usuario && (
              <a href="#casos" className="transition hover:text-white">
                Mis casos
              </a>
            )}
            {usuario ? (
              <>
                <span className="hidden text-ash sm:inline">{usuario}</span>
                <Boton variante="enlace" className="!text-[12px]" onClick={cerrarSesion}>
                  Salir
                </Boton>
              </>
            ) : (
              <Boton variante="enlace" className="!text-[12px]" onClick={() => setModal(true)}>
                Entrar
              </Boton>
            )}
          </div>
        </nav>
      </header>
      <main className="flex-1">
        <Hero />
        <Solver usuario={usuario} pedirLogin={() => setModal(true)} />
      </main>
      <footer className="border-t border-white/10 py-10 text-center text-[12px] text-ash">
        Good Tire, Inc. · Caso de estudio de ubicación de almacenes
      </footer>
      <AuthModal abierto={modal} onCerrar={() => setModal(false)} />
    </>
  );
}
