// Lista las salas públicas que están abiertas (creadas pero no iniciadas
// y no terminadas), para mostrarlas en la home. Cualquiera puede entrar
// sin necesitar el link directo.
import { admin, fail, ok, preflight } from "../_shared/lib.ts";
import type { EstadoJuego } from "../_shared/truco/types.ts";

interface SalaResumen {
  id: string;
  modo: "1v1" | "2v2";
  con_flor: boolean;
  creador: string | null;
  jugadores: number;
  cupos: number;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const sb = admin();

  // Listamos públicas no iniciadas y no terminadas, más recientes
  // primero. Limitamos para no traer cantidades enormes.
  const { data, error } = await sb
    .from("salas")
    .select("id, modo, estado, created_at, created_by")
    .eq("publica", true)
    .eq("iniciada", false)
    .eq("terminada", false)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) return fail(`listar: ${error.message}`, 500);

  const filas = (data ?? []) as Array<{
    id: string;
    modo: "1v1" | "2v2";
    estado: EstadoJuego;
    created_at: string;
    created_by: string | null;
  }>;

  // Resolvemos el nombre del creador (1 query batch para todos los
  // perfiles distintos), así el cliente muestra "Sala de Marcos".
  const perfilIds = Array.from(
    new Set(filas.map((f) => f.created_by).filter((v): v is string => !!v))
  );
  const nombresPorPerfil = new Map<string, string>();
  if (perfilIds.length > 0) {
    const { data: perfiles } = await sb
      .from("perfiles")
      .select("id, nombre")
      .in("id", perfilIds);
    for (const p of perfiles ?? []) {
      nombresPorPerfil.set(p.id as string, p.nombre as string);
    }
  }

  const salas: SalaResumen[] = filas.map((f) => {
    const cupos = f.modo === "2v2" ? 4 : 2;
    const jugHumanos = (f.estado.jugadores ?? []).filter(
      (j) => !j.esBot
    ).length;
    return {
      id: f.id,
      modo: f.modo,
      con_flor: !!f.estado.conFlor,
      creador: f.created_by ? nombresPorPerfil.get(f.created_by) ?? null : null,
      jugadores: jugHumanos,
      cupos,
      created_at: f.created_at
    };
  });

  return ok({ salas });
});
