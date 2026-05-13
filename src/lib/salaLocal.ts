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
import type { Accion, Carta, EstadoJuego, Jugador } from "@/lib/truco/types";
import { PERSONAJES } from "@/data/jugadores";
import {
  deberiaConsultar,
  accionDesdeConsulta,
  consultaTrucoSugerida,
  type ConsultaCompañero
} from "@/lib/consultaCompañero";

export type { ConsultaCompañero };

// Delay antes de que el bot juegue/responda. 700ms se sentía instantáneo
// y no daba tiempo al humano a leer el último canto o pensar antes de
// que el bot tirara la siguiente carta. 1500ms se siente más natural.
const RETARDO_BOT_MS = 1500;
const IA_PENSANDO_TTL_MS = 15_000;
// Pausa entre que se cierra una mano (banner de resumen + última burbuja) y
// el reparto de la siguiente. Sin esto las cartas nuevas aparecen detrás del
// banner y se pisan con la burbuja del último canto.
const RETARDO_PROX_MANO_MS = 3500;
const STORAGE_KEY = "truco_primos_solo_partida";

function limpiarIAPensando(estado: EstadoJuego, now = Date.now()) {
  if (!estado.iaPensando?.length) return false;
  const ids = new Set(estado.jugadores.map((j) => j.id));
  const next = estado.iaPensando.filter(
    (p) => ids.has(p.jugadorId) && now - p.desde < IA_PENSANDO_TTL_MS
  );
  const cambio = next.length !== estado.iaPensando.length;
  estado.iaPensando = next;
  return cambio;
}

function estaPensandoIA(estado: EstadoJuego, jugadorId: string): boolean {
  limpiarIAPensando(estado);
  return !!estado.iaPensando?.some((p) => p.jugadorId === jugadorId);
}

function marcarPensandoIA(
  estado: EstadoJuego,
  jugadorId: string,
  encendido: boolean
) {
  limpiarIAPensando(estado);
  const actual = estado.iaPensando || [];
  if (encendido) {
    if (actual.some((p) => p.jugadorId === jugadorId)) return false;
    estado.iaPensando = [
      ...actual,
      {
        jugadorId,
        desde: Date.now(),
        requestId: `local-${Math.random().toString(36).slice(2, 8)}`
      }
    ];
  } else {
    estado.iaPensando = actual.filter((p) => p.jugadorId !== jugadorId);
  }
  estado.version++;
  return true;
}

