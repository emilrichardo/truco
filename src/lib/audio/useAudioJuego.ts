"use client";
// Hook que escucha eventos del estado del juego y reproduce los sonidos
// correspondientes: voz para cantos/respuestas, thud para cartas, reacciones
// para fin de mano y fin de partida.
import { useEffect, useRef } from "react";
import type { EstadoJuego, MensajeChat } from "@/lib/truco/types";
import { despertarAudio, sonidoCarta, sonidoMazo, sonidoPuntos } from "./sfx";
import {
  identificarCanto,
  precargarTodosLosClips,
  reaccionGanaMano,
  reaccionGanaPartida,
  reaccionPierdeMano,
  reaccionPierdePartida,
  reproducirCanto,
  silenciarTodo
} from "./sonidos";
import { desbloquearVoz, precargarVoces } from "./voz";

const PROB_REACCION_MANO = 0.55;
const PROB_REACCION_PARTIDA = 1.0;

export function useAudioJuego(
  estado: EstadoJuego | null,
  miId: string | null
) {
  const ultimoChatId = useRef<string | null>(null);
  const ultimoManoNum = useRef<number>(0);
  const ultimoGanador = useRef<number | null>(null);
  const habilitado = useRef(false);

  // Precargar voces y desbloquear audio en el primer click.
  useEffect(() => {
    precargarVoces();
    precargarTodosLosClips();
    const desbloquear = () => {
      despertarAudio();
      desbloquearVoz();
      habilitado.current = true;
      window.removeEventListener("click", desbloquear);
      window.removeEventListener("touchstart", desbloquear);
    };
    window.addEventListener("click", desbloquear, { once: true });
    window.addEventListener("touchstart", desbloquear, { once: true });
    return () => {
      window.removeEventListener("click", desbloquear);
      window.removeEventListener("touchstart", desbloquear);
      silenciarTodo();
    };
  }, []);

  // Procesar nuevos eventos del chat.
  useEffect(() => {
    if (!estado || !estado.chat.length) return;
    // Pasar por TODOS los nuevos mensajes desde el último procesado, no sólo el último.
    const idx = estado.chat.findIndex((m) => m.id === ultimoChatId.current);
    const nuevos = idx === -1 ? estado.chat.slice(-3) : estado.chat.slice(idx + 1);
    for (const m of nuevos) procesarMensaje(m, estado);
    ultimoChatId.current = estado.chat[estado.chat.length - 1].id;
  }, [estado, estado?.chat.length]);

  // Reaccionar al cambio de mano y al fin de partida.
  useEffect(() => {
    if (!estado || !miId) return;
    const manoAct = estado.manoActual?.numero ?? 0;
    if (manoAct !== ultimoManoNum.current && ultimoManoNum.current > 0) {
      // Termino la mano anterior. Mirar el ganador en historialManos.
      const anterior = estado.historialManos[estado.historialManos.length - 1];
      if (anterior?.ganadorMano !== null && anterior?.ganadorMano !== undefined) {
        reaccionarFinDeMano(estado, miId, anterior.ganadorMano);
      }
    }
    ultimoManoNum.current = manoAct;

    if (
      estado.ganadorPartida !== null &&
      estado.ganadorPartida !== ultimoGanador.current
    ) {
      reaccionarFinDePartida(estado, miId, estado.ganadorPartida);
      ultimoGanador.current = estado.ganadorPartida;
    }
  }, [estado, miId]);
}

function procesarMensaje(m: MensajeChat, _estado: EstadoJuego) {
  switch (m.evento) {
    case "carta": {
      sonidoCarta();
      break;
    }
    case "canto": {
      const tipo = identificarCanto(m.texto);
      if (!tipo) return;
      reproducirCanto(tipo, { jugadorId: m.jugadorId, texto: m.texto });
      break;
    }
    case "respuesta": {
      const tipo = identificarCanto(m.texto);
      if (!tipo) return;
      reproducirCanto(tipo, { jugadorId: m.jugadorId, texto: m.texto });
      break;
    }
    case "puntos": {
      sonidoPuntos();
      break;
    }
    case "mano": {
      // El cierre de mano lo manejamos por separado en el useEffect de mano.
      break;
    }
  }
}

function reaccionarFinDeMano(
  estado: EstadoJuego,
  miId: string,
  ganadorEquipo: number
) {
  if (Math.random() > PROB_REACCION_MANO) return;
  const me = estado.jugadores.find((j) => j.id === miId);
  const yoGane = me ? me.equipo === ganadorEquipo : false;

  // Elegimos a UN jugador del equipo correspondiente (no siempre yo) para que
  // sea quien "reacciona" en voz alta.
  const candidatos = estado.jugadores.filter((j) =>
    yoGane ? j.equipo !== me!.equipo : j.equipo === ganadorEquipo
  );
  // Para que el feedback sea inmediato y "real": si yo gané, el rival se
  // queja. Si yo perdí, el ganador rival celebra. (Mismo equipo en ambos
  // casos: el equipo opuesto a mí.)
  const oponente = candidatos[Math.floor(Math.random() * candidatos.length)];
  if (!oponente) return;

  if (yoGane) {
    reaccionPierdeMano(oponente.id);
  } else {
    reaccionGanaMano(oponente.id);
    // Si fue por irse al mazo, le agregamos el "uy" sordo al SFX.
    const ultimo = estado.chat[estado.chat.length - 1];
    if (ultimo?.texto?.toLowerCase().includes("mazo")) sonidoMazo();
  }
}

function reaccionarFinDePartida(
  estado: EstadoJuego,
  miId: string,
  ganadorEquipo: number
) {
  if (Math.random() > PROB_REACCION_PARTIDA) return;
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me) return;
  const yoGane = me.equipo === ganadorEquipo;
  // Reacciona alguien del equipo correspondiente (no necesariamente yo).
  const equipo = estado.jugadores.filter((j) =>
    yoGane ? j.equipo === me.equipo : j.equipo !== me.equipo
  );
  const habla = equipo[Math.floor(Math.random() * equipo.length)];
  if (!habla) return;
  if (yoGane) reaccionGanaPartida(habla.id);
  else reaccionPierdePartida(habla.id);
}
