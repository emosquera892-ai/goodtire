import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { Marco } from "@/components/Marco";
import { SCRIPT_TEMA } from "@/lib/temaScript";

export const metadata: Metadata = {
  title: "Good Tire · Ubicación de almacenes",
  description:
    "Encuentra qué almacenes abrir para minimizar el costo total de distribución, con optimización matemática.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Marco>{children}</Marco>
      </body>
    </html>
  );
}
