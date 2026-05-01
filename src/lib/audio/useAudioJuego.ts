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

// Audios personalizados recibidos vía chat: cuando llega uno, lo
// reproducimos al toque y registramos en el mapa para suprimir la voz
// default del mismo canto durante una ventana de 3.5s. Sin esto, el
// canto del jugador suena dos veces (su audio + la voz default).
const audiosPersonalizadosRecientes = new Map<string, number>();
const SUPPRESS_VENTANA_MS = 3500;

function reproducirDataUrl(dataUrl: string) {
  if (typeof Audio === "undefined") return;
  try {
    const audio = new Audio(dataUrl);
    audio.volume = 0.95;
    audio.play().catch(() => {
      /* autoplay bloqueado — silencioso */
    });
  } catch {
    /* malformed dataUrl — ignore */
  }
}

/** Mapea el canto de la voz default (CategoriaCanto) al canto guardable
 *  (CantoConAudio) para chequear suppression. */
function cantoDefaultASuppressionKey(canto: string): string | null {
  switch (canto) {
    case "envido":
    case "envido_envido":
      return "envido";
    case "real_envido":
      return "real_envido";
    case "falta_envido":
      return "falta_envido";
    case "truco":
      return "truco";
    case "retruco":
      return "retruco";
    case "vale_cuatro":
      return "vale4";
    case "quiero":
      return "quiero";
    case "no_quiero":
      return "no_quiero";
    default:
      return null;
  }
}

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
      estado.jugadores.map((j) => ({
        id: j.id,
        asiento: j.asiento,
        personaje: j.personaje
      }))
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
  // 0) Audio personalizado del jugador para acompañar un canto. Lo
  //    reproducimos al toque y registramos para suprimir la voz default
  //    cuando llegue el evento del canto en el chat (puede llegar en
  //    cualquier orden: si el evento llegó primero, ya sonó la voz —
  //    igual reproducimos el audio personal y queda como overlay).
  if (m.audioCantoDataUrl && m.audioCantoTipo) {
    reproducirDataUrl(m.audioCantoDataUrl);
    audiosPersonalizadosRecientes.set(
      `${m.jugadorId}:${m.audioCantoTipo}`,
      Date.now()
    );
    return;
  }

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
        const jugadorId = m.jugadorId;
        const cantoKey = cantoDefaultASuppressionKey(id.canto);

        // Reproducción de la voz default — la encapsulamos para poder
        // diferirla 250ms cuando el canto es "personalizable", así si el
        // chat con el audio del jugador llega justo después del evento
        // del motor, alcanzamos a verlo y suprimimos la default.
        const reproducirDefault = () => {
          if (cantoKey) {
            const ts = audiosPersonalizadosRecientes.get(
              `${jugadorId}:${cantoKey}`
            );
            if (ts && Date.now() - ts < SUPPRESS_VENTANA_MS) {
              audiosPersonalizadosRecientes.delete(`${jugadorId}:${cantoKey}`);
              if (id.canto === "ir_al_mazo") sonidoMazo();
              return;
            }
          }
          const reproductor = esReaccion(id.canto)
            ? reproducirReaccion
            : reproducirCanto;
          reproductor(id.canto, {
            jugadorId,
            variante: id.variante > 0 ? id.variante : undefined
          });
          if (id.canto === "ir_al_mazo") sonidoMazo();
        };

        if (cantoKey) {
          // El audio personalizado y el evento del canto viajan por
          // mensajes de chat distintos — en el peor caso el evento
          // llega primero. Esperamos 250ms para darle tiempo al audio
          // de aterrizar y registrarse como suppression.
          window.setTimeout(reproducirDefault, 250);
        } else {
          reproducirDefault();
        }
      } else if (id?.canto === "ir_al_mazo") {
        sonidoMazo();
      }
      break;
    }
  }
}
