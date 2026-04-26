// Servidor Socket.io: maneja salas, jugadores, acciones y bots.
import { nanoid } from "nanoid";
import {
  aplicarAccion,
  crearEstadoInicial,
  iniciarPartida,
  jugadorPorId
} from "../lib/truco/motor";
import type { Accion, EstadoJuego, Jugador } from "../lib/truco/types";
import { decidirAccionBot } from "../lib/truco/ia";
import { PERSONAJES } from "../data/jugadores";
import { generarAliasSala } from "./aliasSala";

interface SalaServer {
  id: string;
  estado: EstadoJuego;
  /** socketId → jugadorId. Permite reconectar. */
  conexiones: Map<string, string>;
  modo: "solo" | "online";
}

const salas = new Map<string, SalaServer>();

/** Devuelve el primer personaje libre (no usado por ningún jugador de la sala). */
function elegirPersonajeLibre(jugadores: Jugador[]): string {
  const usados = new Set(jugadores.map((j) => j.personaje));
  const libre = PERSONAJES.find((p) => !usados.has(p.slug));
  return libre?.slug || PERSONAJES[0].slug;
}

function broadcast(io: any, sala: SalaServer) {
  io.to(`sala:${sala.id}`).emit("estado", sala.estado);
}

function ejecutarBotsSiCorresponde(io: any, sala: SalaServer) {
  // Si hay manoActual y le toca a un bot (o hay envido/truco que un bot debe responder), actuar.
  const { estado } = sala;
  if (estado.ganadorPartida !== null) return;
  const mano = estado.manoActual;
  if (!mano) return;

  let actor: Jugador | undefined;
  if (mano.envidoCantoActivo) {
    actor = estado.jugadores.find(
      (j) => j.equipo === mano.envidoCantoActivo!.equipoQueDebeResponder && j.esBot
    );
  } else if (mano.trucoCantoActivo) {
    actor = estado.jugadores.find(
      (j) => j.equipo === mano.trucoCantoActivo!.equipoQueDebeResponder && j.esBot
    );
  } else {
    actor = estado.jugadores.find((j) => j.id === mano.turnoJugadorId && j.esBot);
  }
  if (!actor) return;

  setTimeout(() => {
    if (sala.estado.ganadorPartida !== null) return;
    const accion = decidirAccionBot(sala.estado, actor!.id);
    aplicarAccion(sala.estado, accion);
    broadcast(io, sala);
    ejecutarBotsSiCorresponde(io, sala);
  }, 700);
}

