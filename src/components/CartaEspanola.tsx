"use client";
import clsx from "clsx";
import type { Carta, Palo } from "@/lib/truco/types";
import { nombreCarta } from "@/lib/truco/cartas";

const SIMBOLO_PALO: Record<Palo, string> = {
  espada: "⚔",
  basto: "🌿",
  oro: "☀",
  copa: "🏆"
};

const COLOR_PALO: Record<Palo, string> = {
  espada: "#1a3a8a",
  basto: "#2f6b1f",
  oro: "#a06814",
  copa: "#8b1c1c"
};

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
  const numero = carta.numero;
  const display =
    numero === 10 ? "10" : numero === 11 ? "11" : numero === 12 ? "12" : String(numero);
  const sym = SIMBOLO_PALO[carta.palo];
  const color = COLOR_PALO[carta.palo];

  return (
    <button
      type="button"
      title={nombreCarta(carta)}
      onClick={onClick}
      disabled={!onClick || !jugable}
      className={clsx(
        "es-card transition",
        pequena ? "w-12" : "w-20 md:w-24",
        jugable && "cursor-pointer hover:-translate-y-2 hover:shadow-2xl",
        !jugable && "cursor-default opacity-95",
        resaltada && "glow-mate"
      )}
      style={{ borderColor: color }}
    >
      <span className="es-num tl" style={{ color }}>
        {display}
      </span>
      <span className="es-suit" style={{ color }}>
        {sym}
      </span>
      <span className="es-num br" style={{ color }}>
        {display}
      </span>
    </button>
  );
}
