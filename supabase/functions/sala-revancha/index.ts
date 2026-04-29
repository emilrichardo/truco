// Resetea la sala para una revancha: vuelve los puntos a 0, deja a los
// jugadores actuales sentados y arranca de cero. Sólo el creador puede
// invocarla y sólo si la partida ya terminó.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { crearEstadoInicial, iniciarPartida } from "../_shared/truco/motor.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

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

  // Reset: arrancamos un estado nuevo con los mismos jugadores y config.
  const nuevoEstado = crearEstadoInicial({
    salaId: estadoActual.salaId,
    jugadores: estadoActual.jugadores.map((j) => ({
      ...j,
      conectado: true
    })),
    modo: estadoActual.modo,
    puntosObjetivo: estadoActual.puntosObjetivo,
    conFlor: estadoActual.conFlor
  });
  iniciarPartida(nuevoEstado);

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
