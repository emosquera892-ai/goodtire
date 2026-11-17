import type { Metadata } from "next";
import { Suspense } from "react";
import { SolverGrafos } from "@/components/SolverGrafos";

export const metadata: Metadata = { title: "Redes y grafos · Good Tire" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SolverGrafos />
    </Suspense>
  );
}
