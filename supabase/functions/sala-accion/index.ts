// Edge Function: aplicar acción a una sala.
// Esqueleto inicial — el motor del truco aún no fue portado a Deno.
// Estructura del flujo cuando esté completo:
//   1. Cliente envía { sala_id, jugador_id, accion } con su anon JWT.
//   2. Esta función carga la sala desde Postgres (usando service_role).
//   3. Aplica la acción contra el motor (por portar).
//   4. Guarda el nuevo estado, emite NOTIFY (vía UPDATE → Realtime broadcast).
//   5. Si la acción terminó la partida, inserta en `partidas` + `partida_jugadores`.
//   6. Si toca un bot, agenda otra invocación con setTimeout (700ms) y aplica.
//
// TODO fase 2:
//   - Importar el motor de truco (lib/truco/motor.ts) adaptado a Deno.
//   - Resolver el delay de bots: o cliente local del host, o tabla de
//     "bot_pendientes" + cron al minuto, o auto-invocación con fetch demorado.

import { createClient } from "jsr:@supabase/supabase-js@2";

interface Payload {
  sala_id: string;
  jugador_id: string;
  accion: { tipo: string; [k: string]: unknown };
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" }
    });
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonError("bad_json", 400);
  }
  if (!body.sala_id || !body.jugador_id || !body.accion) {
    return jsonError("missing_fields", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // 1. Cargar sala
  const { data: sala, error: errSala } = await admin
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSala || !sala) return jsonError("sala_not_found", 404);
  if (sala.terminada) return jsonError("sala_terminada", 409);

  // 2. Aplicar acción — STUB por ahora.
  //    Cuando portemos el motor: const r = aplicarAccion(sala.estado, body.accion);
  const nuevoEstado = sala.estado;
  // r.ok === false → return jsonError(r.error, 400);

  // 3. Persistir estado actualizado (Realtime lo broadcasteará).
  const { error: errUpd } = await admin
    .from("salas")
    .update({ estado: nuevoEstado })
    .eq("id", body.sala_id);
  if (errUpd) return jsonError(errUpd.message, 500);

  return new Response(JSON.stringify({ ok: true, estado: nuevoEstado }), {
    headers: { "content-type": "application/json" }
  });
});

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" }
  });
}
