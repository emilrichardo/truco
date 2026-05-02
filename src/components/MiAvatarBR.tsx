"use client";
// Avatar del jugador local, fijo a la esquina inferior IZQUIERDA de la
// pantalla. (El nombre del componente quedó como "BR" por historia — antes
// vivía abajo-derecha. Lo dejamos así para no romper imports.) Vive fuera
// de la Mesa para que no interfiera con el plano 3D de cartas y siempre
// quede visible en el corner.
//
// La BarraEmociones se renderiza adentro como hija del avatar para
// quedar visualmente anclada al borde inferior derecho — la posición
// es relativa al wrapper, no al viewport.
import { JugadorPanel } from "./JugadorPanel";
import { BarraEmociones } from "./BarraEmociones";
import { useHablando } from "@/lib/useHablando";
import type { EstadoJuego, MensajeChat } from "@/lib/truco/types";

export function MiAvatarBR({
  estado,
  miId,
  enviarChat
}: {
  estado: EstadoJuego;
  miId: string;
  enviarChat?: (m: Partial<MensajeChat>) => void;
}) {
  const {
    hablandoId,
    hablandoKey,
    hablandoTexto,
    hablandoEvento,
    hablandoSticker,
    hablandoReaccion
  } = useHablando(estado);
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me) return null;
  const esTurno = estado.manoActual?.turnoJugadorId === me.id;
  const esMano = estado.manoActual?.manoJugadorId === me.id;
  const yoHablo = hablandoId === me.id;
  return (
    <div className="absolute bottom-4 left-4 z-[500] pointer-events-none">
      {/* Wrapper relativo al avatar: el botón de emojis se ancla a la
       *  esquina inferior derecha de este contenedor (que abraza al
       *  avatar). pointer-events-none acá; el botón lo reactiva. */}
      <div className="relative inline-block">
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
          hablandoReaccion={yoHablo ? hablandoReaccion : null}
          ladoBurbuja="arriba"
          ladoNombre="derecha"
          ocultarNombre
        />
        {enviarChat && (
          <div className="absolute -bottom-1 -right-3 pointer-events-auto">
            <BarraEmociones enviarChat={enviarChat} />
          </div>
        )}
      </div>
    </div>
  );
}
