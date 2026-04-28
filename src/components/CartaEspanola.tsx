"use client";
import clsx from "clsx";
import type { Carta } from "@/lib/truco/types";
import { nombreCarta } from "@/lib/truco/cartas";

type Tamanio = "xs" | "sm" | "md" | "lg";

const ANCHOS: Record<Tamanio, string> = {
  xs: "w-9 sm:w-10",
  sm: "w-20 sm:w-24",
  md: "w-28 sm:w-36 md:w-40",
  lg: "w-32 sm:w-44 md:w-52"
};

export function CartaEspanola({
  carta,
  oculta,
  onClick,
  jugable,
  tamanio = "md",
  resaltada
}: {
  carta?: Carta;
  oculta?: boolean;
  onClick?: () => void;
  jugable?: boolean;
  tamanio?: Tamanio;
  resaltada?: boolean;
}) {
  const ancho = ANCHOS[tamanio];
  if (oculta || !carta) {
    return (
      <div
        className={clsx("es-card back", ancho, resaltada && "halo")}
      />
    );
  }
  // Usamos <img> directo en vez de next/image para esquivar el pipeline
  // de optimización de Vercel — las webp ya están comprimidas (~50-100KB)
  // y no necesitamos resizing por viewport. Resultado: la carta aparece
  // instantáneo apenas el browser termina el fetch de la webp, sin pasar
  // por /_next/image.
  const src = `/cartas/${carta.palo}/${carta.numero}.webp`;
  return (
    <button
      type="button"
      title={nombreCarta(carta)}
      onClick={onClick}
      disabled={!onClick || !jugable}
      className={clsx(
        "es-card transition relative p-0",
        ancho,
        jugable && "active:scale-95 hover:-translate-y-1",
        resaltada && "halo"
      )}
    >
      <img
        src={src}
        alt={nombreCarta(carta)}
        draggable={false}
        decoding="async"
        loading="eager"
        className="absolute inset-0 w-full h-full object-cover select-none"
      />
    </button>
  );
}
