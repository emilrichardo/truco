// Agrega un bot al primer asiento libre de la sala. Solo lo puede invocar
// el creador (asiento 0). Falla si la sala ya empezó o está llena.
//
// El bot se elige aleatoriamente entre los personajes que todavía no están
// en uso. La ejecución de turnos del bot durante la partida la maneja el
// cliente del host (igual que en modo solo) — esta función solo crea la
// fila de jugador en la sala.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import type { EstadoJuego, Jugador } from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id?: string;
}

// Mismo catálogo que /src/data/jugadores.ts. Lo duplicamos acá para que la
// function no tenga que importar nada del bundle del cliente.
const PERSONAJES = [
  { slug: "hugui", nombre: "Hugui" },
  { slug: "cholo", nombre: "Cholo" },
  { slug: "marcos", nombre: "Marcos" },
  { slug: "lucas", nombre: "Lucas" },
  { slug: "mati", nombre: "Matías" },
  { slug: "mariano", nombre: "Mariano" },
  { slug: "richi", nombre: "Richi" },
  { slug: "jorge", nombre: "Jorge" },
  { slug: "rodrigo", nombre: "Rodrigo" },
  { slug: "dani", nombre: "Dani" }
];

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

  const total = sala.modo === "2v2" ? 4 : 2;
  const ocupados = new Set(estado.jugadores.map((j) => j.asiento));
  let asiento = -1;
  for (let i = 0; i < total; i++) {
    if (!ocupados.has(i)) {
      asiento = i;
      break;
    }
  }
  if (asiento < 0) return fail("sala_llena", 409);

  // Elegimos personaje libre — los que ya están en la mesa quedan afuera.
  const usados = new Set(estado.jugadores.map((j) => j.personaje));
  const libres = PERSONAJES.filter((p) => !usados.has(p.slug));
  const meta =
    libres.length > 0
      ? libres[Math.floor(Math.random() * libres.length)]
      : PERSONAJES[0];

  const bot: Jugador = {
    id: crypto.randomUUID(),
    nombre: meta.nombre,
    personaje: meta.slug,
    equipo: (asiento % 2) as 0 | 1,
    asiento,
    conectado: true,
    esBot: true
  };
  estado.jugadores.push(bot);
  estado.version = (estado.version || 0) + 1;

  const { error: errUpd } = await sb
    .from("salas")
    .update({ estado })
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({ jugador_id: bot.id, asiento });
});
