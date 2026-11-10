import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { authCookieOptions } from "./cookies";
import { readSupabaseEnv } from "./env";

/**
 * Cliente de Supabase para el servidor (Server Components / Route Handlers),
 * con la sesión del usuario guardada en cookies. Usa solo la clave pública:
 * todas las lecturas y escrituras pasan por RLS con la identidad del usuario.
 * Devuelve `null` si faltan variables (modo demostración).
 */
export async function createSupabaseServerClient(
  status = readSupabaseEnv(),
): Promise<SupabaseClient | null> {
  if (!status.configured) return null;
  const cookieStore = await cookies();
  return createServerClient(status.url, status.anonKey, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component las cookies son de solo lectura; la
          // renovación de sesión la hace `proxy.ts`.
        }
      },
    },
  });
}
