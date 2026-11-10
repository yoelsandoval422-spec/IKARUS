import { z } from "zod";

const envSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(20),
});

export type SupabaseEnvStatus =
  | { configured: true; url: string; anonKey: string }
  | { configured: false; reason: "missing" | "invalid" | "privileged-key"; missing: string[] };

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const parsed: unknown = JSON.parse(atob(padded));
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * ¿La clave es una clave PRIVILEGIADA de Supabase (nunca debe llegar al navegador)?
 * Detecta las claves `sb_secret_…` y los JWT cuyo rol es `service_role`.
 */
export function isPrivilegedSupabaseKey(key: string): boolean {
  const k = key.trim();
  if (/^sb_secret_/i.test(k)) return true;
  return decodeJwtPayload(k)?.role === "service_role";
}

const SECRET_NAME = /(SERVICE_ROLE|SECRET|PRIVATE|PASSWORD|DATABASE_URL|DB_URL|JWT_SECRET)/i;

/**
 * Nombres (nunca valores) de variables `NEXT_PUBLIC_*` que no deberían existir porque
 * Next.js las incluye en el código que descarga el navegador.
 */
export function findExposedSecretVars(env: Record<string, string | undefined>): string[] {
  return Object.entries(env)
    .filter(
      ([name, value]) =>
        name.startsWith("NEXT_PUBLIC_") &&
        (SECRET_NAME.test(name) || (typeof value === "string" && value !== "" && isPrivilegedSupabaseKey(value))),
    )
    .map(([name]) => name)
    .sort();
}

/**
 * Lee las variables públicas. Se pasan como argumento para poder probar sin tocar process.env.
 * Acepta `NEXT_PUBLIC_SUPABASE_ANON_KEY` o, como alternativa, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
 * Rechaza claves privilegiadas: con una clave así la app NO se considera configurada.
 */
export function readSupabaseEnv(
  env: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): SupabaseEnvStatus {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
  const missing: string[] = [];
  if (!url) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (missing.length > 0) return { configured: false, reason: "missing", missing };

  if (isPrivilegedSupabaseKey(anonKey)) return { configured: false, reason: "privileged-key", missing: [] };

  const parsed = envSchema.safeParse({ url, anonKey });
  if (!parsed.success) {
    return { configured: false, reason: "invalid", missing: [] };
  }
  return { configured: true, url: parsed.data.url, anonKey: parsed.data.anonKey };
}
