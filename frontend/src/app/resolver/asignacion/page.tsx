import type { Metadata } from "next";
import { Suspense } from "react";
import { SolverAsignacion } from "@/components/SolverAsignacion";

export const metadata: Metadata = { title: "Asignación · Good Tire" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SolverAsignacion />
    </Suspense>
  );
}
