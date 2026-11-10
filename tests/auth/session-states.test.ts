import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import { classifyAuthFailure } from "@/lib/auth/errors";
import { authorizeRoute, requireArea } from "@/lib/auth/guards";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { listAthletes } from "@/lib/data/athletes";

const ID = "11111111-1111-4111-8111-111111111111";
const client = {} as SupabaseClient;

describe("classifyAuthFailure", () => {
  it.each([
    [null, "no-session"],
    [undefined, "no-session"],
    [{ name: "AuthSessionMissingError", status: 400 }, "no-session"],
    [{ message: "sin sesión" }, "no-session"],
    [{ name: "AuthApiError", status: 400, code: "validation_failed" }, "no-session"],
    [{ name: "AuthApiError", status: 400, code: "refresh_token_not_found" }, "expired"],
    [{ name: "AuthApiError", status: 400, code: "refresh_token_already_used" }, "expired"],
    [{ name: "AuthApiError", status: 403, code: "session_not_found" }, "expired"],
    [{ name: "AuthApiError", status: 401, code: "bad_jwt" }, "expired"],
    [{ name: "AuthApiError", status: 401 }, "expired"],
    [{ name: "AuthInvalidJwtError" }, "expired"],
    [{ name: "AuthRetryableFetchError", status: 0 }, "unavailable"],
    [{ name: "AuthRetryableFetchError", status: 503 }, "unavailable"],
    [{ name: "AuthApiError", status: 500 }, "unavailable"],
    [{ status: 0 }, "unavailable"],
  ])("%j → %s", (error, expected) => expect(classifyAuthFailure(error)).toBe(expected));
});

describe("getSessionContext: estados que NO son 'sin sesión'", () => {
  beforeEach(() => {
    mocks.server.mockReset();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
  });

  const builder = (result: { data: unknown; error: unknown } | "throw") => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) b[m] = () => b;
    b.maybeSingle = async () => {
      if (result === "throw") throw new TypeError("fetch failed");
      return result;
    };
    return b;
  };
  const make = (getUser: () => Promise<unknown>, profile: { data: unknown; error: unknown } | "throw" = { data: null, error: null }) =>
    ({ auth: { getUser }, from: () => builder(profile) }) as unknown as SupabaseClient;

  it("token vencido o revocado → 'expired'", async () => {
    mocks.server.mockResolvedValue(
      make(async () => ({ data: { user: null }, error: { name: "AuthApiError", status: 400, code: "refresh_token_not_found", message: "x" } })),
    );
    expect(await getSessionContext()).toEqual({ mode: "demo", reason: "expired" });
  });

  it("servicio de Auth caído → 'unavailable' (no se confunde con sin sesión)", async () => {
    mocks.server.mockResolvedValue(
      make(async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } })),
    );
    expect(await getSessionContext()).toEqual({ mode: "unavailable" });
  });

  it("getUser lanza una excepción → 'unavailable'", async () => {
    mocks.server.mockResolvedValue(make(async () => { throw new TypeError("fetch failed"); }));
    expect(await getSessionContext()).toEqual({ mode: "unavailable" });
  });

  it("falla la consulta del perfil (red/5xx) → 'unavailable', no 'sin acceso'", async () => {
    mocks.server.mockResolvedValue(make(async () => ({ data: { user: { id: ID } }, error: null }), { data: null, error: { code: "500" } }));
    expect(await getSessionContext()).toEqual({ mode: "unavailable" });
    mocks.server.mockResolvedValue(make(async () => ({ data: { user: { id: ID } }, error: null }), "throw"));
    expect(await getSessionContext()).toEqual({ mode: "unavailable" });
  });

  it("perfil inexistente → 'no-access'", async () => {
    mocks.server.mockResolvedValue(make(async () => ({ data: { user: { id: ID } }, error: null }), { data: null, error: null }));
    expect(await getSessionContext()).toEqual({ mode: "demo", reason: "no-access" });
  });
});

describe("authorizeRoute con los estados nuevos", () => {
  const opts = (demoAllowed: boolean) => ({ demoAllowed, path: "/profesional/informes" });
  const ctxExpired: SessionContext = { mode: "demo", reason: "expired" };
  const ctxNoAccess: SessionContext = { mode: "demo", reason: "no-access" };
  const ctxDown: SessionContext = { mode: "unavailable" };

  it("servicio no disponible → /sin-conexion con la ruta para reintentar; nunca 'allow'", () => {
    for (const area of ["professional", "athlete"] as const) {
      for (const demoAllowed of [true, false]) {
        expect(authorizeRoute(ctxDown, area, opts(demoAllowed))).toEqual({
          action: "redirect",
          to: "/sin-conexion?next=%2Fprofesional%2Finformes",
        });
      }
    }
  });
  it("sesión vencida → /login con aviso, aunque la demostración esté permitida", () => {
    for (const demoAllowed of [true, false]) {
      expect(authorizeRoute(ctxExpired, "professional", opts(demoAllowed))).toEqual({
        action: "redirect",
        to: "/login?next=%2Fprofesional%2Finformes&motivo=sesion-vencida",
      });
    }
  });
  it("cuenta sin acceso → /acceso-denegado siempre", () => {
    for (const demoAllowed of [true, false]) {
      expect(authorizeRoute(ctxNoAccess, "athlete", opts(demoAllowed))).toEqual({ action: "redirect", to: "/acceso-denegado" });
    }
  });
  it("el `next` de los redireccionamientos nuevos también se sanea", () => {
    expect(authorizeRoute(ctxDown, "athlete", { demoAllowed: true, path: "//evil.com" })).toEqual({
      action: "redirect",
      to: "/sin-conexion?next=%2F",
    });
  });
});

describe("requireArea (flujo completo)", () => {
  beforeEach(() => {
    mocks.server.mockReset();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
  });
  it("con el servicio de Auth caído nunca muestra datos ni demostración", async () => {
    mocks.server.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } }) },
    });
    await expect(requireArea("professional", "/profesional")).rejects.toThrow("NEXT_REDIRECT:/sin-conexion?next=%2Fprofesional");
  });
});

describe("capa de datos con estados de sesión inválidos", () => {
  it("'unavailable' → error de conexión, sin consultar la base ni devolver demo", async () => {
    const r = await listAthletes({ mode: "unavailable" });
    expect(r).toMatchObject({ ok: false, error: "unavailable" });
  });
  it.each(["expired", "no-access"] as const)("demo/%s → 'forbidden' (no se entregan datos ficticios)", async (reason) => {
    const r = await listAthletes({ mode: "demo", reason });
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
  });
  it.each(["not-configured", "no-session"] as const)("demo/%s → datos de demostración", async (reason) => {
    const r = await listAthletes({ mode: "demo", reason });
    expect(r).toMatchObject({ ok: true, source: "demo" });
  });
  it("un deportista autenticado no obtiene la lista (se prueba también con cliente real simulado)", async () => {
    const r = await listAthletes({ mode: "authenticated", userId: ID, role: "athlete", client });
    expect(r).toMatchObject({ ok: false, error: "forbidden" });
  });
});
