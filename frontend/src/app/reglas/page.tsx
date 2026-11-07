import type { Metadata } from "next";
import Link from "next/link";
import { ReglasAsignacion } from "@/components/EditorAsignacion";
import { ReglasTransporte } from "@/components/EditorTransporte";
import { Reglas } from "@/components/Editor";

export const metadata: Metadata = { title: "Reglas · Good Tire" };

const enlace = "rounded-full border border-slate px-5 py-2.5 text-[14px] text-porcelain transition hover:bg-white/5";

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-6 py-12">
      <h1 className="sr-only">Qué puedes introducir</h1>
      <Reglas />
      <ReglasTransporte />
      <ReglasAsignacion />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/resolver"
          className="rounded-full bg-apple-blue px-5 py-2.5 text-[14px] text-white transition hover:brightness-110"
        >
          Resolver ubicación de almacenes
        </Link>
        <Link href="/resolver/transporte" className={enlace}>
          Resolver transporte
        </Link>
        <Link href="/resolver/asignacion" className={enlace}>
          Resolver asignación
        </Link>
      </div>
    </div>
  );
}
