"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorApi, iniciarSesion, pedirRecuperacion, registrar } from "@/lib/api";
import { Boton, Campo } from "./ui";

type Modo = "entrar" | "crear" | "recuperar";

const TITULO: Record<Modo, string> = { entrar: "Iniciar sesión", crear: "Crear cuenta", recuperar: "Recuperar cuenta" };
const INTRO: Record<Modo, string> = {
  entrar: "Con una cuenta puedes guardar tus casos y abrirlos desde cualquier dispositivo.",
  crear: "Con una cuenta puedes guardar tus casos y abrirlos desde cualquier dispositivo.",
  recuperar: "Escribe el correo con el que te registraste. Te enviaremos un enlace para elegir una contraseña nueva y te recordaremos tu usuario.",
};

export function AuthModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState<Modo>("entrar");
  const [usuario, setUsuario] = useState("");
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [enviado, setEnviado] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  function ir(nuevo: Modo) {
    setModo(nuevo);
    setErrores([]);
    setEnviado("");
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErrores([]);
    setCargando(true);
    try {
      if (modo === "recuperar") {
        const r = await pedirRecuperacion(correo.trim());
        setEnviado(r.detail);
        return;
      }
      if (modo === "entrar") await iniciarSesion(usuario.trim(), clave);
      else await registrar(usuario.trim(), correo.trim(), clave);
      setClave("");
      onCerrar();
    } catch (e) {
      setErrores(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(ev) => {
        if (ev.target === ref.current) onCerrar();
      }}
      aria-labelledby="titulo-auth"
      className="m-auto w-[min(92vw,420px)] rounded-[28px] bg-carbon p-8 text-porcelain backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={enviar} className="space-y-5">
        <p aria-hidden className="text-[38px] font-black uppercase leading-none tracking-[-0.01em] text-apple-blue">
          Good Tire
        </p>
        <h2 id="titulo-auth" className="text-[28px] font-semibold leading-none tracking-[0.196px]">
          {TITULO[modo]}
        </h2>
        <p className="text-[14px] text-ash">{INTRO[modo]}</p>

        {modo === "recuperar" && enviado ? (
          <>
            <p role="status" className="rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">
              {enviado}
            </p>
            <Boton onClick={() => ir("entrar")}>Volver a iniciar sesión</Boton>
          </>
        ) : (
          <>
            {modo !== "recuperar" && (
              <label className="block">
                <span className="mb-1.5 block text-[14px]">Usuario</span>
                <Campo autoComplete="username" required maxLength={150} value={usuario} onChange={(e) => setUsuario(e.target.value)} />
                {modo === "crear" && <span className="mt-1 block text-[12px] text-ash">Letras, números y @ . + - _</span>}
              </label>
            )}
            {modo !== "entrar" && (
              <label className="block">
                <span className="mb-1.5 block text-[14px]">Correo electrónico</span>
                <Campo
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                />
                {modo === "crear" && (
                  <span className="mt-1 block text-[12px] text-ash">Solo lo usamos para recuperar tu cuenta si olvidas la contraseña.</span>
                )}
              </label>
            )}
            {modo !== "recuperar" && (
              <label className="block">
                <span className="mb-1.5 block text-[14px]">Contraseña</span>
                <Campo
                  type="password"
                  autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                  required
                  maxLength={128}
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                />
                {modo === "crear" && (
                  <span className="mt-1 block text-[12px] text-ash">Mínimo 8 caracteres, no solo números y no demasiado común.</span>
                )}
              </label>
            )}
            {modo === "entrar" && (
              <div className="-mt-2">
                <Boton variante="enlace" className="text-[13px]" onClick={() => ir("recuperar")}>
                  ¿Olvidaste tu contraseña?
                </Boton>
              </div>
            )}
            {errores.length > 0 && (
              <ul role="alert" className="space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
                {errores.map((m) => (
                  <li key={m}>• {m}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Boton type="submit" disabled={cargando}>
                {cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : modo === "crear" ? "Crear cuenta" : "Enviar enlace"}
              </Boton>
              <Boton variante="enlace" onClick={() => ir(modo === "entrar" ? "crear" : "entrar")}>
                {modo === "entrar" ? "Crear una cuenta" : modo === "crear" ? "Ya tengo cuenta" : "Volver"}
              </Boton>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
