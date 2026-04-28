"use client";
// Avatar del jugador local, fijo a la esquina inferior IZQUIERDA de la
// pantalla. (El nombre del componente quedó como "BR" por historia — antes
// vivía abajo-derecha. Lo dejamos así para no romper imports.) Vive fuera
// de la Mesa para que no interfiera con el plano 3D de cartas y siempre
// quede visible en el corner.
import { JugadorPanel } from "./JugadorPanel";
import { useHablando } from "@/lib/useHablando";
import type { EstadoJuego } from "@/lib/truco/types";

export function MiAvatarBR({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string;
}) {
  const {
    hablandoId,
    hablandoKey,
    hablandoTexto,
    hablandoEvento,
    hablandoSticker
  } = useHablando(estado);
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me) return null;
  const esTurno = estado.manoActual?.turnoJugadorId === me.id;
  const esMano = estado.manoActual?.manoJugadorId === me.id;
  const yoHablo = hablandoId === me.id;
  return (
    <div className="absolute bottom-4 left-4 z-[500] pointer-events-none">
      <JugadorPanel
        jugador={me}
        esTurno={!!esTurno}
        esMano={!!esMano}
        esYo
        hablando={yoHablo}
        hablandoKey={yoHablo ? hablandoKey : null}
        hablandoTexto={yoHablo ? hablandoTexto : null}
        hablandoEvento={yoHablo ? hablandoEvento : null}
        hablandoSticker={yoHablo ? hablandoSticker : null}
        ladoBurbuja="arriba"
        ladoNombre="derecha"
        ocultarNombre
      />
    </div>
  );
}
