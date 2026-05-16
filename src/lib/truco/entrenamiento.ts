import { PERSONAJES } from "@/data/jugadores";
import { calcularEnvido, nombreCarta } from "@/lib/truco/cartas";
import {
  accionesLegales,
  aplicarAccion,
  crearEstadoInicial,
  iniciarPartida
} from "@/lib/truco/motor";
import type {
  Accion,
  AccionTipo,
  Carta,
  EstadoJuego,
  Jugador
} from "@/lib/truco/types";
import { decidirAccionBot } from "@/lib/truco/ia";

export interface ConfigEntrenamiento {
  tamanio?: 2 | 4;
  puntosObjetivo?: 18 | 30;
}

export interface SnapshotEntrenamiento {
  estado: EstadoJuego;
  actor: Jugador | null;
  legales: AccionTipo[];
  sugerencia: Accion | null;
  textoPlano: string;
  terminado: boolean;
}

const PERSONAJES_BASE = ["marcos", "dani", "lucas", "jorge"];

function clonarEstado<T>(valor: T): T {
  if (typeof structuredClone === "function") return structuredClone(valor);
  return JSON.parse(JSON.stringify(valor)) as T;
}

function crearJugadoresEntrenamiento(tamanio: 2 | 4): Jugador[] {
  return Array.from({ length: tamanio }, (_, index) => {
    const slug =
      PERSONAJES_BASE[index] || PERSONAJES[index]?.slug || `bot-${index + 1}`;
    const meta = PERSONAJES.find((p) => p.slug === slug);
    return {
      id: `train-${index + 1}`,
      nombre: meta?.nombre || `Bot ${index + 1}`,
      personaje: slug,
      equipo: (index % 2) as 0 | 1,
      asiento: index,
      conectado: true,
      esBot: true
    };
  });
}

export function crearEstadoEntrenamiento(
  config: ConfigEntrenamiento = {}
): EstadoJuego {
  const tamanio = config.tamanio === 4 ? 4 : 2;
  const puntosObjetivo = config.puntosObjetivo === 30 ? 30 : 18;
  const estado = crearEstadoInicial({
    salaId: `entrenamiento-${Date.now().toString(36)}`,
    jugadores: crearJugadoresEntrenamiento(tamanio),
    modo: tamanio === 4 ? "2v2" : "1v1",
    puntosObjetivo
  });
  iniciarPartida(estado);
  return estado;
}

function actorActual(estado: EstadoJuego, actorId?: string): Jugador | null {
  if (actorId) {
    return estado.jugadores.find((j) => j.id === actorId) || null;
  }
  const mano = estado.manoActual;
  if (!mano) return null;
  return estado.jugadores.find((j) => j.id === mano.turnoJugadorId) || null;
}

function avanzarEstado(estado: EstadoJuego) {
  let guard = 0;
  while (
    !estado.ganadorPartida &&
    estado.manoActual?.fase === "terminada" &&
    guard < 12
  ) {
    aplicarAccion(estado, { tipo: "iniciar_prox_mano", jugadorId: "" });
    guard += 1;
  }
}

function cartasJugadasDelJugador(
  estado: EstadoJuego,
  jugadorId: string
): Carta[] {
  const mano = estado.manoActual;
  if (!mano) return [];
  return mano.bazas.flatMap((baza) =>
    baza.jugadas
      .filter((jugada) => jugada.jugadorId === jugadorId)
      .map((jugada) => jugada.carta)
  );
}

export function cartasOriginalesDelJugador(
  estado: EstadoJuego,
  jugadorId: string
): Carta[] {
  const mano = estado.manoActual;
  if (!mano) return [];
  return [
    ...(mano.cartasPorJugador[jugadorId] || []),
    ...cartasJugadasDelJugador(estado, jugadorId)
  ];
}

function simboloPalo(palo: Carta["palo"]): string {
  switch (palo) {
    case "espada":
      return "esp";
    case "basto":
      return "bas";
    case "oro":
      return "oro";
    case "copa":
      return "cop";
  }
}

export function cartaComoTexto(carta: Carta): string {
  return `${carta.numero}-${simboloPalo(carta.palo)}`;
}

export function accionComoTexto(accion: Accion | null): string {
  if (!accion) return "sin acción";
  switch (accion.tipo) {
    case "jugar_carta": {
      return accion.cartaId
        ? `jugar ${accion.cartaId}`
        : "jugar carta";
    }
    case "cantar_envido":
      return "cantar envido";
    case "cantar_real_envido":
      return "cantar real envido";
    case "cantar_falta_envido":
      return "cantar falta envido";
    case "responder_quiero":
      return "responder quiero";
    case "responder_no_quiero":
      return "responder no quiero";
    case "cantar_truco":
      return "cantar truco";
    case "cantar_retruco":
      return "cantar retruco";
    case "cantar_vale4":
      return "cantar vale 4";
    case "ir_al_mazo":
    case "mazo":
      return "irse al mazo";
    case "pasar_mano":
      return "pasar mano";
    case "iniciar_prox_mano":
      return "iniciar próxima mano";
  }
}

