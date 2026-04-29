"use client";
// Sala "local": ejecuta el motor y la IA en el navegador. No toca Socket.io ni
// Supabase. Sirve para Solo (vs máquina) sin necesitar backend.
//
// Persistencia: el estado se guarda en localStorage en cada cambio, así
// si el usuario refresca la página la partida sigue donde estaba.
// Las partidas vs máquina NUNCA se persisten en Supabase (no cuentan
// para el ranking ni para el historial entre primos).
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  aplicarAccion,
  crearEstadoInicial,
  iniciarPartida
} from "@/lib/truco/motor";
import { decidirAccionBot } from "@/lib/truco/ia";
import { calcularEnvido } from "@/lib/truco/cartas";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";
import { PERSONAJES } from "@/data/jugadores";

/** Consulta del bot compañero al humano antes de actuar en baza 1.
 *  Cuando el bot tiene su turno y hay ventana de envido abierta, en vez
 *  de tirar carta directamente le pregunta al humano si quiere cantar. */
export interface ConsultaCompañero {
  tipo: "envido";
  /** ID del bot que está esperando la decisión. */
  botJugadorId: string;
  /** Cuántos puntos de envido tiene el bot — para que el humano decida. */
  envidoBot: number;
}

// Delay antes de que el bot juegue/responda. 700ms se sentía instantáneo
// y no daba tiempo al humano a leer el último canto o pensar antes de
// que el bot tirara la siguiente carta. 1500ms se siente más natural.
const RETARDO_BOT_MS = 1500;
// Pausa entre que se cierra una mano (banner de resumen + última burbuja) y
// el reparto de la siguiente. Sin esto las cartas nuevas aparecen detrás del
// banner y se pisan con la burbuja del último canto.
const RETARDO_PROX_MANO_MS = 3500;
const STORAGE_KEY = "truco_primos_solo_partida";

function elegirPersonajeLibre(jugadores: Jugador[]): string {
  // Elige al azar entre los personajes que todavía no están en uso, así
  // los bots no son siempre los mismos en el mismo orden.
  const usados = new Set(jugadores.map((j) => j.personaje));
  const libres = PERSONAJES.filter((p) => !usados.has(p.slug));
  if (libres.length === 0) return PERSONAJES[0].slug;
  return libres[Math.floor(Math.random() * libres.length)].slug;
}

