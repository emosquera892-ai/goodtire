"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ErrorApi, restablecerClave } from "@/lib/api";
import { abrirLogin } from "@/lib/sesion";
import { Boton, Campo } from "./ui";

export function Restablecer() {
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [listo, setListo] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErrores([]);
    if (clave !== repetir) {
      setErrores(["Las dos contraseñas no coinciden."]);
      return;
    }
    setCargando(true);
    try {
      await restablecerClave(uid, token, clave);
      setClave("");
      setRepetir("");
      setListo(true);
    } catch (e) {
      setErrores(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-[clamp(28px,5vw,40px)] font-semibold leading-[1.1] tracking-[-0.015em] text-porcelain">Elige una contraseña nueva.</h1>

      {!uid || !token ? (
        <p className="mt-6 rounded-[20px] border border-[#ff453a] p-4 text-[14px] text-porcelain">
          El enlace está incompleto. Pide uno nuevo desde «Iniciar sesión → ¿Olvidaste tu contraseña?».
        </p>
      ) : listo ? (
        <div className="mt-6 space-y-5">
          <p role="status" className="rounded-[20px] border border-steel p-4 text-[14px] text-porcelain">
            Contraseña actualizada. Ya puedes iniciar sesión con la nueva.
          </p>
          <Boton onClick={abrirLogin}>Iniciar sesión</Boton>
        </div>
      ) : (
        <form onSubmit={enviar} className="mt-6 space-y-5 rounded-[28px] bg-carbon p-6 sm:p-8">
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-porcelain">Contraseña nueva</span>
            <Campo type="password" autoComplete="new-password" required maxLength={128} value={clave} onChange={(e) => setClave(e.target.value)} />
            <span className="mt-1 block text-[12px] text-ash">Mínimo 8 caracteres, no solo números y no demasiado común.</span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[14px] text-porcelain">Repite la contraseña</span>
            <Campo type="password" autoComplete="new-password" required maxLength={128} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          </label>
          {errores.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
              {errores.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
          )}
          <Boton type="submit" disabled={cargando}>
            {cargando ? "Un momento…" : "Guardar contraseña"}
          </Boton>
        </form>
      )}
    </section>
  );
}
