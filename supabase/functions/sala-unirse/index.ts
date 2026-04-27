// Une un jugador a una sala existente. Asigna asiento libre y equipo según
// asiento (par→0, impar→1). Falla si la sala ya empezó o está llena.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import type { EstadoJuego, Jugador } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  perfil_id?: string;
  device_id?: string;
  nombre: string;
  personaje: string;
  asiento_preferido?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body || !body.sala_id || !body.nombre || !body.personaje)
    return fail("missing_fields");

  const sb = admin();

  // Resolver perfil_id por device_id si hace falta.
  let perfilId = body.perfil_id ?? null;
  if (!perfilId && body.device_id) {
    const { data: ex } = await sb
      .from("perfiles")
      .select("id")
      .eq("device_id", body.device_id)
      .maybeSingle();
    if (ex) {
      perfilId = ex.id;
      await sb
        .from("perfiles")
        .update({ nombre: body.nombre, personaje: body.personaje })
        .eq("id", ex.id);
    } else {
      const { data: nuevo, error } = await sb
        .from("perfiles")
        .insert({
          device_id: body.device_id,
          nombre: body.nombre,
          personaje: body.personaje
        })
        .select("id")
        .single();
      if (error) return fail(`perfil_insert: ${error.message}`, 500);
      perfilId = nuevo.id;
    }
  }

  const { data: sala, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);
  if (sala.iniciada) return fail("ya_empezo", 409);

  const estado = sala.estado as EstadoJuego;
  const total = sala.modo === "2v2" ? 4 : 2;
  const ocupados = new Set(estado.jugadores.map((j) => j.asiento));
  let asiento =
    body.asiento_preferido !== undefined && !ocupados.has(body.asiento_preferido)
      ? body.asiento_preferido
      : -1;
  if (asiento < 0) {
    for (let i = 0; i < total; i++) {
      if (!ocupados.has(i)) { asiento = i; break; }
    }
  }
  if (asiento < 0) return fail("sala_llena", 409);

  const jugadorId = crypto.randomUUID();
  const jugador: Jugador = {
    id: jugadorId,
    nombre: body.nombre,
    personaje: body.personaje,
    equipo: (asiento % 2) as 0 | 1,
    asiento,
    conectado: true,
    esBot: false
  };
  estado.jugadores.push(jugador);
  estado.version = (estado.version || 0) + 1;

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ jugador_id: jugadorId, asiento, perfil_id: perfilId });
});
