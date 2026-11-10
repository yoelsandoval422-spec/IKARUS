import { isPrivilegedSupabaseKey } from "../lib/supabase/env";

export const ACCOUNT_KEYS = ["PRO1", "PRO2", "ATH1", "ATH2", "ATH3"] as const;
export type AccountKey = (typeof ACCOUNT_KEYS)[number];

export interface IntegrationConfig {
  url: string;
  anonKey: string;
  accounts: Record<AccountKey, { email: string; password: string }>;
}

export type ConfigResult =
  | { status: "unset" } // ninguna variable TEST_*: las pruebas se omiten
  | { status: "invalid"; reason: string } // hay variables pero algo está mal: las pruebas FALLAN a propósito
  | { status: "ok"; config: IntegrationConfig };

const NAMES = [
  "TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "TEST_CONFIRM_TEST_PROJECT",
  ...ACCOUNT_KEYS.flatMap((k) => [`TEST_${k}_EMAIL`, `TEST_${k}_PASSWORD`]),
] as const;

/**
 * Lee y valida la configuración de las pruebas de integración (función pura).
 * Reglas de seguridad:
 *  - sin ninguna variable → "unset" (se omiten; no es un fallo);
 *  - con algunas pero incompletas/ inválidas → "invalid" (fallan, para que nadie crea que pasaron);
 *  - hay que confirmar con TEST_CONFIRM_TEST_PROJECT=si que el proyecto es de PRUEBAS;
 *  - nunca se acepta una clave privilegiada (service_role / sb_secret_…);
 *  - las 5 cuentas deben ser distintas.
 * Los mensajes nombran variables, jamás imprimen valores.
 */
export function readIntegrationConfig(env: Record<string, string | undefined>): ConfigResult {
  const present = NAMES.filter((n) => (env[n] ?? "").trim() !== "");
  if (present.length === 0) return { status: "unset" };

  const missing = NAMES.filter((n) => n !== "TEST_CONFIRM_TEST_PROJECT" && (env[n] ?? "").trim() === "");
  if (missing.length > 0) return { status: "invalid", reason: `Faltan variables: ${missing.join(", ")}.` };

  if ((env.TEST_CONFIRM_TEST_PROJECT ?? "").trim() !== "si") {
    return {
      status: "invalid",
      reason: 'Falta confirmar que es un proyecto de PRUEBAS: define TEST_CONFIRM_TEST_PROJECT=si (nunca uses el proyecto con deportistas reales).',
    };
  }

  const url = (env.TEST_SUPABASE_URL ?? "").trim();
  const anonKey = (env.TEST_SUPABASE_ANON_KEY ?? "").trim();
  try {
    const u = new URL(url);
    const local = ["localhost", "127.0.0.1"].includes(u.hostname);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) throw new Error("protocolo");
  } catch {
    return { status: "invalid", reason: "TEST_SUPABASE_URL no es una URL válida (se exige https, salvo localhost)." };
  }
  if (isPrivilegedSupabaseKey(anonKey)) {
    return { status: "invalid", reason: "TEST_SUPABASE_ANON_KEY es una clave privilegiada. Usa solo la clave pública (anon / publishable)." };
  }
  if (anonKey.length < 20) return { status: "invalid", reason: "TEST_SUPABASE_ANON_KEY no parece una clave válida." };

  const accounts = {} as IntegrationConfig["accounts"];
  for (const k of ACCOUNT_KEYS) {
    accounts[k] = { email: (env[`TEST_${k}_EMAIL`] ?? "").trim(), password: env[`TEST_${k}_PASSWORD`] ?? "" };
  }
  const emails = ACCOUNT_KEYS.map((k) => accounts[k].email.toLowerCase());
  if (new Set(emails).size !== emails.length) {
    return { status: "invalid", reason: "Las 5 cuentas de prueba deben tener correos distintos." };
  }
  return { status: "ok", config: { url, anonKey, accounts } };
}

/** Identificadores fijos creados por supabase/test/01_sembrar_datos_de_prueba.sql */
export const FIXTURE = {
  A1: "7e570000-0000-4000-8000-0000000000a1",
  A2: "7e570000-0000-4000-8000-0000000000a2",
  A3: "7e570000-0000-4000-8000-0000000000a3",
  TEAM: "7e570000-0000-4000-8000-0000000000e1",
} as const;
