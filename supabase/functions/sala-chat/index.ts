// Agrega un mensaje al chat de la sala. Limita a 200 mensajes en el estado
// (los más viejos se descartan, igual que en el server original).
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id: string;
  texto?: string;
  reaccion?: string;
  sticker?: string;
  destinatario_id?: string;
  /** Audio personalizado del jugador para acompañar un canto. Data URL
   *  base64. Limitado a ~150KB para no llenar la fila de la sala. */
  audio_canto_data_url?: string;
  audio_canto_tipo?: string;
}

// 300KB cubre WAV 22kHz mono 16-bit de ~3.5s + base64 overhead. Antes
// 150KB se pasaba con grabaciones cortas y rechazaba el audio entero.
const AUDIO_MAX_BYTES = 300_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body || !body.sala_id || !body.jugador_id) return fail("missing_fields");
  if (
    !body.texto &&
    !body.reaccion &&
    !body.sticker &&
    !body.audio_canto_data_url
  )
    return fail("vacio");
  if (
    body.audio_canto_data_url &&
    body.audio_canto_data_url.length > AUDIO_MAX_BYTES
  )
    return fail("audio_demasiado_grande");

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);

  const estado = sala.estado as EstadoJuego;
  const jugador = estado.jugadores.find((j) => j.id === body.jugador_id);
  const destinatario = body.destinatario_id
    ? estado.jugadores.find((j) => j.id === body.destinatario_id)
    : undefined;
  if (body.destinatario_id && (!jugador || !destinatario)) {
    return fail("destinatario_invalido", 400);
  }
  if (jugador && destinatario && jugador.equipo !== destinatario.equipo) {
    return fail("solo_companiero", 403);
  }
  const directo = !!destinatario;
  estado.chat.push({
    id: crypto.randomUUID().slice(0, 8),
    jugadorId: body.jugador_id,
    destinatarioId: directo ? destinatario.id : undefined,
    texto: (body.texto || "").slice(0, 200),
    reaccion: body.reaccion,
    sticker: body.sticker,
    directo,
    ts: Date.now(),
    audioCantoDataUrl: body.audio_canto_data_url,
    audioCantoTipo: body.audio_canto_tipo
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
