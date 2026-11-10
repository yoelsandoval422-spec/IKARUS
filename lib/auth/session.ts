import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";
import { z } from "zod";
import { classifyAuthFailure } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseEnv } from "@/lib/supabase/env";
import type { AppRole } from "@/types";

/**
 * Motivos por los que se muestra el modo demostración (o un estado equivalente):
 *  - not-configured: Supabase sin configurar;
 *  - no-session: nadie ha iniciado sesión;
 *  - expired: la sesión existía pero venció o fue revocada;
 *  - no-access: la cuenta existe pero no tiene perfil activo en la aplicación.
 */
export type DemoReason = "not-configured" | "no-session" | "expired" | "no-access";

export type SessionContext =
  | { mode: "demo"; reason: DemoReason }
  /** No se pudo verificar la sesión (red/servicio caído). No es "sin sesión". */
  | { mode: "unavailable" }
  | { mode: "authenticated"; userId: string; role: AppRole; client: SupabaseClient };

const profileSchema = z.object({
  role: z.enum(["athlete", "professional"]),
  is_active: z.boolean(),
});

export interface ProfileRow {
  role: AppRole;
  is_active: boolean;
}

export type ProfileLookup =
  | { status: "found"; profile: ProfileRow }
  | { status: "missing" }
  | { status: "error" };

/**
 * Lee el perfil del usuario (RLS: solo puede leer el suyo).
 * Distingue "no existe / forma inválida" (missing) de "falló la consulta" (error).
 */
export async function fetchProfile(client: SupabaseClient, userId: string): Promise<ProfileLookup> {
  try {
    const { data, error } = await client.from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
    if (error) return { status: "error" };
    const parsed = profileSchema.safeParse(data);
    return parsed.success ? { status: "found", profile: parsed.data } : { status: "missing" };
  } catch {
    return { status: "error" };
  }
}

/**
 * Resuelve la sesión EN EL SERVIDOR (una verificación por petición, gracias a `cache` de React):
 *  - sin variables de Supabase → demostración;
 *  - el token se valida con `auth.getUser()` (consulta al servidor de Auth; no se confía en
 *    cookies sin verificar) y el ROL se lee de la tabla `profiles`, que solo el servidor puede
 *    modificar. Nunca de `user_metadata`, que el propio usuario puede editar;
 *  - sin usuario → "no-session" o "expired" según el error; si el servicio no responde → "unavailable";
 *  - perfil inexistente o inactivo → "no-access".
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const status = readSupabaseEnv();
  if (!status.configured) return { mode: "demo", reason: "not-configured" };

  const client = await createSupabaseServerClient(status);
  if (!client) return { mode: "demo", reason: "not-configured" };

  let userId: string;
  try {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      const kind = classifyAuthFailure(error);
      return kind === "unavailable" ? { mode: "unavailable" } : { mode: "demo", reason: kind };
    }
    userId = data.user.id;
  } catch {
    return { mode: "unavailable" };
  }

  const lookup = await fetchProfile(client, userId);
  if (lookup.status === "error") return { mode: "unavailable" };
  if (lookup.status === "missing" || !lookup.profile.is_active) return { mode: "demo", reason: "no-access" };
  return { mode: "authenticated", userId, role: lookup.profile.role, client };
});

/** ¿Puede este contexto ver datos de gestión del plantel? (la base lo vuelve a comprobar con RLS) */
export function canManageRoster(ctx: SessionContext): ctx is Extract<SessionContext, { mode: "authenticated" }> {
  return ctx.mode === "authenticated" && ctx.role === "professional";
}
