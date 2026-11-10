import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfigWarning } from "@/components/ConfigWarning";
import { authCookieOptions } from "@/lib/supabase/cookies";
import { findExposedSecretVars, isPrivilegedSupabaseKey, readSupabaseEnv } from "@/lib/supabase/env";

// Claves SINTÉTICAS (construidas aquí, no son claves reales de ningún proyecto).
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const jwt = (role: string) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ iss: "supabase", role })}.${"s".repeat(20)}`;
const SERVICE = jwt("service_role");
const ANON = jwt("anon");
const SECRET_NEW = "sb_secret_" + "x".repeat(24);
const PUBLISHABLE = "sb_publishable_" + "p".repeat(24);
const URL_ = "https://abc.supabase.co";

describe("isPrivilegedSupabaseKey", () => {
  it("detecta service_role y sb_secret_", () => {
    expect(isPrivilegedSupabaseKey(SERVICE)).toBe(true);
    expect(isPrivilegedSupabaseKey(` ${SERVICE} `)).toBe(true);
    expect(isPrivilegedSupabaseKey(SECRET_NEW)).toBe(true);
    expect(isPrivilegedSupabaseKey(SECRET_NEW.toUpperCase().replace("X", "x"))).toBe(true);
  });
  it("acepta anon y publishable", () => {
    expect(isPrivilegedSupabaseKey(ANON)).toBe(false);
    expect(isPrivilegedSupabaseKey(PUBLISHABLE)).toBe(false);
  });
  it("tolera basura sin lanzar", () => {
    for (const v of ["", "a.b", "a.b.c", "a.!!!.c", `a.${b64url("texto")}.c`, `a.${b64url(null)}.c`, `a.${b64url([1])}.c`]) {
      expect(() => isPrivilegedSupabaseKey(v)).not.toThrow();
      expect(isPrivilegedSupabaseKey(v)).toBe(false);
    }
  });
});

describe("readSupabaseEnv rechaza claves privilegiadas", () => {
  it.each([SERVICE, SECRET_NEW])("clave privilegiada → no configurado (privileged-key)", (key) => {
    const s = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_ANON_KEY: key });
    expect(s).toEqual({ configured: false, reason: "privileged-key", missing: [] });
  });
  it("también si llega por la variable alternativa PUBLISHABLE_KEY", () => {
    const s = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SERVICE });
    expect(s).toMatchObject({ configured: false, reason: "privileged-key" });
  });
  it("anon y publishable válidas siguen funcionando; ANON_KEY tiene prioridad", () => {
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON })).toMatchObject({ configured: true, anonKey: ANON });
    expect(readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE })).toMatchObject({ configured: true, anonKey: PUBLISHABLE });
    expect(
      readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE }),
    ).toMatchObject({ anonKey: ANON });
  });
  it("el aviso no imprime la clave", () => {
    const status = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_ANON_KEY: SERVICE });
    const { container } = render(<ConfigWarning status={status} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/clave privilegiada/i);
    expect(container.innerHTML).not.toContain(SERVICE);
    expect(container.innerHTML).not.toContain(URL_);
  });
});

describe("findExposedSecretVars (solo nombres, nunca valores)", () => {
  it("marca NEXT_PUBLIC_* con nombre de secreto o con valor privilegiado", () => {
    const found = findExposedSecretVars({
      NEXT_PUBLIC_SUPABASE_URL: URL_,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: "lo-que-sea",
      NEXT_PUBLIC_DB_PASSWORD: "x",
      NEXT_PUBLIC_OTRA: SECRET_NEW,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE, // sin prefijo público: no llega al navegador
      DATABASE_URL: "postgres://a:b@c/d",
    });
    expect(found).toEqual(["NEXT_PUBLIC_DB_PASSWORD", "NEXT_PUBLIC_OTRA", "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY"]);
    expect(JSON.stringify(found)).not.toContain(SERVICE);
  });
  it("sin hallazgos en una configuración correcta", () => {
    expect(findExposedSecretVars({ NEXT_PUBLIC_SUPABASE_URL: URL_, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE })).toEqual([]);
  });
});

describe("authCookieOptions", () => {
  it("httpOnly y SameSite=Lax; Secure solo en producción", () => {
    expect(authCookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(authCookieOptions(false)).toMatchObject({ httpOnly: true, secure: false });
  });
});
