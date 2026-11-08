"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ErrorApi, cambiarClave, cambiarCorreo, eliminarCuenta, obtenerCuenta } from "@/lib/api";
import { abrirLogin, useUsuario } from "@/lib/sesion";
import { Boton, Campo } from "./ui";

const fallo = (e: unknown) => (e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);

function Mensajes({ errores, ok }: { errores: string[]; ok: string }) {
  return (
    <>
      {errores.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
          {errores.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}
      {ok && (
        <p role="status" className="rounded-[20px] border border-steel p-3 text-[13px] text-porcelain">
          {ok}
        </p>
      )}
    </>
  );
}

function Bloque({ titulo, texto, children }: { titulo: string; texto: string; children: ReactNode }) {
  return (
    <section className="border-t border-white/10 py-8">
      <h2 className="text-[24px] font-semibold tracking-[-0.01em] text-porcelain">{titulo}</h2>
      <p className="mt-1 text-[14px] text-ash">{texto}</p>
      <div className="mt-5 max-w-md space-y-4">{children}</div>
    </section>
  );
}

function Etiqueta({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] text-porcelain">{texto}</span>
      {children}
    </label>
  );
}

function CambiarCorreo({ actual, onCambio }: { actual: string; onCambio: (c: string) => void }) {
  const [clave, setClave] = useState("");
  const [correo, setCorreo] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [ok, setOk] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErrores([]);
    setOk("");
    setCargando(true);
    try {
      const r = await cambiarCorreo(clave, correo);
      onCambio(r.email);
      setClave("");
      setCorreo("");
      setOk("Correo actualizado.");
    } catch (e) {
      setErrores(fallo(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Bloque titulo="Correo" texto={`Tu correo actual es ${actual || "…"}. Lo usamos para recuperar tu contraseña.`}>
      <form onSubmit={enviar} className="space-y-4">
        <Etiqueta texto="Correo nuevo">
          <Campo type="email" autoComplete="email" required maxLength={254} value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </Etiqueta>
        <Etiqueta texto="Tu contraseña actual">
          <Campo type="password" autoComplete="current-password" required maxLength={128} value={clave} onChange={(e) => setClave(e.target.value)} />
        </Etiqueta>
        <Mensajes errores={errores} ok={ok} />
        <Boton type="submit" disabled={cargando}>
          {cargando ? "Un momento…" : "Cambiar correo"}
        </Boton>
      </form>
    </Bloque>
  );
}

function CambiarClave() {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [ok, setOk] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErrores([]);
    setOk("");
    if (nueva !== repetir) {
      setErrores(["Las dos contraseñas nuevas no coinciden."]);
      return;
    }
    setCargando(true);
    try {
      await cambiarClave(actual, nueva);
      setActual("");
      setNueva("");
      setRepetir("");
      setOk("Contraseña actualizada.");
    } catch (e) {
      setErrores(fallo(e));
    } finally {
      setCargando(false);
    }
  }

  return (
    <Bloque titulo="Contraseña" texto="Mínimo 8 caracteres, no solo números y no demasiado común.">
      <form onSubmit={enviar} className="space-y-4">
        <Etiqueta texto="Contraseña actual">
          <Campo type="password" autoComplete="current-password" required maxLength={128} value={actual} onChange={(e) => setActual(e.target.value)} />
        </Etiqueta>
        <Etiqueta texto="Contraseña nueva">
          <Campo type="password" autoComplete="new-password" required maxLength={128} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </Etiqueta>
        <Etiqueta texto="Repite la contraseña nueva">
          <Campo type="password" autoComplete="new-password" required maxLength={128} value={repetir} onChange={(e) => setRepetir(e.target.value)} />
        </Etiqueta>
        <Mensajes errores={errores} ok={ok} />
        <Boton type="submit" disabled={cargando}>
          {cargando ? "Un momento…" : "Cambiar contraseña"}
        </Boton>
      </form>
    </Bloque>
  );
}

function Eliminar() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [errores, setErrores] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setErrores([]);
    setCargando(true);
    try {
      await eliminarCuenta(clave);
      router.push("/");
    } catch (e) {
      setErrores(fallo(e));
      setCargando(false);
    }
  }

  return (
    <Bloque titulo="Eliminar cuenta" texto="Se borran tu cuenta y todos tus casos guardados. No se puede deshacer.">
      {!abierto ? (
        <Boton variante="peligro" onClick={() => setAbierto(true)}>
          Eliminar mi cuenta…
        </Boton>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Etiqueta texto="Escribe tu contraseña para confirmar">
            <Campo type="password" autoComplete="current-password" required maxLength={128} value={clave} onChange={(e) => setClave(e.target.value)} />
          </Etiqueta>
          <Mensajes errores={errores} ok="" />
          <div className="flex gap-3">
            <Boton type="submit" variante="peligro" disabled={cargando}>
              {cargando ? "Eliminando…" : "Sí, eliminar todo"}
            </Boton>
            <Boton
              type="button"
              variante="secundario"
              onClick={() => {
                setAbierto(false);
                setClave("");
                setErrores([]);
              }}
            >
              Cancelar
            </Boton>
          </div>
        </form>
      )}
    </Bloque>
  );
}

export function CuentaPagina() {
  const usuario = useUsuario();
  const [correo, setCorreo] = useState("");

  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    obtenerCuenta()
      .then((c) => vivo && setCorreo(c.email))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [usuario]);

  if (!usuario) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.015em] text-porcelain">Mi cuenta</h1>
        <p className="mt-3 text-[14px] text-ash">Inicia sesión para administrar tu cuenta.</p>
        <Boton className="mt-5" onClick={abrirLogin}>
          Entrar o crear cuenta
        </Boton>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-[clamp(28px,5vw,40px)] font-semibold leading-[1.1] tracking-[-0.015em] text-porcelain">Mi cuenta.</h1>
      <p className="mt-2 text-[14px] text-ash">
        Usuario: <span className="text-porcelain">{usuario}</span>
      </p>
      <div className="mt-6">
        <CambiarCorreo actual={correo} onCambio={setCorreo} />
        <CambiarClave />
        <Eliminar />
      </div>
    </div>
  );
}