function nuevoIdLocal(): string {
  return `local-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ConfigSalaLocal {
  miNombre: string;
  miPersonaje: string;
  tamanio: 2 | 4;
  puntosObjetivo: 15 | 30;
  /** Si está presente, fuerza los personajes de los bots en orden de
   *  asiento (bot 1 = botPersonajes[0], bot 2 = botPersonajes[1], etc).
   *  Lo usa el botón "Revancha" para mantener a los mismos oponentes. */
  botPersonajes?: string[];
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

interface SnapshotLocal {
  estado: EstadoJuego;
  miId: string;
  config: ConfigSalaLocal;
}

function leerSnapshot(): SnapshotLocal | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SnapshotLocal;
  } catch {
    return null;
  }
}

function guardarSnapshot(snap: SnapshotLocal) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* quota o JSON inválido — no es fatal */
  }
}

export function borrarSnapshotLocal() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

function mismaConfig(a: ConfigSalaLocal, b: ConfigSalaLocal): boolean {
  return (
    a.tamanio === b.tamanio &&
    a.puntosObjetivo === b.puntosObjetivo &&
    a.miPersonaje === b.miPersonaje
  );
}

export function useSalaLocal(config: ConfigSalaLocal | null) {
  const [{ estado, miId }, dispatch] = useReducer(reducer, {
    estado: null,
    miId: null
  });
  const botTimerRef = useRef<number | null>(null);
  const [consulta, setConsulta] = useState<ConsultaCompañero | null>(null);

  // Inicialización: si hay snapshot guardado con la misma config, lo
  // restauramos. Si no, armamos estado nuevo.
  useEffect(() => {
    if (!config) return;
    if (estado) return;

    const snap = leerSnapshot();
    if (
      snap &&
      mismaConfig(snap.config, config) &&
      snap.estado.ganadorPartida === null
    ) {
      // Reanudar partida en curso.
      dispatch({ tipo: "init", estado: snap.estado, miId: snap.miId });
      return;
    }

    // Nueva partida: si había una guardada terminada o de otra config, la
    // descartamos.
    borrarSnapshotLocal();

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
      // Si nos pasaron botPersonajes (revancha), usamos los slugs en orden
      // de asiento. Sino va al azar entre los libres.
      const slugForzado = config.botPersonajes?.[i - 1];
      const personaje = slugForzado || elegirPersonajeLibre(jugadores);
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
    guardarSnapshot({ estado: inicial, miId: yoId, config });
    dispatch({ tipo: "init", estado: inicial, miId: yoId });
  }, [config, estado]);

  // Persistir cada cambio de estado en localStorage.
  useEffect(() => {
    if (!estado || !miId || !config) return;
    if (estado.ganadorPartida !== null) {
      // Partida terminada: la borramos para no reanudarla la próxima vez.
      borrarSnapshotLocal();
    } else {
      guardarSnapshot({ estado, miId, config });
    }
  }, [estado, miId, config]);

  // Avance automático: dos casos.
  //  1) Mano cerrada en fase "terminada" → tras un delay, disparar reparto
  //     de la siguiente. Esto deja respirar el banner de resumen y la
  //     burbuja del último "quiero/no quiero" antes del reparto.
  //  2) Le toca a un bot (turno o respuesta) → programamos su acción.
  useEffect(() => {
    if (!estado || estado.ganadorPartida !== null) return;
    const mano = estado.manoActual;
    if (!mano) return;

    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }

    if (mano.fase === "terminada") {
      botTimerRef.current = window.setTimeout(() => {
        aplicarAccion(estado, {
          tipo: "iniciar_prox_mano",
          jugadorId: ""
        });
        dispatch({ tipo: "set", estado: { ...estado } });
      }, RETARDO_PROX_MANO_MS);
      return () => {
        if (botTimerRef.current) {
          clearTimeout(botTimerRef.current);
          botTimerRef.current = null;
        }
      };
    }

    const actor = quienActuaSiBot(estado);
    if (!actor) {
      setConsulta(null);
      return;
    }

    // Antes de actuar: ¿el bot debería consultar al humano? Si la ventana
    // de envido está abierta y el compañero es humano, pausamos y le
    // pedimos al humano que decida en lugar de jugar carta a ciegas.
    const c = deberiaConsultar(estado, actor);
    if (c) {
      setConsulta((prev) => {
        if (
          prev &&
          prev.botJugadorId === c.botJugadorId &&
          prev.tipo === c.tipo
        )
          return prev;
        return c;
      });
      return;
    }
    setConsulta(null);

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
    (m: {
      texto?: string;
      reaccion?: string;
      sticker?: string;
      destinatarioId?: string;
    }) => {
      if (!estado || !miId) return;
      const destinatario = m.destinatarioId
        ? estado.jugadores.find((j) => j.id === m.destinatarioId)
        : undefined;
      const yo = estado.jugadores.find((j) => j.id === miId);
      const esCompaniero =
        !!destinatario && !!yo && destinatario.equipo === yo.equipo;
      estado.chat.push({
        id: nuevoIdLocal().slice(6),
        jugadorId: miId,
        destinatarioId: esCompaniero ? destinatario.id : undefined,
        texto: (m.texto || "").slice(0, 200),
        reaccion: m.reaccion,
        sticker: m.sticker,
        directo: esCompaniero,
        ts: Date.now()
      });
      if (estado.chat.length > 80) estado.chat.shift();
      estado.version++;
      dispatch({ tipo: "set", estado: { ...estado } });
    },
    [estado, miId]
  );

  // Resolver consulta: el humano decide qué hace su bot compañero.
  //  - "envido" / "real_envido" / "falta_envido": el bot canta esa apuesta.
  //  - "no": el bot juega su carta normal (decidirAccionBot puede igual
  //    cantar truco si tiene mano excepcional, eso ya es decisión propia
  //    sobre el truco, no sobre el envido).
  const resolverConsulta = useCallback(
    (decision: "envido" | "real_envido" | "falta_envido" | "no") => {
      if (!estado || !consulta) return;
      const botId = consulta.botJugadorId;
      const accion: Accion =
        decision === "no"
          ? decidirAccionBot(estado, botId)
          : { tipo: `cantar_${decision}` as Accion["tipo"], jugadorId: botId };
      const r = aplicarAccion(estado, accion);
      setConsulta(null);
      if (r.ok) dispatch({ tipo: "set", estado: { ...estado } });
    },
    [estado, consulta]
  );

  return {
    estado,
    miId,
    enviarAccion,
    enviarChat,
    consulta,
    resolverConsulta
  };
}

/** Decide si el bot que está por actuar debe pedir input al humano antes
 *  de tirar carta. Hoy aplica sólo a la ventana de envido en baza 1: si el
 *  compañero del bot es humano y todavía no se cantó/resolvió envido,
 *  paramos y mostramos opciones. Más adelante se puede extender al truco. */
function deberiaConsultar(
  estado: EstadoJuego,
  bot: Jugador
): ConsultaCompañero | null {
  if (!bot.esBot) return null;
  const compañeroHumano = estado.jugadores.some(
    (j) => j.equipo === bot.equipo && j.id !== bot.id && !j.esBot
  );
  if (!compañeroHumano) return null;
  const mano = estado.manoActual;
  if (!mano) return null;
  if (mano.turnoJugadorId !== bot.id) return null;
  // Si hay un canto pendiente del rival, el flujo de respuesta ya delega
  // al humano vía quienActuaSiBot — no necesitamos consultar acá.
  if (mano.envidoCantoActivo || mano.trucoCantoActivo) return null;
  // Sólo consultamos si la ventana de envido sigue abierta — sino ya no
  // hay nada que preguntar.
  const envidoCantable =
    mano.bazas.length === 1 &&
    !mano.envidoResuelto &&
    mano.bazas[0].jugadas.length < estado.jugadores.length;
  if (!envidoCantable) return null;
  // En baza 1 antes de jugar, las cartas en mano del bot son sus 3
  // originales. Calculamos el envido que tiene para que el humano decida
  // con info concreta.
  const cartas = mano.cartasPorJugador[bot.id] || [];
  const envidoBot = calcularEnvido(cartas);
  return { tipo: "envido", botJugadorId: bot.id, envidoBot };
}

function quienActuaSiBot(estado: EstadoJuego): Jugador | undefined {
  const mano = estado.manoActual;
  if (!mano) return undefined;

  // Para responder cantos: si el equipo defensor tiene un humano, dejar
  // que el humano decida. El bot pareja NO responde por su compañero —
  // antes los bots agarraban el "no quiero" antes de que el humano
  // pudiera contestar con buen envido.
  if (mano.envidoCantoActivo) {
    const eq = mano.envidoCantoActivo.equipoQueDebeResponder;
    const tieneHumano = estado.jugadores.some(
      (j) => j.equipo === eq && !j.esBot
    );
    if (tieneHumano) return undefined;
    return estado.jugadores.find((j) => j.equipo === eq && j.esBot);
  }
  if (mano.trucoCantoActivo) {
    const eq = mano.trucoCantoActivo.equipoQueDebeResponder;
    const tieneHumano = estado.jugadores.some(
      (j) => j.equipo === eq && !j.esBot
    );
    if (tieneHumano) return undefined;
    return estado.jugadores.find((j) => j.equipo === eq && j.esBot);
  }

  // Turno propio: el bot actúa cuando es SU turno (jugar carta o canto
  // espontáneo). Si es turno del humano, esperamos.
  return estado.jugadores.find((j) => j.id === mano.turnoJugadorId && j.esBot);
}
