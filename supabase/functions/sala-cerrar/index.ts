// Cierra una sala. Si no empezó, la borra. Si está en curso, la marca
// como terminada. Sólo el creador (asiento 0) puede cerrarla; si llega
// `jugador_id` se valida.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
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
    .select("id, iniciada, terminada, estado")
    .eq("id", body.sala_id)
    .maybeSingle();
  if (errSel) return fail(errSel.message, 500);
  if (!sala) return ok({ ya_no_existe: true });

  if (body.jugador_id) {
    const estado = sala.estado as EstadoJuego;
    const j = estado.jugadores.find((x) => x.id === body.jugador_id);
    if (!j || j.asiento !== 0) return fail("solo_el_creador", 403);
  }

  if (!sala.iniciada) {
    // No empezó: la borramos directamente.
    const { error } = await sb.from("salas").delete().eq("id", body.sala_id);
    if (error) return fail(error.message, 500);
    return ok({ borrada: true });
  }

  if (sala.terminada) return ok({ ya_terminada: true });

  // Estaba en curso: la marcamos como terminada sin ganador.
  const { error } = await sb
    .from("salas")
    .update({
      terminada: true,
      terminada_at: new Date().toISOString()
    })
    .eq("id", body.sala_id);
  if (error) return fail(error.message, 500);
  return ok({ cerrada: true });
});
