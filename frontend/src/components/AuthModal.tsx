"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ErrorApi, iniciarSesion, registrar } from "@/lib/api";
import { Boton, Campo } from "./ui";

export function AuthModal({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErrores([]);
    setCargando(true);
    try {
      if (modo === "entrar") await iniciarSesion(usuario.trim(), clave);
      else await registrar(usuario.trim(), clave);
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
        <h2 id="titulo-auth" className="text-[28px] font-semibold leading-none tracking-[0.196px]">
          {modo === "entrar" ? "Iniciar sesión" : "Crear cuenta"}
        </h2>
        <p className="text-[14px] text-ash">Con una cuenta puedes guardar tus casos y abrirlos desde cualquier dispositivo.</p>
        <label className="block">
          <span className="mb-1.5 block text-[14px]">Usuario</span>
          <Campo autoComplete="username" required maxLength={150} value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          {modo === "crear" && <span className="mt-1 block text-[12px] text-ash">Letras, números y @ . + - _</span>}
        </label>
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
        {errores.length > 0 && (
          <ul role="alert" className="space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
            {errores.map((m) => (
              <li key={m}>• {m}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Boton type="submit" disabled={cargando}>
            {cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Crear cuenta"}
          </Boton>
          <Boton
            variante="enlace"
            onClick={() => {
              setModo(modo === "entrar" ? "crear" : "entrar");
              setErrores([]);
            }}
          >
            {modo === "entrar" ? "Crear una cuenta" : "Ya tengo cuenta"}
          </Boton>
        </div>
      </form>
    </dialog>
  );
}
