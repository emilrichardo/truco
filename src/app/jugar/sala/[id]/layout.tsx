import type { Metadata } from "next";

// Las salas tienen IDs efímeros y dinámicos; no aportan a la búsqueda y
// además algunas son privadas. Las marcamos noindex/nofollow para que
// ningún crawler las archive aunque alguien comparta el link.
export const metadata: Metadata = {
  title: "Sala de truco",
  description: "Sala privada de truco entre primos.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};

export default function SalaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
