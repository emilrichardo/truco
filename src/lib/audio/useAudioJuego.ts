"use client";
// Hook que reacciona al estado del juego para disparar SFX y voces.
//  - SFX: sonido de carta, tintineo de puntos, golpe sordo al irse al mazo.
//  - Voces: clips MP3 generados con ElevenLabs (ver sonidos.ts) que se
//    reproducen al detectar cantos / respuestas en el chat. Cada jugador
//    tiene una voz estable asignada por hash.
import { useEffect, useRef } from "react";
import type { EstadoJuego, MensajeChat } from "@/lib/truco/types";
import { despertarAudio, sonidoCarta, sonidoMazo, sonidoPuntos } from "./sfx";
import {
  cortarReproduccion,
  esReaccion,
  identificarCanto,
  identificarTanto,
  precargarVoces,
  reproducirCanto,
  reproducirPuntosEnvido,
  reproducirReaccion,
  setAsientosJugadores
} from "./sonidos";

// Lista canónica de cartas para precargar (40 webp). La inferimos del mismo
// formato que usa CartaEspanola: /cartas/<palo>/<numero>.webp
const PALOS_CARTAS = ["espada", "basto", "oro", "copa"] as const;
const NUMEROS_CARTAS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12] as const;

function precargarCartas() {
  if (typeof window === "undefined") return;
  for (const palo of PALOS_CARTAS) {
    for (const num of NUMEROS_CARTAS) {
      const url = `/cartas/${palo}/${num}.webp`;
      // Image() en JS dispara fetch → cache HTTP. No insertamos en el DOM.
      const img = new Image();
      img.src = url;
    }
  }
}

export function useAudioJuego(
  estado: EstadoJuego | null,
  _miId: string | null
) {
  const ultimoChatId = useRef<string | null>(null);
  const ultimoManoNum = useRef<number>(0);
  const precargado = useRef(false);

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

  // Cortar audio cuando la pestaña se esconde (cambio de tab, app en
  // background, salida de Chrome). Howler con html5: true sigue
  // reproduciendo en background si no lo paramos manualmente.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onHide = () => {
      if (document.hidden) cortarReproduccion();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", cortarReproduccion);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", cortarReproduccion);
    };
  }, []);

  // Precarga: una sola vez por sesión, apenas tenemos la lista de
  // jugadores. Cartas (40 webp) + voces de los jugadores en partida
  // (cantos más comunes). Usa fetch con cache:force-cache para no
  // bloquear el render — sólo calienta el cache HTTP del browser.
  // También seteamos el mapa jugador→asiento para que vozDeJugador
  // asigne sin colisiones.
  useEffect(() => {
    if (!estado || estado.jugadores.length === 0) return;
    setAsientosJugadores(
      estado.jugadores.map((j) => ({ id: j.id, asiento: j.asiento }))
    );
    if (precargado.current) return;
    precargado.current = true;
    precargarCartas();
    precargarVoces(estado.jugadores.map((j) => j.id));
  }, [estado]);

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
      // 1) Declaración de tanto del envido ("Tengo 33."): el motor emite
      //    una de estas por equipo después del Quiero, en orden mano →
      //    otro. La capa de audio reproduce el clip envido_puntos/<NN>.mp3
      //    con la voz del jugador para que escuches qué tenía cada uno.
      const tanto = identificarTanto(m.texto);
      if (tanto !== null && m.jugadorId) {
        reproducirPuntosEnvido(m.jugadorId, tanto);
        break;
      }
      // 2) Canto / respuesta / reacción regular. Matcheamos el texto contra
      //    FRASES para reproducir EXACTAMENTE el variante que el motor
      //    pickeó. Reacciones (gane_mano / perdio_mano / etc.) van por
      //    la vía paralela — bypassan la cola de cantos para que los 2-4
      //    jugadores reaccionen superpuestos. Cantos del juego siguen
      //    serializados.
      const id = identificarCanto(m.texto);
      if (id && m.jugadorId) {
        const reproductor = esReaccion(id.canto)
          ? reproducirReaccion
          : reproducirCanto;
        reproductor(id.canto, {
          jugadorId: m.jugadorId,
          variante: id.variante > 0 ? id.variante : undefined
        });
      }
      if (id?.canto === "ir_al_mazo") sonidoMazo();
      break;
    }
  }
}
