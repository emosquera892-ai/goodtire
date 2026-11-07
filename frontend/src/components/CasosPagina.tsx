"use client";

import { useRouter } from "next/navigation";
import { abrirLogin, useUsuario } from "@/lib/sesion";
import { TIPOS } from "@/lib/tipos";
import { MisCasos } from "./MisCasos";
import { Boton } from "./ui";

export function CasosPagina() {
  const usuario = useUsuario();
  const router = useRouter();
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <h1 className="sr-only">Mis casos</h1>
      {usuario ? (
        <MisCasos onAbrir={(c) => router.push(`${TIPOS[c.tipo]?.ruta ?? "/resolver"}?caso=${c.id}`)} />
      ) : (
        <div className="rounded-[28px] bg-carbon p-5 sm:p-8">
          <h2 className="text-[28px] font-semibold leading-none tracking-[0.196px] text-porcelain">Mis casos</h2>
          <p className="mt-3 text-[14px] text-ash">Inicia sesión para ver los casos que guardaste.</p>
          <Boton className="mt-5" onClick={abrirLogin}>
            Entrar o crear cuenta
          </Boton>
        </div>
      )}
    </div>
  );
}
