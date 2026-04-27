"use client";
// Sala "local": ejecuta el motor y la IA en el navegador. No toca Socket.io ni
// Supabase. Sirve para Solo (vs máquina) sin necesitar backend.
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  aplicarAccion,
  crearEstadoInicial,
  iniciarPartida
} from "@/lib/truco/motor";
import { decidirAccionBot } from "@/lib/truco/ia";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";
import { PERSONAJES } from "@/data/jugadores";

const RETARDO_BOT_MS = 700;

function elegirPersonajeLibre(jugadores: Jugador[]): string {
  const usados = new Set(jugadores.map((j) => j.personaje));
  const libre = PERSONAJES.find((p) => !usados.has(p.slug));
  return libre?.slug || PERSONAJES[0].slug;
}

function nuevoIdLocal(): string {
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ConfigSalaLocal {
  miNombre: string;
  miPersonaje: string;
  tamanio: 2 | 4;
  puntosObjetivo: 15 | 30;
}

interface State {
  estado: EstadoJuego | null;
  miId: string | null;
}

type Action =
  | { tipo: "init"; estado: EstadoJuego; miId: string }
  | { tipo: "set"; estado: EstadoJuego };

function reducer(s: State, a: Action): State {
  switch (a.tipo) {
    case "init":
      return { estado: a.estado, miId: a.miId };
    case "set":
      return { ...s, estado: a.estado };
  }
}

export function useSalaLocal(config: ConfigSalaLocal | null) {
  const [{ estado, miId }, dispatch] = useReducer(reducer, {
    estado: null,
    miId: null
  });
  const botTimerRef = useRef<number | null>(null);

  // Inicialización: arma estado, completa con bots, arranca partida.
  useEffect(() => {
    if (!config) return;
    if (estado) return;
    const yoId = nuevoIdLocal();
    const jugadores: Jugador[] = [
      {
        id: yoId,
        nombre: config.miNombre,
        personaje: config.miPersonaje,
        equipo: 0,
        asiento: 0,
        conectado: true,
        esBot: false
      }
    ];
    for (let i = 1; i < config.tamanio; i++) {
      const personaje = elegirPersonajeLibre(jugadores);
      const meta = PERSONAJES.find((p) => p.slug === personaje);
      jugadores.push({
        id: nuevoIdLocal(),
        nombre: meta?.nombre || `Bot ${i}`,
        personaje,
        equipo: (i % 2) as 0 | 1,
        asiento: i,
        conectado: true,
        esBot: true
      });
    }
    const inicial = crearEstadoInicial({
      salaId: `solo-${nuevoIdLocal().slice(6)}`,
      jugadores,
      modo: config.tamanio === 4 ? "2v2" : "1v1",
      puntosObjetivo: config.puntosObjetivo
    });
    iniciarPartida(inicial);
    dispatch({ tipo: "init", estado: inicial, miId: yoId });
  }, [config, estado]);

  // Avance automático de bots: cuando el turno (o respuesta requerida) cae
  // en un bot, programamos su acción tras un retardo y volvemos a evaluar.
  useEffect(() => {
    if (!estado || estado.ganadorPartida !== null) return;
    const mano = estado.manoActual;
    if (!mano) return;

    const actor = quienActuaSiBot(estado);
    if (!actor) return;

    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }
    botTimerRef.current = window.setTimeout(() => {
      // Mutamos una copia: aplicarAccion mutará in-place, así que reusamos
      // referencia, pero hacemos shallow para forzar render.
      const accion = decidirAccionBot(estado, actor.id);
      aplicarAccion(estado, accion);
      dispatch({ tipo: "set", estado: { ...estado } });
    }, RETARDO_BOT_MS);

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  }, [estado]);

  const enviarAccion = useCallback(
    (a: Accion) => {
      if (!estado || !miId) return;
      const accion: Accion = { ...a, jugadorId: miId };
      const r = aplicarAccion(estado, accion);
      if (!r.ok) return; // ignorar acciones inválidas en local
      dispatch({ tipo: "set", estado: { ...estado } });
    },
    [estado, miId]
  );

  const enviarChat = useCallback(
    (m: { texto?: string; reaccion?: string }) => {
      if (!estado || !miId) return;
      estado.chat.push({
        id: nuevoIdLocal().slice(6),
        jugadorId: miId,
        texto: (m.texto || "").slice(0, 200),
        reaccion: m.reaccion,
        ts: Date.now()
      });
      if (estado.chat.length > 80) estado.chat.shift();
      estado.version++;
      dispatch({ tipo: "set", estado: { ...estado } });
    },
    [estado, miId]
  );

  return { estado, miId, enviarAccion, enviarChat };
}

function quienActuaSiBot(estado: EstadoJuego): Jugador | undefined {
  const mano = estado.manoActual;
  if (!mano) return undefined;
  if (mano.envidoCantoActivo) {
    return estado.jugadores.find(
      (j) => j.equipo === mano.envidoCantoActivo!.equipoQueDebeResponder && j.esBot
    );
  }
  if (mano.trucoCantoActivo) {
    return estado.jugadores.find(
      (j) => j.equipo === mano.trucoCantoActivo!.equipoQueDebeResponder && j.esBot
    );
  }
  return estado.jugadores.find((j) => j.id === mano.turnoJugadorId && j.esBot);
}
