import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));

import { checkConnectionAction } from "@/app/configuracion/actions";

function serverClient(user: unknown, profile: unknown) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: profile, error: null });
  return { auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: "x" } }) }, from: () => b } as unknown as SupabaseClient;
}

beforeEach(() => {
  mocks.server.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
});

describe("checkConnectionAction (autorización en el servidor)", () => {
  it("sin sesión → rechazada y sin peticiones de red", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    mocks.server.mockResolvedValue(serverClient(null, null));
    expect(await checkConnectionAction()).toEqual({ error: expect.stringContaining("profesional") });
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
  it("deportista → rechazado aunque haya invocado la acción directamente", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    mocks.server.mockResolvedValue(serverClient({ id: "u" }, { role: "athlete", is_active: true }));
    expect(await checkConnectionAction()).toEqual({ error: expect.stringContaining("profesional") });
    expect(f).not.toHaveBeenCalled();
    f.mockRestore();
  });
  it("profesional → ejecuta la comprobación (fetch simulado)", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as Response);
    mocks.server.mockResolvedValue(serverClient({ id: "u" }, { role: "professional", is_active: true }));
    const r = await checkConnectionAction();
    expect(r.steps?.[0]).toMatchObject({ name: "Servicio de autenticación", ok: true });
    f.mockRestore();
  });
});
