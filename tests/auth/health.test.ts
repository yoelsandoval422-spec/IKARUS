import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import { readSupabaseEnv } from "@/lib/supabase/env";

const KEY = "sb_publishable_" + "k".repeat(30);
const URL = "https://proyecto-secreto.supabase.co";
const status = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY });
const res = (code: number) => ({ ok: code >= 200 && code < 300, status: code }) as Response;
const client = (error: unknown) =>
  ({ from: () => ({ select: async () => ({ error }) }) }) as unknown as SupabaseClient;

describe("checkSupabaseConnection (con fetch simulado; NO contacta a Supabase real)", () => {
  it("sin configuración informa que falta configurar y no hace peticiones", async () => {
    const f = vi.fn();
    const r = await checkSupabaseConnection(readSupabaseEnv({}), null, f as unknown as typeof fetch);
    expect(r[0]).toMatchObject({ ok: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("todo correcto", async () => {
    const f = vi.fn(async () => res(200));
    const r = await checkSupabaseConnection(status, client(null), f as unknown as typeof fetch);
    expect(r.map((s) => s.ok)).toEqual([true, true]);
    expect(f).toHaveBeenCalledWith(`${URL}/auth/v1/health`, expect.objectContaining({ headers: { apikey: KEY } }));
  });
  it("clave rechazada (401)", async () => {
    const r = await checkSupabaseConnection(status, null, (async () => res(401)) as unknown as typeof fetch);
    expect(r).toEqual([expect.objectContaining({ ok: false, message: expect.stringContaining("rechazó la clave") })]);
  });
  it("respuesta inesperada", async () => {
    const r = await checkSupabaseConnection(status, null, (async () => res(502)) as unknown as typeof fetch);
    expect(r[0]).toMatchObject({ ok: false, message: expect.stringContaining("502") });
  });
  it("proyecto inalcanzable: corta ahí y no consulta tablas", async () => {
    const c = client(null);
    const spy = vi.spyOn(c, "from");
    const r = await checkSupabaseConnection(status, c, (async () => { throw new TypeError("fetch failed"); }) as unknown as typeof fetch);
    expect(r).toHaveLength(1);
    expect(r[0]?.ok).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
  it("migraciones no aplicadas: la lectura de categorías falla", async () => {
    const r = await checkSupabaseConnection(status, client({ code: "PGRST205" }), (async () => res(200)) as unknown as typeof fetch);
    expect(r[1]).toMatchObject({ name: "Migraciones y permisos", ok: false });
  });
  it("jamás incluye la URL ni la clave en los mensajes", async () => {
    for (const f of [async () => res(200), async () => res(401), async () => { throw new Error(URL + KEY); }]) {
      const r = await checkSupabaseConnection(status, client({ message: URL + KEY }), f as unknown as typeof fetch);
      const text = JSON.stringify(r);
      expect(text).not.toContain(KEY);
      expect(text).not.toContain("proyecto-secreto");
    }
  });
});
