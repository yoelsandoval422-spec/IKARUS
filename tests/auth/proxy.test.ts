// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: mocks.create }));

import { updateSession } from "@/lib/supabase/proxy";
import { readSupabaseEnv } from "@/lib/supabase/env";

const configured = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40) });
const notConfigured = readSupabaseEnv({});
const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, cookie ? { headers: { cookie } } : undefined);

type Opts = { cookies: { getAll: () => unknown; setAll: (c: unknown[], h: Record<string, string>) => void } };

/** Cliente falso: getClaims puede renovar la sesión llamando a setAll, como hace @supabase/ssr. */
function stubClient(claims: unknown, onClaims?: (o: Opts) => void, throws = false) {
  mocks.create.mockImplementation((_url: string, _key: string, o: Opts) => ({
    auth: {
      getClaims: async () => {
        if (throws) throw new Error("red");
        onClaims?.(o);
        return { data: claims ? { claims } : null, error: claims ? null : { message: "sin sesión" } };
      },
    },
  }));
}

beforeEach(() => mocks.create.mockReset());

describe("proxy.ts · updateSession", () => {
  it("sin configuración no crea cliente ni toca nada", async () => {
    const res = await updateSession(req("/profesional"), notConfigured, false);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("con sesión válida deja pasar", async () => {
    stubClient({ sub: "u1" });
    const res = await updateSession(req("/profesional"), configured, false);
    expect(res.headers.get("location")).toBeNull();
  });

  it("renovación: las cookies nuevas viajan a la respuesta (y a la petición) con cabeceras anti-caché", async () => {
    stubClient({ sub: "u1" }, (o) =>
      o.cookies.setAll([{ name: "sb-token", value: "nuevo", options: { path: "/", httpOnly: true } }], { "Cache-Control": "private, no-cache, no-store, must-revalidate" }),
    );
    const request = req("/profesional", "sb-token=viejo");
    const res = await updateSession(request, configured, true);
    expect(res.cookies.get("sb-token")?.value).toBe("nuevo");
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(request.cookies.get("sb-token")?.value).toBe("nuevo");
  });

  it("lee las cookies de la petición", async () => {
    let seen: unknown;
    stubClient({ sub: "u1" }, (o) => {
      seen = o.cookies.getAll();
    });
    await updateSession(req("/", "sb-a=1; sb-b=2"), configured, true);
    expect(seen).toEqual(expect.arrayContaining([expect.objectContaining({ name: "sb-a", value: "1" })]));
  });

  it("sin sesión y demostración permitida → deja pasar", async () => {
    stubClient(null);
    const res = await updateSession(req("/profesional"), configured, true);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sin sesión y demostración desactivada → redirige rutas protegidas a /login con next", async () => {
    stubClient(null);
    const res = await updateSession(req("/profesional/informes?a=1"), configured, false);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/login?next=%2Fprofesional%2Finformes%3Fa%3D1");
    const res2 = await updateSession(req("/deportista"), configured, false);
    expect(res2.headers.get("location")).toBe("http://localhost/login?next=%2Fdeportista");
  });

  it("rutas públicas no se redirigen aunque no haya sesión", async () => {
    stubClient(null);
    for (const p of ["/", "/login", "/configuracion"]) {
      const res = await updateSession(req(p), configured, false);
      expect(res.headers.get("location"), p).toBeNull();
    }
  });

  it("si la red falla al validar la sesión no rompe: deja pasar o redirige según el modo", async () => {
    stubClient(null, undefined, true);
    expect((await updateSession(req("/profesional"), configured, true)).headers.get("location")).toBeNull();
    expect((await updateSession(req("/profesional"), configured, false)).status).toBe(307);
  });
});
