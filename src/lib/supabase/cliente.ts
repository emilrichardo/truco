// Cliente Supabase para el navegador. Usa la anon key — todo el acceso a datos
// pasa por RLS, así que esta clave es segura de exponer.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {
  constructor() {
    super(
      "Falta configurar Supabase. Cargá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o NEXT_PUBLIC_SUPABASE_ANON_KEY) en las Environment Variables del deploy."
    );
    this.name = "SupabaseConfigError";
  }
}

/** Devuelve el cliente, o null si las env vars no están. Útil para mostrar
 * un mensaje en la UI en vez de explotar el render. */
export function tryGetSupabase(): SupabaseClient | null {
  if (cliente) return cliente;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // OJO: usamos ANON_KEY (JWT legacy "eyJ...") como primera opción porque
  // las Edge Functions de Supabase rechazan la PUBLISHABLE_KEY nueva
  // ("sb_publishable_...") con UNAUTHORIZED_INVALID_JWT_FORMAT (401).
  // PUBLISHABLE_KEY es válida para REST/postgrest pero NO para functions
  // todavía. Si en el futuro Supabase soporta el formato nuevo en
  // functions, se puede invertir el orden o sumar lógica de fallback.
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  cliente = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    realtime: { params: { eventsPerSecond: 10 } }
  });
  return cliente;
}

export function getSupabase(): SupabaseClient {
  const c = tryGetSupabase();
  if (!c) throw new SupabaseConfigError();
  return c;
}
