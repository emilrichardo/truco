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
  // El avatar y el botón de emojis viven cada uno en su propio
  // contenedor absolute, NO anidados — así el menú flotante de emojis
  // puede crecer fuera del bounding box del avatar sin clipping ni
  // colapso de ancho.
  return (
    <>
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
          hablandoReaccion={yoHablo ? hablandoReaccion : null}
          ladoBurbuja="arriba"
          ladoNombre="derecha"
          ocultarNombre
        />
      </div>
      {/* Botón de emojis: posicionado al borde inferior derecho del
       *  avatar (que mide w-20 sm:w-24 = 80/96px y vive en bottom-4
       *  left-4). Lo dejamos justo afuera del avatar a la derecha, con
       *  z-[510] por encima de él. */}
      {enviarChat && (
        <div className="absolute bottom-3 left-[6.5rem] sm:left-[7.5rem] z-[510]">
          <BarraEmociones enviarChat={enviarChat} />
        </div>
      )}
    </>
  );
}
