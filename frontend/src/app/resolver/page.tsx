import type { Metadata } from "next";
import { Suspense } from "react";
import { Solver } from "@/components/Solver";

export const metadata: Metadata = { title: "Resolver · Good Tire" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Solver />
    </Suspense>
  );
}
