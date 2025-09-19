import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServiceFlow",
  description: "Sistema de gestión de tickets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}