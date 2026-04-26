import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Truco entre Primos",
  description: "Truco argentino online entre primos. Gratis, sin registro."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Inter:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-truco-dark text-cream font-body antialiased">
        {children}
      </body>
    </html>
  );
}
