// Marca a un jugador humano como bot por inactividad. Cualquier humano
// de la sala puede dispararlo cuando otro humano agotó su ventana de
// turno (default 30s). Tras la conversión, el bot dispatcher del cliente
// toma su turno automáticamente.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  /** Quien dispara la conversión (debe ser humano de la sala). */
  jugador_id: string;
  /** Jugador a convertir en bot. Debe ser humano y estar inactivo. */
  target_jugador_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body?.sala_id || !body?.jugador_id || !body?.target_jugador_id) {
    return fail("missing_fields");
  }

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);
  if (!sala.iniciada) return fail("no_iniciada", 409);
  if (sala.terminada) return fail("ya_terminada", 409);

  const estado = sala.estado as EstadoJuego;

  const dispatcher = estado.jugadores.find((j) => j.id === body.jugador_id);
  if (!dispatcher) return fail("dispatcher_no_esta", 404);
  if (dispatcher.esBot) return fail("solo_humano_marca", 403);

  const target = estado.jugadores.find((j) => j.id === body.target_jugador_id);
  if (!target) return fail("target_no_esta", 404);
  if (target.esBot) {
    // Idempotencia: si ya es bot, no hace falta hacer nada — devolvemos
    // ok para que el cliente que disparó tarde no escupa error.
    return ok({});
  }

  target.esBot = true;
  target.conectado = false;
  estado.chat.push({
    id: crypto.randomUUID().slice(0, 8),
    jugadorId: target.id,
    texto: `${target.nombre} no jugó a tiempo — pasa a bot`,
    ts: Date.now(),
    evento: "sistema"
  });
  if (estado.chat.length > 200) estado.chat.shift();
  estado.version = (estado.version || 0) + 1;

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({});
});