function renderBazas(estado: EstadoJuego): string[] {
  const mano = estado.manoActual;
  if (!mano) return ["Sin mano activa."];
  return mano.bazas.map((baza, index) => {
    const jugadas = baza.jugadas.length
      ? baza.jugadas
          .map((jugada) => {
            const jugador = estado.jugadores.find((j) => j.id === jugada.jugadorId);
            const carta = jugada.tapada ? "tapada" : nombreCarta(jugada.carta);
            return `${jugador?.nombre || jugada.jugadorId}: ${carta}`;
          })
          .join(" | ")
      : "sin cartas";
    return `Baza ${index + 1}: ${jugadas}`;
  });
}

export function renderTextoPlanoEntrenamiento(
  estado: EstadoJuego,
  actor: Jugador | null,
  legales: AccionTipo[],
  sugerencia: Accion | null
): string {
  const mano = estado.manoActual;
  if (!mano) return "No hay mano activa.";

  const lineas = [
    `Sala: ${estado.salaId}`,
    `Modo: ${estado.modo} | Mano: ${mano.numero} | Puntos: E1 ${estado.puntos[0]} - E2 ${estado.puntos[1]}`,
    `Turno motor: ${
      estado.jugadores.find((j) => j.id === mano.turnoJugadorId)?.nombre ||
      mano.turnoJugadorId
    }`,
    mano.envidoCantoActivo
      ? `Envido pendiente: ${mano.envidoCantoActivo.cadena.join(" -> ")}`
      : "Envido pendiente: no",
    mano.trucoCantoActivo
      ? `Truco pendiente: ${mano.trucoCantoActivo.nivel}`
      : `Truco cantado: ${mano.trucoEstado}`,
    "",
    ...renderBazas(estado),
    "",
    ...estado.jugadores.map((jugador) => {
      const originales = cartasOriginalesDelJugador(estado, jugador.id);
      const restantes = new Set(
        (mano.cartasPorJugador[jugador.id] || []).map((c) => c.id)
      );
      const jugadas = cartasJugadasDelJugador(estado, jugador.id);
      const tantos = calcularEnvido(originales);
      const manoTexto = originales
        .map((carta) =>
          restantes.has(carta.id)
            ? cartaComoTexto(carta)
            : `${cartaComoTexto(carta)}*`
        )
        .join(" ");
      const yaJugo = jugadas.map((c) => cartaComoTexto(c)).join(" ");
      return `${actor?.id === jugador.id ? ">" : " "} ${jugador.nombre} [E${
        jugador.equipo + 1
      }] tantos=${tantos} mano=${manoTexto || "-"} jugadas=${yaJugo || "-"}`;
    }),
    "",
    `Actor: ${actor ? `${actor.nombre} (${actor.id})` : "sin actor"}`,
    `Legales: ${legales.join(", ") || "ninguna"}`,
    `Sugerencia: ${accionComoTexto(sugerencia)}`
  ];
  return lineas.join("\n");
}

export function crearSnapshotEntrenamiento(
  estado: EstadoJuego,
  actorId?: string
): SnapshotEntrenamiento {
  const base = clonarEstado(estado);
  avanzarEstado(base);
  const actor = actorActual(base, actorId);
  const legales = actor ? accionesLegales(base, actor.id) : [];
  const sugerencia =
    actor && legales.length > 0 ? decidirAccionBot(base, actor.id) : null;
  return {
    estado: base,
    actor,
    legales,
    sugerencia,
    textoPlano: renderTextoPlanoEntrenamiento(base, actor, legales, sugerencia),
    terminado: base.ganadorPartida !== null
  };
}

export function aplicarDecisionEntrenamiento(
  estado: EstadoJuego,
  accion: Accion,
  actorId?: string
): SnapshotEntrenamiento {
  const base = clonarEstado(estado);
  const actor = actorActual(base, actorId);
  const accionFinal: Accion = {
    ...accion,
    jugadorId: accion.jugadorId || actor?.id || ""
  };
  const resultado = aplicarAccion(base, accionFinal);
  if (!resultado.ok) {
    throw new Error(resultado.error || "No se pudo aplicar la acción.");
  }
  return crearSnapshotEntrenamiento(base);
}