export function registerSocket(io: any) {
  io.on("connection", (socket: any) => {
    socket.on(
      "crear_sala",
      (
        payload: {
          nombre: string;
          personaje: string;
          modo: "solo" | "online";
          tamanio: 1 | 2 | 4;
          puntosObjetivo: 15 | 30;
        },
        cb: (data: { salaId: string; jugadorId: string }) => void
      ) => {
        // En modo "solo" usamos un id corto; las salas online usan alias
        // truqueros para que sea simpático compartir por WhatsApp.
        const salaId =
          payload.modo === "solo"
            ? `solo-${nanoid(6)}`
            : generarAliasSala(new Set(salas.keys()));
        const jugadorId = nanoid(10);
        const jugador: Jugador = {
          id: jugadorId,
          nombre: payload.nombre || "Primo",
          personaje: payload.personaje || "hugui",
          equipo: 0,
          asiento: 0,
          conectado: true,
          esBot: false
        };

        const jugadores: Jugador[] = [jugador];
        if (payload.modo === "solo") {
          // Completar con bots según tamaño, con personajes que no choquen con el del usuario.
          const total = payload.tamanio;
          for (let i = 1; i < total; i++) {
            const personajeBot = elegirPersonajeLibre(jugadores);
            const meta = PERSONAJES.find((p) => p.slug === personajeBot);
            jugadores.push({
              id: nanoid(10),
              nombre: meta?.nombre || `Bot ${i}`,
              personaje: personajeBot,
              equipo: (i % 2) as 0 | 1,
              asiento: i,
              conectado: true,
              esBot: true
            });
          }
        }
        const modoJuego = payload.tamanio === 4 ? "2v2" : "1v1";
        const estado = crearEstadoInicial({
          salaId,
          jugadores,
          modo: modoJuego,
          puntosObjetivo: payload.puntosObjetivo
        });
        const sala: SalaServer = {
          id: salaId,
          estado,
          conexiones: new Map([[socket.id, jugadorId]]),
          modo: payload.modo
        };
        salas.set(salaId, sala);
        socket.join(`sala:${salaId}`);
        cb({ salaId, jugadorId });

        if (payload.modo === "solo") {
          // En solo arrancamos enseguida.
          iniciarPartida(sala.estado);
          broadcast(io, sala);
          ejecutarBotsSiCorresponde(io, sala);
        } else {
          broadcast(io, sala);
        }
      }
    );

    socket.on(
      "unirse_sala",
      (
        payload: {
          salaId: string;
          nombre: string;
          personaje: string;
          asientoPreferido?: number;
        },
        cb: (data: {
          ok: boolean;
          jugadorId?: string;
          asiento?: number;
          error?: string;
        }) => void
      ) => {
        const sala = salas.get(payload.salaId);
        if (!sala) return cb({ ok: false, error: "Sala no encontrada." });
        if (sala.estado.iniciada)
          return cb({ ok: false, error: "La partida ya empezó." });

        const ocupados = new Set(sala.estado.jugadores.map((j) => j.asiento));
        const total = sala.estado.modo === "2v2" ? 4 : 2;
        let asiento =
          payload.asientoPreferido !== undefined &&
          !ocupados.has(payload.asientoPreferido)
            ? payload.asientoPreferido
            : -1;
        if (asiento < 0) {
          for (let i = 0; i < total; i++) {
            if (!ocupados.has(i)) {
              asiento = i;
              break;
            }
          }
        }
        if (asiento < 0) return cb({ ok: false, error: "Sala llena." });

        const jugadorId = nanoid(10);
        const equipo = (asiento % 2) as 0 | 1;
        const jugador: Jugador = {
          id: jugadorId,
          nombre: payload.nombre || `Primo ${asiento + 1}`,
          personaje: payload.personaje || "hugui",
          equipo,
          asiento,
          conectado: true,
          esBot: false
        };
        sala.estado.jugadores.push(jugador);
        sala.conexiones.set(socket.id, jugadorId);
        socket.join(`sala:${sala.id}`);
        sala.estado.version++;
        cb({ ok: true, jugadorId, asiento });
        broadcast(io, sala);
      }
    );

    socket.on(
      "iniciar_partida",
      (payload: { salaId: string }, cb?: (r: { ok: boolean; error?: string }) => void) => {
        const sala = salas.get(payload.salaId);
        if (!sala) return cb?.({ ok: false, error: "Sala no encontrada." });
        // Si faltan jugadores, completar con bots con personajes libres.
        const total = sala.estado.modo === "2v2" ? 4 : 2;
        while (sala.estado.jugadores.length < total) {
          const asiento = sala.estado.jugadores.length;
          const personajeBot = elegirPersonajeLibre(sala.estado.jugadores);
          const meta = PERSONAJES.find((p) => p.slug === personajeBot);
          sala.estado.jugadores.push({
            id: nanoid(10),
            nombre: meta?.nombre || `Bot ${asiento}`,
            personaje: personajeBot,
            equipo: (asiento % 2) as 0 | 1,
            asiento,
            conectado: true,
            esBot: true
          });
        }
        iniciarPartida(sala.estado);
        broadcast(io, sala);
        ejecutarBotsSiCorresponde(io, sala);
        cb?.({ ok: true });
      }
    );

    socket.on(
      "accion",
      (payload: { salaId: string; jugadorId: string; accion: Accion }) => {
        const sala = salas.get(payload.salaId);
        if (!sala) return;
        const accion = { ...payload.accion, jugadorId: payload.jugadorId };
        const r = aplicarAccion(sala.estado, accion);
        if (!r.ok && r.error) {
          socket.emit("accion_error", r.error);
        }
        broadcast(io, sala);
        ejecutarBotsSiCorresponde(io, sala);
      }
    );

    socket.on(
      "chat",
      (payload: {
        salaId: string;
        jugadorId: string;
        texto?: string;
        reaccion?: string;
      }) => {
        const sala = salas.get(payload.salaId);
        if (!sala) return;
        sala.estado.chat.push({
          id: nanoid(6),
          jugadorId: payload.jugadorId,
          texto: (payload.texto || "").slice(0, 200),
          reaccion: payload.reaccion,
          ts: Date.now()
        });
        if (sala.estado.chat.length > 80) sala.estado.chat.shift();
        sala.estado.version++;
        broadcast(io, sala);
      }
    );

    socket.on("reconectar", (payload: { salaId: string; jugadorId: string }) => {
      const sala = salas.get(payload.salaId);
      if (!sala) return socket.emit("estado_error", "Sala no encontrada.");
      const j = jugadorPorId(sala.estado, payload.jugadorId);
      if (!j) return socket.emit("estado_error", "Jugador no encontrado.");
      sala.conexiones.set(socket.id, payload.jugadorId);
      j.conectado = true;
      socket.join(`sala:${sala.id}`);
      broadcast(io, sala);
    });

    socket.on("disconnect", () => {
      for (const sala of salas.values()) {
        const jugadorId = sala.conexiones.get(socket.id);
        if (jugadorId) {
          const j = jugadorPorId(sala.estado, jugadorId);
          if (j) j.conectado = false;
          sala.conexiones.delete(socket.id);
          sala.estado.version++;
          broadcast(io, sala);
        }
      }
    });
  });
}
