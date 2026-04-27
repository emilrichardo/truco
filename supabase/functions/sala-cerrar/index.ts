// Cierra una sala. Si no empezó, la borra. Si está en curso, la marca
// como terminada. La llama el creador desde la pantalla de espera o
// cualquier jugador desde adentro.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";

interface Payload {
  sala_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body?.sala_id) return fail("missing_sala_id");

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("id, iniciada, terminada")
    .eq("id", body.sala_id)
    .maybeSingle();
  if (errSel) return fail(errSel.message, 500);
  if (!sala) return ok({ ya_no_existe: true });

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
