// Inicia una partida online. Modo "humanos only" — falla si la sala no está
// completa. (Los bots solo se usan en modo Solo, que es 100% client-side.)
// Sólo el creador (asiento 0) puede iniciar; si llega `jugador_id` se valida.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { iniciarPartida } from "../_shared/truco/motor.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body?.sala_id) return fail("missing_sala_id");

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);
  if (sala.iniciada) return fail("ya_empezo", 409);

  const estado = sala.estado as EstadoJuego;

  if (body.jugador_id) {
    const j = estado.jugadores.find((x) => x.id === body.jugador_id);
    if (!j || j.asiento !== 0) return fail("solo_el_creador", 403);
  }

  const requeridos = sala.modo === "2v2" ? 4 : 2;
  if (estado.jugadores.length < requeridos) {
    return fail(
      `faltan_jugadores: requeridos ${requeridos}, hay ${estado.jugadores.length}`
    );
  }

  iniciarPartida(estado);

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado, iniciada: true })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ sala_id: body.sala_id });
});
