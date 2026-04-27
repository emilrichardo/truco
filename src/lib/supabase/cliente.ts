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
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
