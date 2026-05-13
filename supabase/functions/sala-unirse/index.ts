// Une un jugador a una sala existente. Si la partida todavía no empezó,
// asigna asiento libre y equipo según asiento (par→0, impar→1). Si ya
// empezó, lo registra como espectador para que pueda verla en vivo.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import {
  finalizarSalaConGanador,
  salaExpirada
} from "../_shared/salaLifecycle.ts";
import type { Espectador, EstadoJuego, Jugador } from "../_shared/truco/types.ts";

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
  if (sala.terminada) return fail("ya_terminada", 409);
  if (salaExpirada(sala)) {
    if (sala.iniciada) {
      try {
        await finalizarSalaConGanador(
          sb,
          sala,
          "La sala superó 1 hora de duración. Se termina por tiempo y gana el equipo que iba arriba."
        );
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error), 500);
      }
    }
    return fail("sala_expirada", 409);
  }

  const estado = sala.estado as EstadoJuego;
  estado.espectadores = estado.espectadores ?? [];
  estado.colaEspera = estado.colaEspera ?? [];

  if (sala.iniciada) {
    const existenteJugador = estado.jugadores.find(
      (j) => (!!perfilId && j.perfilId === perfilId) || (!perfilId && j.nombre === body.nombre && j.personaje === body.personaje)
    );
    if (existenteJugador) {
      existenteJugador.perfilId = perfilId ?? existenteJugador.perfilId;
      existenteJugador.conectado = true;
      existenteJugador.esBot = false;
      estado.version = (estado.version || 0) + 1;

      const { error: errUpd } = await sb
        .from("salas")
        .update({ estado })
        .eq("id", body.sala_id);
      if (errUpd) return fail(`update: ${errUpd.message}`, 500);

      return ok({
        jugador_id: existenteJugador.id,
        asiento: existenteJugador.asiento,
        perfil_id: perfilId,
        rol: "jugador"
      });
    }

    const existenteEspectador = estado.espectadores
      .filter((e) => {
        const mismoPerfil = !!perfilId && e.perfilId === perfilId;
        const mismoNombre = e.nombre === body.nombre && e.personaje === body.personaje;
        return mismoPerfil || mismoNombre;
      })
      .sort((a, b) => a.ts - b.ts)[0];
    const espectador: Espectador = existenteEspectador ?? {
      id: crypto.randomUUID(),
      perfilId: perfilId ?? undefined,
      nombre: body.nombre,
      personaje: body.personaje,
      conectado: true,
      ts: Date.now()
    };
    espectador.perfilId = perfilId ?? espectador.perfilId;
    espectador.nombre = body.nombre;
    espectador.personaje = body.personaje;
    espectador.conectado = true;
    if (!existenteEspectador) estado.espectadores.push(espectador);
    estado.version = (estado.version || 0) + 1;

    estado.chat.push({
      id: crypto.randomUUID().slice(0, 8),
      jugadorId: espectador.id,
      texto: `${espectador.nombre} entró a mirar la partida`,
      ts: Date.now(),
      evento: "sistema"
    });
    if (estado.chat.length > 200) estado.chat.shift();

    const { error: errUpd } = await sb
      .from("salas")
      .update({ estado })
      .eq("id", body.sala_id);
    if (errUpd) return fail(`update: ${errUpd.message}`, 500);

    return ok({
      jugador_id: espectador.id,
      perfil_id: perfilId,
      rol: "espectador"
    });
  }

  const total = sala.modo === "2v2" ? 4 : 2;

  const existente = estado.jugadores
    .filter((j) => {
      const mismoPerfil = !!perfilId && j.perfilId === perfilId;
      const legacyMismoJugador =
        !j.perfilId &&
        j.nombre === body.nombre &&
        j.personaje === body.personaje &&
        (!j.conectado || j.esBot);
      return mismoPerfil || legacyMismoJugador;
    })
    .sort((a, b) => a.asiento - b.asiento)[0];
  if (existente) {
    existente.perfilId = perfilId ?? existente.perfilId;
    existente.conectado = true;
    existente.esBot = false;
    estado.version = (estado.version || 0) + 1;

    const { error: errUpd } = await sb
      .from("salas")
      .update({ estado })
      .eq("id", body.sala_id);
    if (errUpd) return fail(`update: ${errUpd.message}`, 500);

    return ok({
      jugador_id: existente.id,
      asiento: existente.asiento,
      perfil_id: perfilId,
      rol: "jugador"
    });
  }

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
    perfilId: perfilId ?? undefined,
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

  return ok({ jugador_id: jugadorId, asiento, perfil_id: perfilId, rol: "jugador" });
});
