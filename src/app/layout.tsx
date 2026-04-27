import type { Metadata } from "next";
import "./globals.css";
import { MusicaAmbiental } from "@/components/MusicaAmbiental";

export const metadata: Metadata = {
  title: "Truco Entre Primos — Acá no hay suerte, hay picardía",
  description:
    "Truco argentino online entre primos. Gratis, sin registro. Picardía, fernet y cartas españolas."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no"
        />
        <meta name="theme-color" content="#1E1B18" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Alfa+Slab+One&family=Rye&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased font-sans">
        {children}
        <MusicaAmbiental />
      </body>
    </html>
  );
}
