import type { Metadata } from "next";
import { Suspense } from "react";
import { SolverTransbordo } from "@/components/SolverTransbordo";

export const metadata: Metadata = { title: "Transbordo · Good Tire" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SolverTransbordo />
    </Suspense>
  );
}