function charlaLocalBot(
  estado: EstadoJuego,
  jugador: Jugador,
  accion: Accion
) {
  const chance =
    accion.tipo === "jugar_carta"
      ? 0.34
      : accion.tipo.startsWith("cantar")
        ? 0.78
        : 0.62;
  if (Math.random() > chance) return;

  const mano = estado.manoActual;
  const cartas = mano ? cartasOriginalesDelJugador(mano, jugador.id) : [];
  const tantos = calcularEnvido(cartas);
  const fuerza = cartas.reduce((acc, c) => acc + jerarquia(c), 0);
  const vieneMintiendo =
    (accion.tipo.includes("envido") && tantos < 26) ||
    (accion.tipo.includes("truco") && fuerza < 18);

  const textos: Record<string, string[]> = {
    jugar_carta: [
      "A ver si la seguís ahora 😎",
      "Te vi venir, primo.",
      "Esta venía pidiendo mesa.",
      "Jugá tranquilo, que igual te estoy leyendo 👀"
    ],
    cantar_envido: [
      "Envido. Cara de treinta tengo 😇",
      "Te lo digo con cara seria: envido.",
      "No arrugues ahora."
    ],
    cantar_real_envido: [
      "Real envido, que se prenda la mesa 🔥",
      "Vamos a ver esos tantos.",
      "Real envido. Contá bien, boludo."
    ],
    cantar_falta_envido: [
      "Falta envido. Ahora sí se juega 💀",
      "Te dejo pensando, chango.",
      "Falta envido. A ver si sos tan guapo."
    ],
    cantar_truco: [
      "Truco, pecho frío 😎",
      "Te apuro un poquito.",
      "Truco. Tengo más cara que cartas, pero alcanza."
    ],
    cantar_retruco: [
      "Retruco. No era gratis.",
      "Dale, mostrá carácter.",
      "Retruco, no te me escondás ahora 🤥"
    ],
    cantar_vale4: [
      "Vale cuatro. Todo o nada.",
      "Ahora sí: sin llorar.",
      "Vale cuatro, fantasma. Firmá acá."
    ],
    responder_quiero: [
      "Quiero. Me gusta el lío 💪",
      "Dale, quiero.",
      "Quiero. Esa actuación no me asusta."
    ],
    responder_no_quiero: [
      "No quiero. Guardá ese chamuyo.",
      "No compro esa cara.",
      "No quiero. Esta no te la financio."
    ],
    ir_al_mazo: [
      "Al mazo, pero te estoy leyendo.",
      "Me retiro con dignidad dudosa.",
      "Al mazo. Ganaste esta, no te agrandés."
    ]
  };
  const bluff = [
    "Tengo una mano hermosa, creeme 🤥",
    "Me sobra paño. Vos sabrás.",
    "Esta viene cargada, primo."
  ];
  const opciones = vieneMintiendo
    ? [...(textos[accion.tipo] || []), ...bluff]
    : textos[accion.tipo] || ["Mirá que estoy pensando."];
  const texto = opciones[Math.floor(Math.random() * opciones.length)];
  const reacciones = ["😂", "😎", "💪", "🤥", "👀", "😤", "🤬"];
  const reaccion =
    Math.random() < 0.28
      ? reacciones[Math.floor(Math.random() * reacciones.length)]
      : undefined;
  estado.chat.push({
    id: nuevoIdLocal().slice(6),
    jugadorId: jugador.id,
    texto,
    reaccion,
    ts: Date.now(),
    ia: true,
    emocion: accion.tipo.includes("no_quiero") ? "enojo" : "picardia"
  });
  if (estado.chat.length > 80) estado.chat.shift();
  estado.version++;
}

