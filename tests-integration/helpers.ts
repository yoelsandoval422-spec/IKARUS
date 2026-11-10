import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AccountKey, IntegrationConfig } from "./config";

/** Cliente con la clave PÚBLICA; sin persistir sesión (cada cuenta tiene su propio cliente). */
export function anonClient(cfg: IntegrationConfig): SupabaseClient {
  return createClient(cfg.url, cfg.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Inicia sesión con una cuenta de prueba. Si falla, el mensaje NO incluye la contraseña. */
export async function signedInClient(cfg: IntegrationConfig, key: AccountKey): Promise<SupabaseClient> {
  const client = anonClient(cfg);
  const { error } = await client.auth.signInWithPassword({
    email: cfg.accounts[key].email,
    password: cfg.accounts[key].password,
  });
  if (error) {
    throw new Error(
      `No se pudo iniciar sesión con la cuenta de prueba ${key} (${error.code ?? error.status ?? "error"}). ` +
        "Revisa que exista, que esté confirmada y que la contraseña sea correcta.",
    );
  }
  return client;
}

/** Tablas de la aplicación (todas con RLS). */
export const ALL_TABLES = [
  "profiles", "categories", "positions", "teams", "athletes", "professional_athletes", "team_memberships",
  "wellbeing_records", "nutrition_records", "hydration_records", "training_records",
  "performance_records", "professional_notes", "anthropometric_evaluations", "anthropometric_measurements",
] as const;

/** Tablas con datos de un deportista (la columna athlete_id las vincula). */
export const ATHLETE_DATA_TABLES = [
  "wellbeing_records", "nutrition_records", "hydration_records", "training_records",
  "performance_records", "professional_notes", "anthropometric_evaluations", "team_memberships",
] as const;

export const today = (): string => new Date().toISOString().slice(0, 10);
