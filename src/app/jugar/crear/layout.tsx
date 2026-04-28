import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear sala online",
  description:
    "Armá tu mesa de truco entre primos. Compartí el link de la sala y jugá 1v1 o 2v2 con tus amigos en tiempo real, sin registro.",
  alternates: { canonical: "/jugar/crear" },
  openGraph: {
    title: "Crear sala online — Truco Entre Primos",
    description:
      "Armá la mesa, compartí el link y jugá truco con tus primos en tiempo real.",
    url: "/jugar/crear"
  }
};

export default function CrearLayout({ children }: { children: React.ReactNode }) {
  return children;
}
