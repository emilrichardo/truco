// Aplica una acción de juego (jugar carta, cantar envido, responder, etc.)
// contra el motor del truco autoritativo. Persiste el nuevo estado y, si la
// partida terminó, registra el resultado en el historial.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { aplicarAccion } from "../_shared/truco/motor.ts";
import type { Accion, EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id: string;
  accion: Accion;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body || !body.sala_id || !body.jugador_id || !body.accion) {
    return fail("missing_fields");
  }

  const sb = admin();
  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);
  if (!sala.iniciada) return fail("no_iniciada", 409);
  if (sala.terminada) return fail("ya_terminada", 409);

  // Resolución de quién actúa:
  //  - Caso normal: la acción es del propio jugador. Forzamos
  //    accion.jugadorId = body.jugador_id (default seguro).
  //  - Caso bot: cualquier humano de la sala puede despachar acciones
  //    de bots. Antes sólo permitíamos al creador (asiento 0), pero si
  //    cerraba la pestaña los bots quedaban congelados — el cliente ya
  //    eligió un humano "primario" por menor asiento, acá sólo
  //    validamos que el dispatcher sea humano y el target sea bot.
  //  - "iniciar_prox_mano" es un trigger sin jugadorId — cualquier
  //    humano lo puede disparar (mismo motivo).
  const estadoSala = sala.estado as EstadoJuego;
  if (body.accion.tipo === "iniciar_prox_mano") {
    const dispatcher = estadoSala.jugadores.find((j) => j.id === body.jugador_id);
    if (!dispatcher || dispatcher.esBot) {
      return fail("solo_humano", 403);
    }
    body.accion.jugadorId = "";
  } else if (
    body.accion.jugadorId &&
    body.accion.jugadorId !== body.jugador_id
  ) {
    const dispatcher = estadoSala.jugadores.find((j) => j.id === body.jugador_id);
    const target = estadoSala.jugadores.find(
      (j) => j.id === body.accion.jugadorId
    );
    if (!dispatcher || dispatcher.esBot) {
      return fail("solo_humano_despacha_bots", 403);
    }
    if (!target || !target.esBot) {
      return fail("target_no_es_bot", 403);
    }
    // OK: dejamos accion.jugadorId apuntando al bot.
  } else {
    body.accion.jugadorId = body.jugador_id;
  }

  const inicio = Date.now();
  const r = aplicarAccion(estadoSala, body.accion);
  if (!r.ok) return fail(r.error || "accion_invalida");

  const updates: Record<string, unknown> = { estado: r.estado };

  // Si la partida terminó: marcar sala y registrar historial.
  if (r.estado.ganadorPartida !== null) {
    updates.terminada = true;
    updates.ganador_equipo = r.estado.ganadorPartida;
    updates.terminada_at = new Date().toISOString();

    const { data: partida, error: errPart } = await sb
      .from("partidas")
      .insert({
        sala_id: body.sala_id,
        modo: sala.modo,
        puntos_objetivo: sala.puntos_objetivo,
        ganador_equipo: r.estado.ganadorPartida,
        duracion_seg: Math.round((Date.now() - new Date(sala.created_at).getTime()) / 1000),
        estado_final: r.estado
      })
      .select()
      .single();

    if (!errPart && partida) {
      // Registrar cada jugador con su resultado (perfil_id si hay).
      // Para resolver perfil_id matcheamos nombre+personaje y, si hay
      // varios perfiles con el mismo par (cada device_id nuevo crea
      // uno), tomamos el más antiguo. Antes usábamos .maybeSingle() que
      // devolvía null en caso de duplicados — el jugador quedaba sin
      // perfil_id y desaparecía del ranking.
      const filas = await Promise.all(
        r.estado.jugadores.map(async (j) => {
          const { data: perfiles } = await sb
            .from("perfiles")
            .select("id")
            .eq("nombre", j.nombre)
            .eq("personaje", j.personaje)
            .order("created_at", { ascending: true })
            .limit(1);
          const perfilId = perfiles && perfiles[0] ? perfiles[0].id : null;
          return {
            partida_id: partida.id,
            perfil_id: perfilId,
            nombre: j.nombre,
            personaje: j.personaje,
            equipo: j.equipo,
            asiento: j.asiento,
            es_bot: j.esBot,
            gano: r.estado.ganadorPartida === j.equipo,
            puntos_finales:
              j.equipo === 0 ? r.estado.puntos[0] : r.estado.puntos[1]
          };
        })
      );
      await sb.from("partida_jugadores").insert(filas);
    }
  }

  const { error: errUpd } = await sb
    .from("salas")
    .update(updates)
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ ms: Date.now() - inicio });
});
