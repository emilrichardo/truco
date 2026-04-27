// Edge Function: crear una sala nueva con alias truquero.
// Genera el alias evitando colisiones contra `salas.id` y devuelve la sala
// recién creada. El motor del truco aún se ejecuta en el server Node;
// migración a Edge en fase 2.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALIASES = [
  "fernet-y-mazo","fernet-y-yapa","anchito-bravo","anchito-pelado",
  "anchito-de-espada","siete-vieja","siete-bravo","siete-de-oro",
  "olorosa-criolla","olorosa-falsa","rabona-larga","rabona-criolla",
  "sota-loca","sota-pelada","mazo-pelado","envido-falso","envido-largo",
  "real-envido","falta-envido","truco-pelado","truco-bravo","vale-cuatro",
  "carpeta-larga","picardia-criolla","picardia-pura","yapa-final",
  "puntazo-bravo","puntazo-final","matraca-larga","bocha-fina",
  "asadito-largo","asadito-criollo","manilla-corta","rey-del-monte",
  "caballo-rabona","mano-y-pie","ancho-pelado","viejas-bravas",
  "verdes-que-secan","verdes-secas","embocada-larga","criolla-picara",
  "matrera-vieja","no-quiero-ni-ver","mucha-cancha","buena-flor",
  "cara-rota","tirando-a-matar","tres-de-espada","siete-falso",
  "vino-y-mazo","yapa-criolla","primo-bravo","primo-rabona",
  "olor-a-fernet"
];

interface Payload {
  modo: "1v1" | "2v2";
  puntos_objetivo: 15 | 30;
  perfil_id?: string;
  estado_inicial: unknown;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return error("method_not_allowed", 405);
  let body: Payload;
  try { body = await req.json(); } catch { return error("bad_json", 400); }
  if (!body.modo || !body.puntos_objetivo || !body.estado_inicial) {
    return error("missing_fields", 400);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Generar alias único
  const baraja = [...ALIASES].sort(() => Math.random() - 0.5);
  let salaId: string | null = null;
  for (const a of baraja) {
    const { count } = await admin
      .from("salas").select("id", { count: "exact", head: true }).eq("id", a);
    if ((count ?? 0) === 0) { salaId = a; break; }
  }
  if (!salaId) {
    salaId = `${baraja[0]}-${Date.now().toString(36).slice(-4)}`;
  }

  const { data, error: errIns } = await admin.from("salas").insert({
    id: salaId,
    modo: body.modo,
    puntos_objetivo: body.puntos_objetivo,
    estado: body.estado_inicial,
    created_by: body.perfil_id ?? null
  }).select().single();
  if (errIns) return error(errIns.message, 500);

  return new Response(JSON.stringify({ ok: true, sala: data }), {
    headers: { "content-type": "application/json" }
  });
});

function error(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "content-type": "application/json" }
  });
}
