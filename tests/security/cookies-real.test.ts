// @vitest-environment node
import { createServerClient } from "@supabase/ssr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authCookieOptions } from "@/lib/supabase/cookies";

/**
 * Usa la librería REAL @supabase/ssr (sin mockearla) con un `fetch` simulado, para comprobar que
 * las opciones de cookie que pedimos llegan de verdad a `setAll`. No contacta a ningún servidor.
 */
const b64url = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const exp = Math.floor(Date.now() / 1000) + 3600;
const ACCESS = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "u1", role: "authenticated", exp, aal: "aal1", session_id: "s1" })}.c2lnbmF0dXJl`;
const USER = { id: "u1", aud: "authenticated", role: "authenticated", email: "t@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

afterEach(() => vi.unstubAllGlobals());

async function capture(production: boolean) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } })));
  const written: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const supabase = createServerClient("https://abc.supabase.co", "a".repeat(40), {
    cookieOptions: authCookieOptions(production),
    cookies: {
      getAll: () => [],
      setAll: (items) => {
        for (const i of items) written.push({ name: i.name, value: i.value, options: { ...i.options } });
      },
    },
  });
  await supabase.auth.setSession({ access_token: ACCESS, refresh_token: "refresh-sintetico" });
  return written;
}

describe("@supabase/ssr real: opciones de las cookies de sesión", () => {
  it("las cookies de sesión se escriben httpOnly, SameSite=Lax y Secure en producción", async () => {
    const written = await capture(true);
    const auth = written.filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value !== "");
    expect(auth.length).toBeGreaterThan(0);
    for (const c of auth) {
      expect(c.options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    }
  });
  it("en desarrollo (http) no se exige Secure pero sigue httpOnly", async () => {
    const written = await capture(false);
    const auth = written.filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value !== "");
    expect(auth.length).toBeGreaterThan(0);
    for (const c of auth) expect(c.options).toMatchObject({ httpOnly: true, secure: false });
  });
  it("sin nuestras opciones la librería usaría httpOnly:false (por eso se fuerzan)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(USER), { status: 200, headers: { "content-type": "application/json" } })));
    const written: { options: Record<string, unknown>; name: string; value: string }[] = [];
    const supabase = createServerClient("https://abc.supabase.co", "a".repeat(40), {
      cookies: { getAll: () => [], setAll: (items) => { for (const i of items) written.push({ name: i.name, value: i.value, options: { ...i.options } }); } },
    });
    await supabase.auth.setSession({ access_token: ACCESS, refresh_token: "r" });
    const auth = written.filter((c) => /^sb-.+-auth-token/.test(c.name) && c.value !== "");
    expect(auth.length).toBeGreaterThan(0);
    expect(auth[0]?.options.httpOnly).toBe(false);
  });
});
