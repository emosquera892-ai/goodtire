import type { Metadata } from "next";
import { Suspense } from "react";
import { SolverTransporte } from "@/components/SolverTransporte";

export const metadata: Metadata = { title: "Transporte · Good Tire" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SolverTransporte />
    </Suspense>
  );
}
