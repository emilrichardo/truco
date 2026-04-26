"use client";
import { useEffect, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

export function Anuncios({ estado }: { estado: EstadoJuego }) {
  const [recientes, setRecientes] = useState<typeof estado.anuncios>([]);

  useEffect(() => {
    setRecientes(estado.anuncios.slice(-3));
    const t = setTimeout(() => setRecientes([]), 4000);
    return () => clearTimeout(t);
  }, [estado.anuncios.length]);

  if (!recientes.length) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1 pointer-events-none">
      {recientes.map((a) => (
        <div
          key={a.id}
          className="bg-truco-red/90 border border-truco-gold text-cream px-3 py-1 rounded-full font-display text-sm uppercase tracking-wider shadow-lg"
        >
          {a.texto}
        </div>
      ))}
    </div>
  );
}
