import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Koma Studio · Maquetador de cómics y manga",
  description: "Crea y maqueta cómics y manga en tu navegador. Local-first: tus proyectos no salen de tu equipo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${fontVariables} dark`}>
      <body>{children}</body>
    </html>
  );
}
