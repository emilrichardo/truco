// Agrega un mensaje al chat de la sala. Limita a 200 mensajes en el estado
// (los más viejos se descartan, igual que en el server original).
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id: string;
  texto?: string;
  reaccion?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body || !body.sala_id || !body.jugador_id) return fail("missing_fields");
  if (!body.texto && !body.reaccion) return fail("vacio");

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);

  const estado = sala.estado as EstadoJuego;
  estado.chat.push({
    id: crypto.randomUUID().slice(0, 8),
    jugadorId: body.jugador_id,
    texto: (body.texto || "").slice(0, 200),
    reaccion: body.reaccion,
    ts: Date.now()
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
