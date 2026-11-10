import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import { authorizeRoute, requireArea } from "@/lib/auth/guards";
import type { SessionContext } from "@/lib/auth/session";

const client = {} as SupabaseClient;
const pro: SessionContext = { mode: "authenticated", userId: "u1", role: "professional", client };
const ath: SessionContext = { mode: "authenticated", userId: "u2", role: "athlete", client };
const noSession: SessionContext = { mode: "demo", reason: "no-session" };
const noConfig: SessionContext = { mode: "demo", reason: "not-configured" };

describe("authorizeRoute: matriz sesión × rol × área", () => {
  const opts = (demoAllowed: boolean, path = "/profesional/informes") => ({ demoAllowed, path });

  it("sin configuración y demostración permitida → demostración", () => {
    expect(authorizeRoute(noConfig, "professional", opts(true))).toEqual({ action: "allow" });
    expect(authorizeRoute(noConfig, "athlete", opts(true))).toEqual({ action: "allow" });
  });
  it("sin configuración y demostración desactivada (producción) → /login, nunca datos ficticios", () => {
    expect(authorizeRoute(noConfig, "professional", opts(false))).toEqual({
      action: "redirect",
      to: "/login?next=%2Fprofesional%2Finformes",
    });
    expect(authorizeRoute(noConfig, "athlete", opts(false, "/deportista"))).toEqual({
      action: "redirect",
      to: "/login?next=%2Fdeportista",
    });
  });
  it("sin sesión y demostración permitida → permite", () => {
    expect(authorizeRoute(noSession, "professional", opts(true))).toEqual({ action: "allow" });
  });
  it("sin sesión y demostración desactivada → /login con la ruta original", () => {
    expect(authorizeRoute(noSession, "professional", opts(false))).toEqual({
      action: "redirect",
      to: "/login?next=%2Fprofesional%2Finformes",
    });
  });
  it("la ruta `next` se sanea (nada de redirecciones abiertas)", () => {
    expect(authorizeRoute(noSession, "athlete", opts(false, "//evil.com"))).toEqual({
      action: "redirect",
      to: "/login?next=%2F",
    });
  });
  it("profesional: entra al área profesional, no al área de deportista", () => {
    expect(authorizeRoute(pro, "professional", opts(true))).toEqual({ action: "allow" });
    expect(authorizeRoute(pro, "athlete", opts(true))).toEqual({ action: "redirect", to: "/acceso-denegado" });
  });
  it("deportista: entra a su área, NO al área profesional", () => {
    expect(authorizeRoute(ath, "athlete", opts(true))).toEqual({ action: "allow" });
    expect(authorizeRoute(ath, "professional", opts(true))).toEqual({ action: "redirect", to: "/acceso-denegado" });
    expect(authorizeRoute(ath, "professional", opts(false))).toEqual({ action: "redirect", to: "/acceso-denegado" });
  });
});

describe("requireArea (con sesión real simulada)", () => {
  beforeEach(() => {
    mocks.server.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
  });
  const serverClient = (user: unknown, profile: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) b[m] = () => b;
    b.maybeSingle = async () => ({ data: profile, error: null });
    return { auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: "x" } }) }, from: () => b };
  };

  it("un deportista que pide /profesional es enviado a /acceso-denegado", async () => {
    mocks.server.mockResolvedValue(serverClient({ id: "u2", user_metadata: { role: "professional" } }, { role: "athlete", is_active: true }));
    await expect(requireArea("professional", "/profesional")).rejects.toThrow("NEXT_REDIRECT:/acceso-denegado");
  });
  it("un profesional activo accede a /profesional", async () => {
    mocks.server.mockResolvedValue(serverClient({ id: "u1" }, { role: "professional", is_active: true }));
    await expect(requireArea("professional", "/profesional")).resolves.toMatchObject({ mode: "authenticated", role: "professional" });
  });
  it("sin sesión y APP_ALLOW_DEMO=false → /login", async () => {
    vi.stubEnv("APP_ALLOW_DEMO", "false");
    mocks.server.mockResolvedValue(serverClient(null, null));
    await expect(requireArea("professional", "/profesional")).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fprofesional");
  });
  it("sin sesión y demostración permitida → modo demostración", async () => {
    mocks.server.mockResolvedValue(serverClient(null, null));
    await expect(requireArea("professional", "/profesional")).resolves.toEqual({ mode: "demo", reason: "no-session" });
  });
  it("perfil inactivo con sesión válida de Auth → /acceso-denegado (con o sin demostración permitida)", async () => {
    for (const allow of ["false", "true"]) {
      vi.stubEnv("APP_ALLOW_DEMO", allow);
      mocks.server.mockResolvedValue(serverClient({ id: "u1" }, { role: "professional", is_active: false }));
      await expect(requireArea("professional", "/profesional")).rejects.toThrow("NEXT_REDIRECT:/acceso-denegado");
    }
  });
});
