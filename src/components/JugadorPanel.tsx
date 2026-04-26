"use client";
import clsx from "clsx";
import { urlPersonaje } from "@/data/jugadores";
import type { Jugador } from "@/lib/truco/types";
import { CartaEspanola } from "./CartaEspanola";

export function JugadorPanel({
  jugador,
  esTurno,
  esYo,
  cartasOcultas,
  cantidadCartas
}: {
  jugador: Jugador;
  esTurno: boolean;
  esYo?: boolean;
  cartasOcultas?: boolean;
  cantidadCartas: number;
}) {
  return (
    <div className={clsx("flex flex-col items-center", esTurno && "flotar")}>
      <div className="relative">
        <div
          className={clsx(
            "w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4",
            esTurno ? "border-truco-gold glow-mate" : "border-truco-gold/40",
            !jugador.conectado && "grayscale opacity-60"
          )}
        >
          <img
            src={urlPersonaje(jugador.personaje)}
            alt={jugador.nombre}
            className="w-full h-full object-cover object-top"
          />
        </div>
        {jugador.esBot && (
          <span className="absolute -bottom-1 right-0 bg-truco-dark text-truco-gold border border-truco-gold rounded-full text-[9px] px-1.5 py-0.5 uppercase tracking-wider">
            bot
          </span>
        )}
        {esTurno && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 parpadeo bg-truco-gold text-truco-dark text-[10px] uppercase font-display px-2 rounded-full shadow">
            turno
          </span>
        )}
      </div>
      <div className="mt-1 text-center">
        <div className={clsx("font-display text-sm", esYo && "text-truco-gold")}>
          {jugador.nombre}
          {esYo && <span className="text-[10px] text-truco-gold/80 ml-1">(vos)</span>}
        </div>
        <div className="text-[10px] text-cream/60 uppercase tracking-wider">
          Equipo {jugador.equipo + 1}
        </div>
      </div>
      {cartasOcultas && cantidadCartas > 0 && (
        <div className="flex -space-x-3 mt-1">
          {Array.from({ length: cantidadCartas }).map((_, i) => (
            <CartaEspanola key={i} oculta pequena />
          ))}
        </div>
      )}
    </div>
  );
}
