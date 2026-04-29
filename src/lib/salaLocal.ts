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
import { calcularEnvido, jerarquia } from "@/lib/truco/cartas";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";
import { PERSONAJES } from "@/data/jugadores";

/** Consulta del bot compañero al humano antes de tirar carta.
 *  - tipo "envido": baza 1 con envido cantable. El bot revela su envido
 *    y deja que el humano decida si cantar o no.
 *  - tipo "jugar": baza 2 o 3 cuando el bot abre la baza. No se canta
 *    nada — el humano elige si tira la carta más alta (jugá) o la más
 *    baja (vení). Útil para coordinar estrategia con el compañero. */
export type ConsultaCompañero =
  | {
      tipo: "envido";
      botJugadorId: string;
      envidoBot: number;
    }
  | {
      tipo: "jugar";
      botJugadorId: string;
    };

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
  puntosObjetivo: 18 | 30;
  /** Si la partida se juega con flor (3 cartas mismo palo = +3 pts). */
  conFlor: boolean;
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
    a.conFlor === b.conFlor &&
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
      puntosObjetivo: config.puntosObjetivo,
      conFlor: config.conFlor
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

    // Antes de actuar: ¿el bot debería consultar al humano?
    //   - Envido (baza 1, ventana abierta, bot es pie): consulta envido.
    //   - Jugar (baza 2/3 cuando el bot abre la baza): consulta jugá/vení.
    // Para la consulta de "jugar" calculamos la acción que el bot
    // tomaría — si decide cantar truco / retruco, lo dejamos hacer
    // y no consultamos sobre la carta.
    const c = deberiaConsultar(estado, actor);
    if (c) {
      let consultaFinal: ConsultaCompañero | null = c;
      if (c.tipo === "jugar") {
        const accionPreview = decidirAccionBot(estado, actor.id);
        if (accionPreview.tipo !== "jugar_carta") {
          consultaFinal = null;
        }
      }
      if (consultaFinal) {
        setConsulta((prev) => {
          if (
            prev &&
            prev.botJugadorId === consultaFinal!.botJugadorId &&
            prev.tipo === consultaFinal!.tipo
          )
            return prev;
          return consultaFinal;
        });
        return;
      }
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
  //  - "juga": el bot tira la carta más alta (matar). Pensado para
  //    cuando el humano quiere asegurar la baza con la carta brava.
  //  - "veni": el bot tira la carta más baja (venir con poco). Útil
  //    para ahorrar cartas grandes para más adelante.
  const resolverConsulta = useCallback(
    (
      decision:
        | "envido"
        | "real_envido"
        | "falta_envido"
        | "juga"
        | "veni"
    ) => {
      if (!estado || !consulta) return;
      const botId = consulta.botJugadorId;
      let accion: Accion;
      if (decision === "juga" || decision === "veni") {
        const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
        if (cartas.length === 0) {
          // Caso raro: el bot ya jugó todas. Caemos al decisor de la IA.
          accion = decidirAccionBot(estado, botId);
        } else {
          const ordenadas = [...cartas].sort(
            (a, b) => jerarquia(a) - jerarquia(b)
          );
          const elegida =
            decision === "juga" ? ordenadas[ordenadas.length - 1] : ordenadas[0];
          accion = {
            tipo: "jugar_carta",
            jugadorId: botId,
            cartaId: elegida.id
          };
        }
      } else {
        accion = {
          tipo: `cantar_${decision}` as Accion["tipo"],
          jugadorId: botId
        };
      }
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
 *  de tirar carta. Aplica sólo cuando el bot es PIE de su equipo (último
 *  en jugar en orden de juego) y su compañero es humano. La regla
 *  trucera: el pie es el que mira lo que jugaron todos antes y decide
 *  con más info. Si el humano es pie no hace falta consultar — ya tiene
 *  el control en su panel. */
function deberiaConsultar(
  estado: EstadoJuego,
  bot: Jugador
): ConsultaCompañero | null {
  if (!bot.esBot) return null;
  const compañeros = estado.jugadores.filter(
    (j) => j.equipo === bot.equipo && j.id !== bot.id
  );
  const compañeroHumano = compañeros.some((j) => !j.esBot);
  if (!compañeroHumano) return null;
  const mano = estado.manoActual;
  if (!mano) return null;
  if (mano.turnoJugadorId !== bot.id) return null;
  if (mano.envidoCantoActivo || mano.trucoCantoActivo) return null;

  // El bot tiene que ser PIE del equipo: en orden de juego (distancia
  // anti-horaria desde el mano de la mano) está más lejos que sus
  // compañeros. Si el bot no es pie, dejamos que juegue normalmente —
  // la canilla la tiene el humano que sí es pie.
  const manoAsiento = estado.jugadores.find(
    (j) => j.id === mano.manoJugadorId
  )?.asiento;
  if (manoAsiento === undefined) return null;
  const n = estado.jugadores.length;
  const distanciaDeJuego = (asiento: number) =>
    (asiento - manoAsiento + n) % n;
  const miDist = distanciaDeJuego(bot.asiento);
  const botEsPie = compañeros.every(
    (c) => distanciaDeJuego(c.asiento) < miDist
  );
  if (!botEsPie) return null;

  // Caso A: consulta de envido en baza 1 (bot es pie y ventana abierta).
  //          Si hay flor pendiente la salteamos — la flor manda.
  //          Si el truco ya fue aceptado (trucoEstado != "ninguno") el
  //          envido ya no se puede cantar — saltamos también.
  const enBaza1 = mano.bazas.length === 1;
  if (enBaza1) {
    let alguienConFlor = false;
    if (estado.conFlor) {
      if (mano.florResuelta || mano.florCantores.length > 0) return null;
      alguienConFlor = estado.jugadores.some((j) => {
        const enMano = mano.cartasPorJugador[j.id] || [];
        return (
          enMano.length === 3 && enMano.every((c) => c.palo === enMano[0].palo)
        );
      });
    }
    if (alguienConFlor) return null;
    const envidoCantable =
      !mano.envidoResuelto &&
      mano.trucoEstado === "ninguno" &&
      mano.bazas[0].jugadas.length < estado.jugadores.length;
    if (envidoCantable) {
      const cartas = mano.cartasPorJugador[bot.id] || [];
      const envidoBot = calcularEnvido(cartas);
      return { tipo: "envido", botJugadorId: bot.id, envidoBot };
    }
    // Si no hay envido cantable pero la baza sigue (alguien todavía no
    // tiró), caemos a la consulta de "jugar" más abajo si el bot abre
    // la próxima jugada.
  }

  // Caso B: consulta de jugá/vení en baza 2 o 3 cuando el bot ABRE la
  // baza (todavía no tiró nadie). Acá la decisión "matar con la brava o
  // venir con poco" se la pasamos al humano para que coordine. Si la
  // baza ya tiene jugadas, no consultamos — el bot ya tiene info y
  // elige por su cuenta.
  const baza = mano.bazas[mano.bazas.length - 1];
  if (baza.jugadas.length === 0) {
    return { tipo: "jugar", botJugadorId: bot.id };
  }
  return null;
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
