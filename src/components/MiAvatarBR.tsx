"use client";
// Avatar del jugador local, fijo a la esquina inferior derecha de la pantalla.
// Vive fuera de la Mesa para que no interfiera con el layout de la cruz de
// cartas y siempre quede visible en el corner.
import { JugadorPanel } from "./JugadorPanel";
import type { EstadoJuego } from "@/lib/truco/types";

export function MiAvatarBR({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string;
}) {
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me) return null;
  const esTurno = estado.manoActual?.turnoJugadorId === me.id;
  const esMano = estado.manoActual?.manoJugadorId === me.id;
  return (
    // absolute (no fixed) para que se apoye contra la columna del juego y
    // no choque con el chat sidebar en desktop. El padre que lo contiene
    // tiene position: relative.
    <div className="absolute bottom-2 right-2 z-30 pointer-events-none">
      <JugadorPanel
        jugador={me}
        esTurno={!!esTurno}
        esMano={!!esMano}
        esYo
        compacto
      />
    </div>
  );
}
