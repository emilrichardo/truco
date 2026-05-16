// Resetea la sala para una revancha: vuelve los puntos a 0, deja a los
// jugadores actuales sentados y arranca de cero. Sólo el creador puede
// invocarla y sólo si la partida ya terminó.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { crearEstadoInicial, iniciarPartida } from "../_shared/truco/motor.ts";
import type { Espectador, EstadoJuego, Jugador } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body?.sala_id || !body?.jugador_id) return fail("missing_fields");

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);

  const estadoActual = sala.estado as EstadoJuego;
  const dispatcher = estadoActual.jugadores.find(
    (j) => j.id === body.jugador_id
  );
  if (!dispatcher || dispatcher.asiento !== 0) {
    return fail("solo_el_creador", 403);
  }
  if (estadoActual.ganadorPartida === null) {
    return fail("partida_no_termino", 409);
  }

  const { jugadores, promovidos, colaRestante, espectadoresRestantes } =
    jugadoresConColaPromovida(estadoActual);

  // Reset: arrancamos un estado nuevo con los jugadores actuales y, si
  // había cola, los espectadores promovidos reemplazando bots.
  const nuevoEstado = crearEstadoInicial({
    salaId: estadoActual.salaId,
    jugadores,
    modo: estadoActual.modo,
    puntosObjetivo: estadoActual.puntosObjetivo
  });
  nuevoEstado.espectadores = espectadoresRestantes;
  nuevoEstado.colaEspera = colaRestante;
  iniciarPartida(nuevoEstado);
  for (const espectador of promovidos) {
    nuevoEstado.chat.push({
      id: crypto.randomUUID().slice(0, 8),
      jugadorId: espectador.id,
      texto: `${espectador.nombre} entra a jugar desde la cola`,
      ts: Date.now(),
      evento: "sistema"
    });
  }
  if (nuevoEstado.chat.length > 200) {
    nuevoEstado.chat = nuevoEstado.chat.slice(-200);
  }

  const { error: errUpd } = await sb
    .from("salas")
    .update({
      estado: nuevoEstado,
      iniciada: true,
      terminada: false,
      ganador_equipo: null,
      terminada_at: null
    })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ sala_id: body.sala_id });
});

function jugadoresConColaPromovida(estado: EstadoJuego): {
  jugadores: Jugador[];
  promovidos: Espectador[];
  colaRestante: Espectador[];
  espectadoresRestantes: Espectador[];
} {
  const cola = [...(estado.colaEspera ?? [])].sort((a, b) => a.ts - b.ts);
  const asientosBot = estado.jugadores
    .filter((j) => j.esBot)
    .sort((a, b) => a.asiento - b.asiento);
  const promovidos = cola.slice(0, asientosBot.length);
  const reemplazos = new Map<number, Espectador>();
  promovidos.forEach((e, i) => {
    const asiento = asientosBot[i]?.asiento;
    if (asiento !== undefined) reemplazos.set(asiento, e);
  });

  const jugadores = estado.jugadores.map((j) => {
    const entra = reemplazos.get(j.asiento);
    if (!entra) {
      return {
        ...j,
        conectado: true
      };
    }
    return {
      id: entra.id,
      perfilId: entra.perfilId,
      nombre: entra.nombre,
      personaje: entra.personaje,
      equipo: (j.asiento % 2) as 0 | 1,
      asiento: j.asiento,
      conectado: true,
      esBot: false
    };
  });

  const idsPromovidos = new Set(promovidos.map((e) => e.id));
  return {
    jugadores,
    promovidos,
    colaRestante: cola.filter((e) => !idsPromovidos.has(e.id)),
    espectadoresRestantes: (estado.espectadores ?? []).filter(
      (e) => !idsPromovidos.has(e.id)
    )
  };
}
