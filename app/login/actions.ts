"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { fetchProfile } from "@/lib/auth/session";
import {
  loginSchema,
  mapAuthError,
  MSG_CONNECTION,
  MSG_NOT_CONFIGURED,
  MSG_NO_PROFILE,
  type LoginState,
} from "@/lib/auth/login";
import { postLoginPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const text = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "");

/**
 * Cierra solo ESTA sesión (scope "local"). El valor por defecto de Supabase es "global",
 * que cerraría la sesión del usuario en todos sus dispositivos (p. ej. el celular del deportista).
 */
async function signOutThisSession(client: SupabaseClient): Promise<void> {
  try {
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Aun si falla la red, las cookies locales se eliminan igualmente.
  }
}

/** Inicio de sesión (Server Action): valida, autentica con Supabase Auth y redirige según el rol. */
export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = text(formData.get("email")).trim();
  const parsed = loginSchema.safeParse({ email, password: text(formData.get("password")) });
  if (!parsed.success) {
    const fieldErrors: NonNullable<LoginState["fieldErrors"]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if ((key === "email" || key === "password") && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors, email };
  }

  const client = await createSupabaseServerClient();
  if (!client) return { error: MSG_NOT_CONFIGURED, email };

  let userId: string;
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error || !data.user) return { error: mapAuthError(error ?? {}), email };
    userId = data.user.id;
  } catch {
    return { error: MSG_CONNECTION, email };
  }

  // La cuenta debe tener perfil activo; si no, se cierra la sesión recién creada.
  const lookup = await fetchProfile(client, userId);
  if (lookup.status === "error") {
    await signOutThisSession(client);
    return { error: MSG_CONNECTION, email };
  }
  if (lookup.status === "missing" || !lookup.profile.is_active) {
    await signOutThisSession(client);
    return { error: MSG_NO_PROFILE, email };
  }

  redirect(postLoginPath(lookup.profile.role, text(formData.get("next"))));
}

/** Cierre de sesión (Server Action): invalida ESTA sesión y limpia las cookies. */
export async function signOutAction(): Promise<void> {
  const client = await createSupabaseServerClient();
  if (client) await signOutThisSession(client);
  redirect("/");
}
