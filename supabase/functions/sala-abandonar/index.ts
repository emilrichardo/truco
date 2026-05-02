// Saca a un jugador (no creador) de la sala. Si la sala todavía no empezó,
// libera su asiento. Si ya está en curso, marca al jugador como
// desconectado/abandonado en el estado y emite un evento de chat
// "X se fue de la mesa" para que el resto se entere.
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

  const estado = sala.estado as EstadoJuego;
  const jugador = estado.jugadores.find((j) => j.id === body.jugador_id);
  if (!jugador) return fail("jugador_no_esta", 404);
  // El creador (asiento 0) no puede abandonar — usa "cerrar sala".
  if (jugador.asiento === 0) return fail("creador_no_puede_abandonar", 403);

  if (!sala.iniciada) {
    // Antes de iniciar: lo sacamos del array y liberamos el asiento.
    estado.chat.push({
      id: crypto.randomUUID().slice(0, 8),
      jugadorId: jugador.id,
      texto: `${jugador.nombre} se fue de la mesa`,
      ts: Date.now(),
      evento: "sistema"
    });
    estado.jugadores = estado.jugadores.filter((j) => j.id !== jugador.id);
  } else {
    // En curso: lo convertimos a bot para que el motor pueda seguir
    // jugando sin esperarlo. Así el resto no queda colgado y el
    // jugador siempre puede volver (re-unirse).
    jugador.conectado = false;
    jugador.esBot = true;
    estado.chat.push({
      id: crypto.randomUUID().slice(0, 8),
      jugadorId: jugador.id,
      texto: `${jugador.nombre} se desconectó — pasa a bot`,
      ts: Date.now(),
      evento: "sistema"
    });
  }
  if (estado.chat.length > 200) estado.chat.shift();
  estado.version = (estado.version || 0) + 1;

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({});
});