function cartasOriginalesDelJugador(
  mano: NonNullable<EstadoJuego["manoActual"]>,
  jugadorId: string
): Carta[] {
  const tiradas = mano.bazas.flatMap((b) =>
    b.jugadas.filter((j) => j.jugadorId === jugadorId).map((j) => j.carta)
  );
  return [...(mano.cartasPorJugador[jugadorId] || []), ...tiradas];
}

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
  // Suprime nuevas consultas del mismo bot durante una ventana corta
  // después de que el humano resolvió una. Sin esto, justo cuando se
  // selecciona una carta para el bot puede colarse otra consulta antes
  // de que la jugada se procese y la ronda continúe.
  const consultaSuprimidaRef = useRef<{ botId: string; hasta: number } | null>(
    null
  );

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

    // Antes de actuar: ¿el bot debería consultar al humano?
    //   - Envido (baza 1, ventana abierta, bot es pie): consulta envido.
    //   - Jugar (baza 2/3 cuando el bot abre la baza): consulta jugá/vení.
    // Primero miramos si la mano pide truco: esa pregunta tiene prioridad
    // sobre "Jugá/Vení", porque si no el humano no llega a autorizar el canto.
    let consultaFinal: ConsultaCompañero | null = consultaTrucoSugerida(
      estado,
      actor
    );
    const c = consultaFinal ? null : deberiaConsultar(estado, actor);
    if (!consultaFinal && c) {
      consultaFinal = c;
      if (c.tipo === "jugar") {
        const accionPreview = decidirAccionBot(estado, actor.id);
        if (accionPreview.tipo !== "jugar_carta") consultaFinal = null;
      }
    }
    // Si el humano acaba de resolver una consulta para este bot,
    // dejamos pasar el dispatch normal en vez de saltar otra consulta.
    const sup = consultaSuprimidaRef.current;
    if (
      consultaFinal &&
      sup &&
      sup.botId === actor.id &&
      Date.now() < sup.hasta
    ) {
      consultaFinal = null;
    }

    if (consultaFinal) {
      if (estaPensandoIA(estado, actor.id)) {
        marcarPensandoIA(estado, actor.id, false);
        dispatch({ tipo: "set", estado: { ...estado } });
      }
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
    setConsulta(null);

    if (!estaPensandoIA(estado, actor.id)) {
      marcarPensandoIA(estado, actor.id, true);
      dispatch({ tipo: "set", estado: { ...estado } });
      return;
    }

    botTimerRef.current = window.setTimeout(() => {
      // Mutamos una copia: aplicarAccion mutará in-place, así que reusamos
      // referencia, pero hacemos shallow para forzar render.
      const accion = decidirAccionBot(estado, actor.id);
      const r = aplicarAccion(estado, accion);
      marcarPensandoIA(estado, actor.id, false);
      if (r.ok) charlaLocalBot(estado, actor, accion);
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

  // Mantenemos el estado vigente en un ref. enviarChat es típicamente
  // llamado desde un async (await leerAudio), y para entonces el estado
  // capturado en el closure quedó stale — si lo despachábamos, le
  // sobreescribíamos el envido/truco recién cantado. Con el ref leemos
  // siempre el estado actual al momento del push.
  // OJO: actualizamos durante el render, no en useEffect — los effects
  // corren después del commit, y la async chain podía leer el ref VIEJO
  // entre el commit y el effect. Con asignación durante render, el ref
  // refleja la última estado tan pronto como React la procesa.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const enviarChat = useCallback(
    (m: {
      texto?: string;
      reaccion?: string;
      sticker?: string;
      destinatarioId?: string;
      audioCantoDataUrl?: string;
      audioCantoTipo?: string;
    }) => {
      const e = estadoRef.current;
      if (!e || !miId) return;
      const destinatario = m.destinatarioId
        ? e.jugadores.find((j) => j.id === m.destinatarioId)
        : undefined;
      const yo = e.jugadores.find((j) => j.id === miId);
      const esCompaniero =
        !!destinatario && !!yo && destinatario.equipo === yo.equipo;
      e.chat.push({
        id: nuevoIdLocal().slice(6),
        jugadorId: miId,
        destinatarioId: esCompaniero ? destinatario.id : undefined,
        texto: (m.texto || "").slice(0, 200),
        reaccion: m.reaccion,
        sticker: m.sticker,
        directo: esCompaniero,
        ts: Date.now(),
        audioCantoDataUrl: m.audioCantoDataUrl,
        audioCantoTipo: m.audioCantoTipo
      });
      if (e.chat.length > 80) e.chat.shift();
      e.version++;
      dispatch({ tipo: "set", estado: { ...e } });
    },
    [miId]
  );

  // Resolver consulta: el humano decide qué hace su bot compañero.
  // La lógica de qué Accion construir vive en accionDesdeConsulta
  // (módulo compartido con la sala online).
  const resolverConsulta = useCallback(
    (
      decision: import("@/lib/consultaCompañero").DecisionConsulta,
      cartaId?: string
    ) => {
      if (!estado || !consulta) return;
      const accion = accionDesdeConsulta(
        estado,
        consulta.botJugadorId,
        decision,
        consulta,
        cartaId
      );
      const decisionDeJugada =
        decision === "juga" ||
        decision === "veni" ||
        decision === "tapar" ||
        decision === "pasar" ||
        decision === "carta_especifica";
      if (decisionDeJugada) {
        consultaSuprimidaRef.current = {
          botId: consulta.botJugadorId,
          hasta: Date.now() + 3000
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

export function quienActuaSiBot(estado: EstadoJuego): Jugador | undefined {
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
