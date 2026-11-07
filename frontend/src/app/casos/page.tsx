import type { Metadata } from "next";
import { CasosPagina } from "@/components/CasosPagina";

export const metadata: Metadata = { title: "Mis casos · Good Tire" };

export default function Page() {
  return <CasosPagina />;
}
