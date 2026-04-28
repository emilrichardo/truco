// Inicia una partida online. Acepta humanos + bots (los bots los agrega el
// host vía sala-agregar-bot). Solo el creador (asiento 0) puede iniciar.
//
// Si llega `mezclar_equipos: true`, antes de arrancar mezclamos los
// asientos al azar — así los compañeros no quedan determinados por el
// orden de llegada.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { iniciarPartida } from "../_shared/truco/motor.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id?: string;
  mezclar_equipos?: boolean;
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

  // Mezclar asientos antes de iniciar. El creador (asiento 0) puede caer
  // en cualquier asiento; los equipos se recalculan por asiento%2.
  if (body.mezclar_equipos) {
    const asientos = estado.jugadores.map((j) => j.asiento);
    for (let i = asientos.length - 1; i > 0; i--) {
      const k = Math.floor(Math.random() * (i + 1));
      [asientos[i], asientos[k]] = [asientos[k], asientos[i]];
    }
    estado.jugadores.forEach((j, idx) => {
      j.asiento = asientos[idx];
      j.equipo = (asientos[idx] % 2) as 0 | 1;
    });
  }

  iniciarPartida(estado);

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado, iniciada: true })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ sala_id: body.sala_id });
});
