// Anota a un espectador en la cola de espera de una sala en vivo.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  espectador_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body?.sala_id || !body?.espectador_id) return fail("missing_fields");

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);
  if (sala.terminada) return fail("ya_terminada", 409);

  const estado = sala.estado as EstadoJuego;
  estado.espectadores = estado.espectadores ?? [];
  estado.colaEspera = estado.colaEspera ?? [];

  const espectador = estado.espectadores.find((e) => e.id === body.espectador_id);
  if (!espectador) return fail("espectador_no_esta", 404);

  const yaEsta = estado.colaEspera.some((e) => e.id === espectador.id);
  if (!yaEsta) {
    estado.colaEspera.push({ ...espectador, ts: Date.now() });
    estado.chat.push({
      id: crypto.randomUUID().slice(0, 8),
      jugadorId: espectador.id,
      texto: `${espectador.nombre} se anotó en la cola de espera`,
      ts: Date.now(),
      evento: "sistema"
    });
    if (estado.chat.length > 200) estado.chat.shift();
    estado.version = (estado.version || 0) + 1;
  }

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ en_cola: true, posicion: estado.colaEspera.findIndex((e) => e.id === espectador.id) + 1 });
});
