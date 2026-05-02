// Reconecta a un jugador que está marcado como bot (porque se desconectó
// o agotó su turno) y le devuelve el control. No se valida más que la
// existencia del jugador en la sala — el cliente envía su jugadorId
// guardado en localStorage.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
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
  if (sala.terminada) return fail("ya_terminada", 409);

  const estado = sala.estado as EstadoJuego;
  const jugador = estado.jugadores.find((j) => j.id === body.jugador_id);
  if (!jugador) return fail("jugador_no_esta", 404);

  // Si ya está conectado y no es bot, no hace falta tocar nada.
  if (jugador.conectado && !jugador.esBot) return ok({ sin_cambios: true });

  const eraBot = jugador.esBot;
  jugador.esBot = false;
  jugador.conectado = true;

  if (eraBot) {
    estado.chat.push({
      id: crypto.randomUUID().slice(0, 8),
      jugadorId: jugador.id,
      texto: `${jugador.nombre} volvió y retomó el control`,
      ts: Date.now(),
      evento: "sistema"
    });
    if (estado.chat.length > 200) estado.chat.shift();
  }
  estado.version = (estado.version || 0) + 1;

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({});
});
