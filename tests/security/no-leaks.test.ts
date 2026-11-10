import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  },
}));

import { signInAction } from "@/app/login/actions";
import { checkSupabaseConnection } from "@/lib/supabase/health";
import { readSupabaseEnv } from "@/lib/supabase/env";
import { listAthletes } from "@/lib/data/athletes";

/** Datos que jamás deben aparecer en respuestas ni en la consola (mensajes técnicos, clave, URL, contraseña). */
const SENSITIVE = ["secreta-123", "relation \"public.athletes\"", "JWT expired", "proyecto-x.supabase.co", "sb_publishable_"];
const spies = () => ["log", "info", "warn", "error", "debug"].map((m) => vi.spyOn(console, m as "log").mockImplementation(() => {}));

let consoleSpies: ReturnType<typeof spies>;
beforeEach(() => {
  mocks.server.mockReset();
  consoleSpies = spies();
});
afterEach(() => vi.restoreAllMocks());

const output = () => consoleSpies.flatMap((s) => s.mock.calls).map((c) => c.map(String).join(" ")).join("\n");
const form = (v: Record<string, string>) => {
  const f = new FormData();
  for (const [k, val] of Object.entries(v)) f.set(k, val);
  return f;
};

describe("sin fugas de información en errores y registros", () => {
  it("login fallido: ni la respuesta ni la consola contienen la contraseña ni el texto técnico original", async () => {
    mocks.server.mockResolvedValue({
      auth: {
        signInWithPassword: async () => ({
          data: { user: null },
          error: { status: 400, code: "invalid_credentials", message: "Invalid login credentials for proyecto-x.supabase.co JWT expired" },
        }),
      },
    });
    const r = await signInAction({}, form({ email: "a@b.com", password: "secreta-123" }));
    const text = JSON.stringify(r) + output();
    for (const s of SENSITIVE) expect(text).not.toContain(s);
    expect(r.error).toBe("Correo o contraseña incorrectos.");
  });

  it("login con excepción de red: mensaje genérico y consola limpia", async () => {
    mocks.server.mockResolvedValue({
      auth: { signInWithPassword: async () => { throw new TypeError("fetch failed: proyecto-x.supabase.co"); } },
    });
    const r = await signInAction({}, form({ email: "a@b.com", password: "secreta-123" }));
    const text = JSON.stringify(r) + output();
    for (const s of SENSITIVE) expect(text).not.toContain(s);
    expect(r.error).toMatch(/No se pudo conectar/);
  });

  it("falla de la base al listar deportistas: mensaje genérico, sin detalles de SQL ni consola", async () => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) b[m] = () => b;
    b.then = (resolve: (r: unknown) => unknown) => resolve({ data: null, error: { message: 'relation "public.athletes" does not exist', details: "secreta-123" } });
    const client = { from: () => b } as unknown as SupabaseClient;
    const r = await listAthletes({ mode: "authenticated", userId: "u", role: "professional", client });
    expect(r).toMatchObject({ ok: false, error: "unavailable" });
    const text = JSON.stringify(r) + output();
    for (const s of SENSITIVE) expect(text).not.toContain(s);
  });

  it("verificación de conexión: ni resultado ni consola contienen URL, clave o mensajes crudos", async () => {
    const KEY = "sb_publishable_" + "k".repeat(30);
    const status = readSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://proyecto-x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: KEY });
    const client = { from: () => ({ select: async () => ({ error: { message: 'relation "public.categories" does not exist JWT expired' } }) }) } as unknown as SupabaseClient;
    const r = await checkSupabaseConnection(status, client, (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch);
    const text = JSON.stringify(r) + output();
    for (const s of [...SENSITIVE, KEY]) expect(text).not.toContain(s);
  });

  it("el código de la aplicación no escribe en la consola (sin console.* en lib/ app/ components/)", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && /console\.(log|info|warn|error|debug)\(/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    for (const d of ["lib", "app", "components"]) walk(join(process.cwd(), d));
    expect(hits).toEqual([]);
  });
});
