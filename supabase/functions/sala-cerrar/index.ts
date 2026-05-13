// Cierra una sala. Si no empezó, la borra. Si está en curso, la marca
// como terminada. Sólo el creador (asiento 0) puede cerrarla; si llega
// `jugador_id` se valida.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import {
  finalizarSalaConGanador,
  salaExpirada
} from "../_shared/salaLifecycle.ts";
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
    .maybeSingle();
  if (errSel) return fail(errSel.message, 500);
  if (!sala) return ok({ ya_no_existe: true });

  const expirada = salaExpirada(sala);
  if (body.jugador_id && !expirada) {
    const estado = sala.estado as EstadoJuego;
    const creador = estado.jugadores.find(
      (x) => x.id === body.jugador_id && x.asiento === 0
    );
    if (!creador) return fail("solo_el_creador", 403);
  }

  if (!sala.iniciada) {
    // No empezó: la borramos directamente.
    const { error } = await sb.from("salas").delete().eq("id", body.sala_id);
    if (error) return fail(error.message, 500);
    return ok({ borrada: true });
  }

  if (sala.terminada) return ok({ ya_terminada: true });

  const estado = sala.estado as EstadoJuego;
  const jugador = body.jugador_id
    ? estado.jugadores.find((j) => j.id === body.jugador_id)
    : undefined;
  const texto = expirada
    ? "La sala superó 1 hora de duración. Se termina por tiempo y gana el equipo que iba arriba."
    : jugador
      ? `${jugador.nombre} cerró la sala. La partida se termina y gana el equipo que iba arriba.`
      : "La sala fue cerrada. La partida se termina y gana el equipo que iba arriba.";

  try {
    await finalizarSalaConGanador(sb, sala, texto, jugador?.id);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error), 500);
  }
  return ok({ cerrada: true, terminada_por_tiempo: expirada });
});
