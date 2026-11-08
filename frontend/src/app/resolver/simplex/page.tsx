import type { Metadata } from "next";
import { Suspense } from "react";
import { SolverSimplex } from "@/components/SolverSimplex";

export const metadata: Metadata = { title: "Programación lineal · Good Tire" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SolverSimplex />
    </Suspense>
  );
}
