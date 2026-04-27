"use client";
import clsx from "clsx";
import Image from "next/image";
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
  const src = `/cartas/${carta.palo}/${carta.numero}.png`;
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
      <Image
        src={src}
        alt={nombreCarta(carta)}
        fill
        sizes="(max-width: 640px) 160px, (max-width: 768px) 208px, 256px"
        draggable={false}
        className="object-cover select-none"
      />
    </button>
  );
}
