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
  encolarDataUrl,
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
const SUPPRESS_VENTANA_MS = 4500;
// Cuando un cliente sabe localmente que está por mandar un audio
// (lo grabó este mismo dispositivo), llama marcarAudioReciente ANTES
// de despachar la acción — así su propio cliente suprime la voz
// default sin depender de la latencia del realtime.
export function marcarAudioReciente(jugadorId: string, canto: string) {
  audiosPersonalizadosRecientes.set(`${jugadorId}:${canto}`, Date.now());
}
// Delay antes de reproducir la voz default cuando el canto es
// "personalizable" — le damos tiempo al chat con el audio personal a
// llegar y registrarse como suppression. SOLO se aplica para cantos
// de OTROS HUMANOS, no para los nuestros (marcarAudioReciente ya seteó
// el flag) ni para bots (que no tienen audio personal). Sin esto, los
// "Tengo X" / "Son buenas" sonaban antes que el "Quiero" porque el
// quiero estaba diferido pero los puntos no.
const DELAY_DEFAULT_MS = 850;
// Set de jugadorId que son bots — actualizado desde useAudioJuego al
// detectar cambios en estado.jugadores.
const botIds = new Set<string>();
// Mi propio jugadorId — actualizado cuando llega.
let miIdActual: string | null = null;

function reproducirDataUrl(dataUrl: string) {
  // Va por la cola FIFO de cantos para que no se superponga con la
  // voz default de eventos consecutivos. Antes plays directo con
  // new Audio() y se escuchaba "Quiero" + "Retruco" al mismo tiempo
  // cuando ambos llegaban en ráfaga.
  encolarDataUrl(dataUrl);
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
    case "ir_al_mazo":
      return "mazo";
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
  miId: string | null
) {
  const ultimoChatId = useRef<string | null>(null);
  const ultimoManoNum = useRef<number>(0);
  const precargado = useRef(false);

  // Sincronizamos el set de bots y el miId al modulo cada vez que el
  // estado/miId cambian — procesarMensaje los usa para decidir si
  // delaya o no la voz default (sólo otros humanos = delay).
  miIdActual = miId;
  if (estado) {
    botIds.clear();
    for (const j of estado.jugadores) if (j.esBot) botIds.add(j.id);
  }

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
      // Saltamos al final del chat — sino al cambiar de mano se podían
      // re-procesar mensajes viejos (envido de la mano anterior, etc.)
      // si el ultimoChatId tracking quedaba desincronizado.
      if (estado?.chat.length) {
        ultimoChatId.current = estado.chat[estado.chat.length - 1].id;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manoNum]);

  // Procesar nuevos eventos del chat para SFX + voces.
  useEffect(() => {
    if (!estado || !estado.chat.length) return;
    const idx = estado.chat.findIndex((m) => m.id === ultimoChatId.current);
    let nuevos: typeof estado.chat;
    if (idx >= 0) {
      nuevos = estado.chat.slice(idx + 1);
    } else if (ultimoChatId.current === null) {
      // Primera vez — no replay del histórico, solo seguimos desde
      // este momento. Sino al entrar/refrescar se podían escuchar
      // cantos viejos de la mano anterior.
      nuevos = [];
    } else {
      // Perdimos el tracking (ej. el chat se shifteó por >200 msgs).
      // Saltamos al final sin reproducir nada — sino se podían
      // re-escuchar mensajes viejos como si fuesen nuevos.
      nuevos = [];
    }
    for (const m of nuevos) procesarMensaje(m, estado.chat);
    ultimoChatId.current = estado.chat[estado.chat.length - 1].id;
  }, [estado, estado?.chat.length]);
}

/** Busca en la historia del chat si hay un audio personalizado del
 *  mismo jugador para el mismo canto en los últimos 5s. Útil para
 *  saber si suprimir la voz default sin depender del flag in-memory
 *  (que tiene un race según el orden de llegada de los chats). */
function hayAudioCustomReciente(
  chat: import("@/lib/truco/types").MensajeChat[],
  jugadorId: string,
  cantoKey: string,
  ahora = Date.now()
): boolean {
  for (let i = chat.length - 1; i >= 0; i--) {
    const c = chat[i];
    if (ahora - c.ts > 5000) break; // muy viejo
    if (
      c.jugadorId === jugadorId &&
      c.audioCantoTipo === cantoKey &&
      !!c.audioCantoDataUrl
    ) {
      return true;
    }
  }
  return false;
}

function procesarMensaje(m: MensajeChat, chat: MensajeChat[] = []) {
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
        // diferirla 250ms cuando el canto es "personalizable", así si
        // el chat con el audio del jugador llega justo después del
        // evento del motor, alcanzamos a verlo y suprimimos la default.
        const reproducirDefault = () => {
          if (cantoKey) {
            const ts = audiosPersonalizadosRecientes.get(
              `${jugadorId}:${cantoKey}`
            );
            const hayChat = hayAudioCustomReciente(chat, jugadorId, cantoKey);
            if (
              hayChat ||
              (ts && Date.now() - ts < SUPPRESS_VENTANA_MS)
            ) {
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

        // Decidimos si delayamos o no:
        //  - Si el canto es de OTRO humano: delay (puede llegar audio
        //    custom de él vía chat, hay que esperar el race).
        //  - Si es mío: marcarAudioReciente ya seteó el flag sync
        //    (si tengo audio); reproducir inmediato (suppress chequea
        //    el flag y skipea si corresponde).
        //  - Si es de un bot: no tiene audio custom posible, inmediato.
        // Sin esto, "Tengo X" / "Son buenas" sonaban antes del "Quiero"
        // porque el quiero estaba diferido pero los puntos no.
        const esOtroHumano =
          jugadorId !== miIdActual && !botIds.has(jugadorId);
        if (cantoKey && esOtroHumano) {
          window.setTimeout(reproducirDefault, DELAY_DEFAULT_MS);
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
