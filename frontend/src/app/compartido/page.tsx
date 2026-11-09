import type { Metadata } from "next";
import { Suspense } from "react";
import { CompartidoPagina } from "@/components/CompartidoPagina";

// El enlace es privado para quien lo recibe: que no se indexe ni se filtre a otros sitios.
export const metadata: Metadata = {
  title: "Caso compartido · Good Tire",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CompartidoPagina />
    </Suspense>
  );
}
