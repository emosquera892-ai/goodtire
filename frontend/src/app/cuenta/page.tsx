import type { Metadata } from "next";
import { CuentaPagina } from "@/components/CuentaPagina";

export const metadata: Metadata = { title: "Mi cuenta · Good Tire", robots: { index: false, follow: false } };

export default function Page() {
  return <CuentaPagina />;
}
