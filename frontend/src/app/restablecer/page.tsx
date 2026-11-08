import type { Metadata } from "next";
import { Suspense } from "react";
import { Restablecer } from "@/components/Restablecer";

// El enlace lleva un código secreto: que no se indexe ni se filtre a otros sitios.
export const metadata: Metadata = {
  title: "Nueva contraseña · Good Tire",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Restablecer />
    </Suspense>
  );
}
