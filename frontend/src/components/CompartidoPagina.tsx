"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorApi, copiarCompartido, verCompartido, type CasoCompartido, type Problema, type Solucion } from "@/lib/api";
import type { ProblemaA, SolucionA } from "@/lib/asignacion";
import { abrirLogin, useUsuario } from "@/lib/sesion";
import { TIPOS } from "@/lib/tipos";
import type { ProblemaB, SolucionB } from "@/lib/transbordo";
import type { ProblemaT, SolucionT } from "@/lib/transporte";
import { Resultados } from "./Resultados";
import { ResultadosAsignacion } from "./ResultadosAsignacion";
import { ResultadosTransbordo } from "./ResultadosTransbordo";
import { ResultadosTransporte } from "./ResultadosTransporte";
import { Boton } from "./ui";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

function Vista({ c }: { c: CasoCompartido }) {
  if (!c.resultado) return <p className="text-[14px] text-ash">Este caso no tiene un resultado guardado.</p>;
  switch (c.tipo) {
    case "ubicacion":
      return <Resultados solucion={c.resultado as Solucion} problema={c.datos as Problema} />;
    case "transporte":
      return <ResultadosTransporte solucion={c.resultado as SolucionT} problema={c.datos as ProblemaT} />;
    case "transbordo":
      return <ResultadosTransbordo solucion={c.resultado as SolucionB} problema={c.datos as ProblemaB} />;
    case "asignacion":
      return <ResultadosAsignacion solucion={c.resultado as SolucionA} problema={c.datos as ProblemaA} />;
    default:
      return <p className="text-[14px] text-ash">Este tipo de caso no se puede mostrar aquí.</p>;
  }
}

export function CompartidoPagina() {
  const token = useSearchParams().get("c") ?? "";
  const usuario = useUsuario();
  const router = useRouter();
  const [caso, setCaso] = useState<CasoCompartido | null>(null);
  const [error, setError] = useState<string[]>([]);
  const [copiando, setCopiando] = useState(false);
  const [copia, setCopia] = useState<{ id: number; tipo: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let vivo = true;
    verCompartido(token)
      .then((c) => vivo && setCaso(c))
      .catch((e) => {
        if (!vivo) return;
        setError(e instanceof ErrorApi && e.estado === 404 ? ["Este enlace no existe o su dueño dejó de compartirlo."] : e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
      });
    return () => {
      vivo = false;
    };
  }, [token]);

  async function guardarCopia() {
    setError([]);
    setCopiando(true);
    try {
      const c = await copiarCompartido(token);
      setCopia({ id: c.id, tipo: c.tipo });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.detalle : ["Ocurrió un error inesperado"]);
    } finally {
      setCopiando(false);
    }
  }

  if (!token && !caso) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        <h1 className="text-[clamp(28px,5vw,40px)] font-semibold leading-[1.1] tracking-[-0.015em] text-porcelain">Enlace incompleto.</h1>
        <p role="alert" className="mt-4 text-[15px] text-ash">Falta el código del caso. Pide de nuevo el enlace a quien te lo compartió.</p>
      </div>
    );
  }

  if (!caso) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-16">
        {error.length > 0 ? (
          <>
            <h1 className="text-[clamp(28px,5vw,40px)] font-semibold leading-[1.1] tracking-[-0.015em] text-porcelain">Caso no disponible.</h1>
            <p role="alert" className="mt-4 text-[15px] text-ash">{error[0]}</p>
          </>
        ) : (
          <p className="text-[14px] text-ash">Cargando…</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-[13px] font-medium text-ash">
        {TIPOS[caso.tipo]?.nombre ?? caso.tipo} · vista de solo lectura · actualizado el {fecha(caso.actualizado)}
      </p>
      <h1 className="mt-1 text-[clamp(28px,5vw,44px)] font-semibold leading-[1.1] tracking-[-0.015em] text-porcelain">{caso.nombre}</h1>

      <div className="no-imprimir mt-5 flex flex-wrap items-center gap-3">
        {copia ? (
          <>
            <span role="status" className="text-[14px] text-porcelain">Copia guardada en tus casos.</span>
            <Boton onClick={() => router.push(`${TIPOS[copia.tipo]?.ruta ?? "/resolver"}?caso=${copia.id}`)}>Abrir mi copia para editarla</Boton>
          </>
        ) : usuario ? (
          <Boton disabled={copiando} onClick={() => void guardarCopia()}>
            {copiando ? "Guardando…" : "Guardar una copia en mis casos"}
          </Boton>
        ) : (
          <>
            <Boton onClick={abrirLogin}>Inicia sesión para guardar una copia</Boton>
            <span className="text-[13px] text-ash">Podrás editarla y resolverla con tus propios cambios.</span>
          </>
        )}
      </div>
      {error.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 rounded-[20px] border border-[#ff453a] p-3 text-[13px] text-porcelain">
          {error.map((m) => (
            <li key={m}>• {m}</li>
          ))}
        </ul>
      )}

      <div className="mt-8">
        <Vista c={caso} />
      </div>
    </div>
  );
}
