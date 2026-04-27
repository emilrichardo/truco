"use client";
// Burbuja flotante con los últimos N mensajes humanos del chat. Siempre
// visible sobre la mesa, semi-transparente, no bloquea interacción.
import { useMemo } from "react";
import clsx from "clsx";
import type { EstadoJuego } from "@/lib/truco/types";
import { urlPersonaje } from "@/data/jugadores";

const N_MENSAJES = 3;

export function ChatFlotante({
  estado,
  miId,
  onAbrir
}: {
  estado: EstadoJuego;
  miId: string;
  onAbrir?: () => void;
}) {
  // Sólo mensajes humanos (no eventos del sistema), los últimos N.
  const ultimos = useMemo(() => {
    const humanos = estado.chat.filter((m) => !m.evento);
    return humanos.slice(-N_MENSAJES);
  }, [estado.chat]);

  if (ultimos.length === 0) return null;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="absolute z-20 bottom-2 left-2 max-w-[70%] sm:max-w-[280px] flex flex-col gap-1 items-start text-left"
    >
      {ultimos.map((m) => {
        const j = estado.jugadores.find((x) => x.id === m.jugadorId);
        const esYo = m.jugadorId === miId;
        return (
          <div
            key={m.id}
            className={clsx(
              "flex items-center gap-1.5 max-w-full",
              esYo && "self-end flex-row-reverse"
            )}
          >
            {j && (
              <img
                src={urlPersonaje(j.personaje)}
                alt=""
                className={clsx(
                  "w-6 h-6 rounded-full object-cover object-top flex-shrink-0 border",
                  esYo ? "border-dorado" : "border-azul-criollo/60"
                )}
              />
            )}
            <div
              className={clsx(
                "rounded-md px-2 py-1 text-[11px] sm:text-xs leading-tight max-w-full truncate shadow-md backdrop-blur-sm",
                esYo
                  ? "bg-dorado/85 text-carbon font-bold"
                  : "bg-carbon/75 text-crema border border-azul-criollo/40"
              )}
            >
              {m.reaccion ? (
                <span className="text-base">{m.reaccion}</span>
              ) : (
                <>
                  {!esYo && j && (
                    <span className="text-dorado/90 mr-1 font-bold">
                      {j.nombre}:
                    </span>
                  )}
                  {m.texto}
                </>
              )}
            </div>
          </div>
        );
      })}
    </button>
  );
}
