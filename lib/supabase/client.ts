import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para el NAVEGADOR (clave pública únicamente), o `null` si falta
 * configuración (modo demostración). Nunca usar aquí una clave service_role.
 *
 * Hoy la aplicación NO lo usa: todo el acceso a datos ocurre en el servidor. Además, como las
 * cookies de sesión son `httpOnly` (ver cookies.ts), este cliente actuaría como usuario anónimo
 * y RLS le negaría el acceso a los datos. Se conserva por si se necesita, p. ej., Realtime público.
 */
export function getSupabaseClient(status = readSupabaseEnv()): SupabaseClient | null {
  if (!status.configured) return null;
  return createBrowserClient(status.url, status.anonKey);
}
