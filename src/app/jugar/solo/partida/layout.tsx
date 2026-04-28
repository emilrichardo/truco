import type { Metadata } from "next";

// La partida solo es una pantalla efímera; no debe aparecer en buscadores.
export const metadata: Metadata = {
  title: "Partida vs máquina",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false }
  }
};

export default function PartidaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
