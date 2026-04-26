"use client";
import clsx from "clsx";
import type { Carta } from "@/lib/truco/types";
import { nombreCarta } from "@/lib/truco/cartas";

export function CartaEspanola({
  carta,
  oculta,
  onClick,
  jugable,
  pequena,
  resaltada
}: {
  carta?: Carta;
  oculta?: boolean;
  onClick?: () => void;
  jugable?: boolean;
  pequena?: boolean;
  resaltada?: boolean;
}) {
  if (oculta || !carta) {
    return (
      <div
        className={clsx(
          "es-card back",
          pequena ? "w-12" : "w-20 md:w-24",
          resaltada && "glow-mate"
        )}
      />
    );
  }

  const src = `/cartas/${carta.palo}/${carta.numero}.jpg`;

  return (
    <button
      type="button"
      title={nombreCarta(carta)}
      onClick={onClick}
      disabled={!onClick || !jugable}
      className={clsx(
        "es-card transition relative p-0",
        pequena ? "w-12" : "w-20 md:w-24",
        jugable && "cursor-pointer hover:-translate-y-2 hover:shadow-2xl hover:ring-2 hover:ring-truco-gold",
        !jugable && "cursor-default opacity-95"
      )}
    >
      <img
        src={src}
        alt={nombreCarta(carta)}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover rounded-[6px] select-none"
      />
      {resaltada && (
        <span className="absolute inset-0 rounded-[6px] ring-2 ring-truco-gold pointer-events-none glow-mate" />
      )}
    </button>
  );
}
