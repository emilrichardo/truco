"use client";
import clsx from "clsx";
import { urlPersonaje } from "@/data/jugadores";
import type { Jugador } from "@/lib/truco/types";

export function JugadorPanel({
  jugador,
  esTurno,
  esYo,
  compacto
}: {
  jugador: Jugador;
  esTurno: boolean;
  esYo?: boolean;
  compacto?: boolean;
}) {
  // Avatares rectangulares (aspect 3/4) para usar mejor el espacio en mobile.
  const tam = compacto
    ? "w-12 sm:w-14"
    : "w-20 sm:w-24";
  const borderEquipo = jugador.equipo === 0 ? "border-dorado" : "border-azul-criollo";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative">
        <div
          className={clsx(
            "aspect-[3/4] rounded-md overflow-hidden border-2 transition shadow-md",
            tam,
            esTurno ? "border-dorado halo" : borderEquipo,
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
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-carbon text-crema/80 border border-dorado/50 rounded text-[8px] px-1 uppercase font-bold tracking-wider"
            title="Bot"
          >
            bot
          </span>
        )}
        {esTurno && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-dorado parpadeo border border-carbon" />
        )}
      </div>
      <div className="text-center leading-tight mt-1.5">
        <div
          className={clsx(
            "text-sm sm:text-base font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]",
            esYo ? "text-dorado" : "text-crema"
          )}
        >
          {jugador.nombre}
          {esYo && (
            <span className="text-[10px] ml-1 acento-azul font-bold">(vos)</span>
          )}
        </div>
        <div className="text-[10px] text-crema/60 uppercase tracking-wider font-bold">
          Eq {jugador.equipo + 1}
        </div>
      </div>
    </div>
  );
}
