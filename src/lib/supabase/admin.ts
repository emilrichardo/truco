// Cliente Supabase con service_role. SOLO se usa server-side (Edge Functions,
// migraciones, scripts de admin). Saltea RLS, así que NUNCA importar desde
// código que pueda terminar en el bundle del navegador.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (server-side)"
    );
  }
  admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return admin;
}
