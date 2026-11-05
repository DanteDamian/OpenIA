import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AIGENTERRA Finance AI",
  description: "Centro administrativo y financiero de AIGENTERRA",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CO">
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
