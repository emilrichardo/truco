// Inicia una partida online. Acepta humanos + bots (los bots los agrega el
// host vía sala-agregar-bot). Solo el creador (asiento 0) puede iniciar.
//
// Si llega `mezclar_equipos: true`, antes de arrancar mezclamos los
// asientos al azar — así los compañeros no quedan determinados por el
// orden de llegada.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { iniciarPartida } from "../_shared/truco/motor.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id?: string;
  mezclar_equipos?: boolean;
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
    .single();
  if (errSel || !sala) return fail("sala_no_encontrada", 404);
  if (sala.iniciada) return fail("ya_empezo", 409);

  const estado = sala.estado as EstadoJuego;

  if (body.jugador_id) {
    const j = estado.jugadores.find((x) => x.id === body.jugador_id);
    if (!j || j.asiento !== 0) return fail("solo_el_creador", 403);
  }

  const requeridos = sala.modo === "2v2" ? 4 : 2;
  if (estado.jugadores.length < requeridos) {
    return fail(
      `faltan_jugadores: requeridos ${requeridos}, hay ${estado.jugadores.length}`
    );
  }

  // Mezclar asientos antes de iniciar. El creador (asiento 0) puede caer
  // en cualquier asiento; los equipos se recalculan por asiento%2.
  //
  // En 2v2 garantizamos que la pareja del primer jugador cambie respecto
  // a la actual — sino el shuffle plano deja la misma sociedad 1/3 de las
  // veces y al usuario se le hace que "siempre toca lo mismo".
  if (body.mezclar_equipos) {
    const n = estado.jugadores.length;
    if (n === 4) {
      const ids = estado.jugadores.map((j) => j.id);
      const j0 = estado.jugadores[0];
      const parejaActualId = estado.jugadores.find(
        (j) => j.id !== j0.id && j.equipo === j0.equipo
      )?.id;
      // 3 sociedades posibles: el primer jugador puede ir con cualquiera
      // de los otros 3. Sacamos la actual y elegimos al azar entre las 2.
      const candidatosCompi = ids.slice(1).filter((id) => id !== parejaActualId);
      const compi = candidatosCompi[Math.floor(Math.random() * candidatosCompi.length)];
      const rivales = ids.slice(1).filter((id) => id !== compi);
      // Asignamos asientos: equipoA → 0,2; equipoB → 1,3. Orden interno
      // al azar para que también se mueva quién es mano.
      const equipoA = [ids[0], compi];
      const equipoB = [...rivales].sort(() => Math.random() - 0.5);
      if (Math.random() < 0.5) equipoA.reverse();
      const asientoPorId: Record<string, number> = {
        [equipoA[0]]: 0,
        [equipoB[0]]: 1,
        [equipoA[1]]: 2,
        [equipoB[1]]: 3
      };
      estado.jugadores.forEach((j) => {
        j.asiento = asientoPorId[j.id];
        j.equipo = (j.asiento % 2) as 0 | 1;
      });
    } else {
      // 1v1 — un único swap posible.
      const asientos = estado.jugadores.map((j) => j.asiento);
      for (let i = asientos.length - 1; i > 0; i--) {
        const k = Math.floor(Math.random() * (i + 1));
        [asientos[i], asientos[k]] = [asientos[k], asientos[i]];
      }
      estado.jugadores.forEach((j, idx) => {
        j.asiento = asientos[idx];
        j.equipo = (asientos[idx] % 2) as 0 | 1;
      });
    }
  }

  iniciarPartida(estado);

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado, iniciada: true })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ sala_id: body.sala_id });
});
