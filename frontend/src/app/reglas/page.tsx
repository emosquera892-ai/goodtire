import type { Metadata } from "next";
import Link from "next/link";
import { Reglas } from "@/components/Editor";

export const metadata: Metadata = { title: "Reglas · Good Tire" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <h1 className="sr-only">Qué puedes introducir</h1>
      <Reglas />
      <Link
        href="/resolver"
        className="mt-6 inline-block rounded-full bg-apple-blue px-5 py-2.5 text-[14px] text-white transition hover:brightness-110"
      >
        Ir a resolver
      </Link>
    </div>
  );
}
