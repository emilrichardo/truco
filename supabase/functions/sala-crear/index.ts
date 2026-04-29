// Crea una sala online con alias truquero. Inserta al creador como primer
// jugador (asiento 0, equipo 0). El motor del truco corre en Edge: el estado
// inicial se calcula acá y se guarda en la tabla `salas`.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { generarAliasSala } from "../_shared/aliasSala.ts";
import { crearEstadoInicial } from "../_shared/truco/motor.ts";
import type { Jugador } from "../_shared/truco/types.ts";

interface Payload {
  perfil_id?: string;          // si se conoce; si no, podemos crear uno anónimo
  nombre: string;
  personaje: string;
  tamanio: 2 | 4;
  puntos_objetivo: 18 | 30;
  device_id?: string;          // identificador estable del cliente
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body) return fail("bad_json");
  if (!body.nombre || !body.personaje || !body.tamanio || !body.puntos_objetivo) {
    return fail("missing_fields");
  }

  const sb = admin();

  // 1) Asegurar perfil del creador (upsert por device_id si no llega perfil_id).
  let perfilId = body.perfil_id ?? null;
  if (!perfilId && body.device_id) {
    const { data: existente } = await sb
      .from("perfiles")
      .select("id")
      .eq("device_id", body.device_id)
      .maybeSingle();
    if (existente) {
      perfilId = existente.id;
      await sb
        .from("perfiles")
        .update({ nombre: body.nombre, personaje: body.personaje })
        .eq("id", existente.id);
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

  // 2) Generar alias único.
  const { data: salasUsadas } = await sb.from("salas").select("id");
  const usadas = new Set((salasUsadas || []).map((r: { id: string }) => r.id));
  const salaId = generarAliasSala(usadas);

  // 3) Construir estado inicial con el creador como único jugador.
  const jugadorId = crypto.randomUUID();
  const jugador: Jugador = {
    id: jugadorId,
    nombre: body.nombre,
    personaje: body.personaje,
    equipo: 0,
    asiento: 0,
    conectado: true,
    esBot: false
  };
  const estadoInicial = crearEstadoInicial({
    salaId,
    jugadores: [jugador],
    modo: body.tamanio === 4 ? "2v2" : "1v1",
    puntosObjetivo: body.puntos_objetivo
  });

  // 4) Persistir.
  const { data: sala, error: errIns } = await sb
    .from("salas")
    .insert({
      id: salaId,
      modo: estadoInicial.modo,
      puntos_objetivo: estadoInicial.puntosObjetivo,
      estado: estadoInicial,
      created_by: perfilId
    })
    .select()
    .single();
  if (errIns) return fail(`sala_insert: ${errIns.message}`, 500);

  return ok({ sala_id: salaId, jugador_id: jugadorId, sala, perfil_id: perfilId });
});
