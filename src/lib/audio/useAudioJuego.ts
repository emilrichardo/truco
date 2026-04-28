"use client";
// Hook que reacciona al estado del juego para disparar SFX y voces.
//  - SFX: sonido de carta, tintineo de puntos, golpe sordo al irse al mazo.
//  - Voces: clips MP3 generados con ElevenLabs (ver sonidos.ts) que se
//    reproducen al detectar cantos / respuestas en el chat. Cada jugador
//    tiene una voz estable asignada por hash.
import { useEffect, useRef } from "react";
import type { EstadoJuego, MensajeChat } from "@/lib/truco/types";
import { despertarAudio, sonidoCarta, sonidoMazo, sonidoPuntos } from "./sfx";
import { cortarReproduccion, identificarCanto, reproducirCanto } from "./sonidos";

export function useAudioJuego(
  estado: EstadoJuego | null,
  _miId: string | null
) {
  const ultimoChatId = useRef<string | null>(null);
  const ultimoManoNum = useRef<number>(0);

  // Desbloquear AudioContext en el primer click (browser autoplay policy).
  useEffect(() => {
    const desbloquear = () => {
      despertarAudio();
      window.removeEventListener("click", desbloquear);
      window.removeEventListener("touchstart", desbloquear);
    };
    window.addEventListener("click", desbloquear, { once: true });
    window.addEventListener("touchstart", desbloquear, { once: true });
    return () => {
      window.removeEventListener("click", desbloquear);
      window.removeEventListener("touchstart", desbloquear);
    };
  }, []);

  // Cuando arranca una mano nueva (se reparten cartas), cortamos cualquier
  // canto/reacción rezagado de la mano anterior. Las reacciones de
  // gane_mano / perdio_mano son cortas y entran en el delay de 3.5s, pero
  // si el clip es largo o quedó encolado detrás de otro, esto evita que
  // se siga escuchando encima del nuevo reparto.
  const manoNum = estado?.manoActual?.numero ?? 0;
  useEffect(() => {
    if (manoNum !== ultimoManoNum.current) {
      ultimoManoNum.current = manoNum;
      if (manoNum > 0) cortarReproduccion();
    }
  }, [manoNum]);

  // Procesar nuevos eventos del chat para SFX + voces.
  useEffect(() => {
    if (!estado || !estado.chat.length) return;
    const idx = estado.chat.findIndex((m) => m.id === ultimoChatId.current);
    const nuevos = idx === -1 ? estado.chat.slice(-3) : estado.chat.slice(idx + 1);
    for (const m of nuevos) procesarMensaje(m);
    ultimoChatId.current = estado.chat[estado.chat.length - 1].id;
  }, [estado, estado?.chat.length]);
}

function procesarMensaje(m: MensajeChat) {
  switch (m.evento) {
    case "carta":
      sonidoCarta();
      break;
    case "puntos":
      sonidoPuntos();
      break;
    case "canto":
    case "respuesta":
    case "mano": {
      // Voz: matcheamos el texto contra FRASES para reproducir EXACTAMENTE
      // el variante que el motor pickeó (no uno random) — así el audio
      // coincide con lo que aparece en el chat. Para "ir al mazo" sumamos
      // el golpe sordo del SFX para reforzar el cierre.
      const id = identificarCanto(m.texto);
      if (id && m.jugadorId) {
        reproducirCanto(id.canto, {
          jugadorId: m.jugadorId,
          variante: id.variante > 0 ? id.variante : undefined
        });
      }
      if (id?.canto === "ir_al_mazo") sonidoMazo();
      break;
    }
  }
}
