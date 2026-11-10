"use server";

import { getSessionContext } from "@/lib/auth/session";
import { checkSupabaseConnection, type CheckStep } from "@/lib/supabase/health";
import { readSupabaseEnv } from "@/lib/supabase/env";

export interface ConnectionCheckState {
  steps?: CheckStep[];
  error?: string;
}

/** Solo un profesional autenticado puede lanzar la comprobación. */
export async function checkConnectionAction(): Promise<ConnectionCheckState> {
  const ctx = await getSessionContext();
  if (ctx.mode !== "authenticated" || ctx.role !== "professional") {
    return { error: "Inicia sesión como profesional para verificar la conexión." };
  }
  return { steps: await checkSupabaseConnection(readSupabaseEnv(), ctx.client) };
}
