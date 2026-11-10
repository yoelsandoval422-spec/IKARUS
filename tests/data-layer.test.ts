import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ server: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: mocks.server }));

import { DEMO_ATHLETES } from "@/data/demo/athletes";
import { canManageRoster, getSessionContext, type SessionContext } from "@/lib/auth/session";
import { listAthletes, mapAthleteRows, todayISO } from "@/lib/data/athletes";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ID3 = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-10-20";

type Res = { data: unknown; error: unknown };
function fakeClient(tables: Record<string, Res>) {
  const from = vi.fn((table: string) => {
    const res = tables[table] ?? { data: [], error: null };
    const b: Record<string, unknown> = {};
    for (const m of ["select", "eq", "order"]) b[m] = () => b;
    b.then = (resolve: (r: Res) => unknown) => resolve(res);
    return b;
  });
  return { client: { from } as unknown as SupabaseClient, from };
}
const pro = (client: SupabaseClient): SessionContext => ({ mode: "authenticated", userId: ID1, role: "professional", client });
const athlete = (client: SupabaseClient): SessionContext => ({ mode: "authenticated", userId: ID2, role: "athlete", client });

const rows = [
  { id: ID1, display_name: "Ana", category: { name: "Juvenil" }, team_memberships: [{ ends_on: null, team: { name: "Norte" } }] },
  { id: ID2, display_name: "Beto", category: [{ name: "Adulto" }], team_memberships: [{ ends_on: "2026-01-01", team: { name: "Viejo" } }] },
  { id: ID3, display_name: "Cami", category: null, team_memberships: [] },
];
const ids = (...v: string[]) => v.map((athlete_id) => ({ athlete_id }));

describe("capa de datos de deportistas", () => {
  it("sin sesión devuelve datos de demostración marcados como demo", async () => {
    const r = await listAthletes({ mode: "demo", reason: "no-session" });
    expect(r.ok && r.source).toBe("demo");
    expect(r.ok && r.data).toHaveLength(DEMO_ATHLETES.length);
  });

  it("un deportista autenticado recibe 'forbidden' y no se consulta la base", async () => {
    const { client, from } = fakeClient({});
    const r = await listAthletes(athlete(client), TODAY);
    expect(r).toMatchObject({ ok: false, error: "forbidden", source: "database" });
    expect(from).not.toHaveBeenCalled();
  });

  it("un profesional recibe filas de la base con estado diario derivado", async () => {
    const { client } = fakeClient({
      athletes: { data: rows, error: null },
      wellbeing_records: { data: ids(ID1, ID3), error: null },
      nutrition_records: { data: ids(ID1), error: null },
      hydration_records: { data: ids(ID1), error: null },
      training_records: { data: ids(ID1), error: null },
    });
    const r = await listAthletes(pro(client), TODAY);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.source).toBe("database");
    expect(r.data.map((a) => [a.displayName, a.team, a.category, a.dailyStatus])).toEqual([
      ["Ana", "Norte", "Juvenil", "completed"],
      ["Beto", "Sin equipo", "Adulto", "pending"], // membresía cerrada; relación como arreglo
      ["Cami", "Sin equipo", "Sin categoría", "in_progress"],
    ]);
  });

  it("un error de la base devuelve mensaje genérico sin detalles internos", async () => {
    const { client } = fakeClient({ athletes: { data: null, error: { message: "relation secret_table does not exist" } } });
    const r = await listAthletes(pro(client), TODAY);
    expect(r).toMatchObject({ ok: false, error: "unavailable" });
    expect(JSON.stringify(r)).not.toContain("secret_table");
  });

  it("filas con forma inesperada no se muestran (validación Zod)", async () => {
    const { client } = fakeClient({ athletes: { data: [{ id: "no-uuid", display_name: 5 }], error: null } });
    expect(await listAthletes(pro(client), TODAY)).toMatchObject({ ok: false, error: "unavailable" });
  });

  it("mapAthleteRows es puro y tolera relaciones ausentes", () => {
    const out = mapAthleteRows([{ id: ID1, display_name: "Ana" }], {}, TODAY);
    expect(out[0]).toMatchObject({ team: "Sin equipo", category: "Sin categoría", dailyStatus: "pending" });
  });

  it("todayISO usa la zona horaria indicada", () => {
    const instant = new Date("2026-10-21T01:30:00Z"); // en Buenos Aires aún es 20/10
    expect(todayISO("America/Argentina/Buenos_Aires", instant)).toBe("2026-10-20");
    expect(todayISO("UTC", instant)).toBe("2026-10-21");
  });
});

describe("sesión en el servidor", () => {
  beforeEach(() => {
    mocks.server.mockReset();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "a".repeat(40));
  });

  function serverClient(user: unknown, profile: unknown) {
    const builder: Record<string, unknown> = {};
    for (const m of ["select", "eq"]) builder[m] = () => builder;
    builder.maybeSingle = async () => ({ data: profile, error: null });
    return {
      auth: { getUser: async () => ({ data: { user }, error: user ? null : { message: "sin sesión" } }) },
      from: () => builder,
    };
  }

  it("sin variables de entorno → demostración (no toca cookies)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    expect(await getSessionContext()).toEqual({ mode: "demo", reason: "not-configured" });
    expect(mocks.server).not.toHaveBeenCalled();
  });
  it("sin usuario → demostración", async () => {
    mocks.server.mockResolvedValue(serverClient(null, null));
    expect(await getSessionContext()).toEqual({ mode: "demo", reason: "no-session" });
  });
  it("el rol sale de la tabla profiles, no de los metadatos del usuario", async () => {
    mocks.server.mockResolvedValue(
      serverClient({ id: ID2, user_metadata: { role: "professional" } }, { role: "athlete", is_active: true }),
    );
    const ctx = await getSessionContext();
    expect(ctx).toMatchObject({ mode: "authenticated", role: "athlete", userId: ID2 });
    expect(canManageRoster(ctx)).toBe(false);
  });
  it("profesional activo puede gestionar el plantel", async () => {
    mocks.server.mockResolvedValue(serverClient({ id: ID1 }, { role: "professional", is_active: true }));
    expect(canManageRoster(await getSessionContext())).toBe(true);
  });
  it("perfil inactivo, inexistente o con rol inválido → cuenta sin acceso (no datos, no demostración silenciosa)", async () => {
    for (const profile of [{ role: "professional", is_active: false }, null, { role: "admin", is_active: true }]) {
      mocks.server.mockResolvedValue(serverClient({ id: ID1 }, profile));
      expect(await getSessionContext()).toEqual({ mode: "demo", reason: "no-access" });
    }
  });
});
