"use client";
// Hook que reacciona al estado del juego para disparar SFX. Las voces
// fueron eliminadas; ahora sólo maneja:
//  - sonido de carta al tirarse
//  - tintineo cuando suman puntos
//  - sonido sordo al irse al mazo
import { useEffect, useRef } from "react";
import type { EstadoJuego, MensajeChat } from "@/lib/truco/types";
import { despertarAudio, sonidoCarta, sonidoMazo, sonidoPuntos } from "./sfx";

export function useAudioJuego(
  estado: EstadoJuego | null,
  _miId: string | null
) {
  const ultimoChatId = useRef<string | null>(null);

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

  // Procesar nuevos eventos del chat para SFX.
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
    case "respuesta":
      // Se fue al mazo → "mazo" SFX sordo. Quiero/no-quiero sin SFX.
      if (/mazo/i.test(m.texto)) sonidoMazo();
      break;
  }
}
