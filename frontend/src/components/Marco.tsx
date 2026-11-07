"use client";

import type { ReactNode } from "react";
import { cerrarLogin, useLoginAbierto } from "@/lib/sesion";
import { AuthModal } from "./AuthModal";
import { Cabecera } from "./Cabecera";

export function Marco({ children }: { children: ReactNode }) {
  const modal = useLoginAbierto();
  return (
    <>
      <Cabecera />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/10 py-10 text-center text-[12px] text-ash">
        Good Tire, Inc. · Caso de estudio de ubicación de almacenes
      </footer>
      <AuthModal abierto={modal} onCerrar={cerrarLogin} />
    </>
  );
}
