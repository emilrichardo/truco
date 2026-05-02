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

  // Lo dejamos siempre en jugadores marcado como bot/desconectado.
  // Beneficios:
  //   - Si la sala todavía no inició y vuelve: sala-reconectar lo flippea
  //     a humano de nuevo y mantiene el mismo asiento.
  //   - Si la sala arranca sin él: empieza como bot, también puede
  //     retomar control con reconectar (mantenemos su id).
  //   - Si el creador quiere reemplazarlo: usar quitarBot/agregarBot.
  jugador.conectado = false;
  jugador.esBot = true;
  estado.chat.push({
    id: crypto.randomUUID().slice(0, 8),
    jugadorId: jugador.id,
    texto: sala.iniciada
      ? `${jugador.nombre} se desconectó — pasa a bot`
      : `${jugador.nombre} se fue de la mesa`,
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
