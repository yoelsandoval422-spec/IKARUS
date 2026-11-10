import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupabaseEnvStatus } from "./env";

export type CheckStep = { name: string; ok: boolean; message: string };

/**
 * Comprobación REAL de conexión (hace peticiones de red). Devuelve solo estados y
 * mensajes: nunca la URL ni las claves.
 *  1) Auth del proyecto alcanzable y clave pública aceptada (`/auth/v1/health`).
 *  2) Migraciones aplicadas: se puede leer `categories` con la sesión del usuario.
 */
export async function checkSupabaseConnection(
  status: SupabaseEnvStatus,
  client: SupabaseClient | null,
  fetchImpl: typeof fetch = fetch,
): Promise<CheckStep[]> {
  if (!status.configured) {
    return [{ name: "Variables", ok: false, message: "Supabase no está configurado." }];
  }
  const steps: CheckStep[] = [];

  try {
    const res = await fetchImpl(`${status.url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: status.anonKey },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) steps.push({ name: "Servicio de autenticación", ok: true, message: "Responde correctamente." });
    else if (res.status === 401 || res.status === 403)
      steps.push({ name: "Servicio de autenticación", ok: false, message: "El proyecto respondió, pero rechazó la clave pública." });
    else steps.push({ name: "Servicio de autenticación", ok: false, message: `Respuesta inesperada (HTTP ${res.status}).` });
  } catch {
    steps.push({ name: "Servicio de autenticación", ok: false, message: "No se pudo alcanzar el proyecto (revisa la URL y la red)." });
    return steps;
  }

  if (client) {
    const { error } = await client.from("categories").select("id", { head: true, count: "exact" });
    steps.push(
      error
        ? { name: "Migraciones y permisos", ok: false, message: "No se pudo leer la tabla de categorías: ¿se ejecutaron las migraciones?" }
        : { name: "Migraciones y permisos", ok: true, message: "La tabla de categorías es legible con tu sesión." },
    );
  }
  return steps;
}
