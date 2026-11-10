import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEMO_ATHLETES } from "@/data/demo/athletes";
import { canManageRoster, getSessionContext, type SessionContext } from "@/lib/auth/session";
import { statusFromProgress } from "@/lib/status";
import { DAILY_SECTION_TABLES } from "@/types/database";
import type { AthleteSummary } from "@/types";
import { fail, ok, type DataResult } from "./result";

const NO_TEAM = "Sin equipo";
const NO_CATEGORY = "Sin categoría";

/** Fecha de hoy (AAAA-MM-DD) en la zona horaria de la app. */
export function todayISO(timeZone = process.env.APP_TIME_ZONE ?? "America/Argentina/Buenos_Aires", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// PostgREST devuelve objeto en relaciones muchos-a-uno; se tolera también un arreglo de un elemento.
const one = <T extends z.ZodTypeAny>(schema: T) =>
  z.union([schema, z.array(schema).transform((a) => a[0] ?? null)]).nullable();

const athleteRowSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string(),
  category: one(z.object({ name: z.string() })).optional(),
  team_memberships: z
    .array(z.object({ ends_on: z.string().nullable(), team: one(z.object({ name: z.string() })).optional() }))
    .optional(),
});
export type AthleteQueryRow = z.infer<typeof athleteRowSchema>;

export type SectionsDone = Record<string, ReadonlySet<string>>; // sección → ids de deportistas con registro hoy

/** Convierte filas de la base en el resumen que usa la interfaz (función pura). */
export function mapAthleteRows(rows: readonly AthleteQueryRow[], done: SectionsDone, today: string): AthleteSummary[] {
  const sections = Object.values(done);
  return rows.map((row) => {
    const active = (row.team_memberships ?? []).find((m) => m.ends_on === null || m.ends_on >= today);
    const completed = sections.filter((s) => s.has(row.id)).length;
    return {
      id: row.id,
      displayName: row.display_name,
      team: active?.team?.name ?? NO_TEAM,
      category: row.category?.name ?? NO_CATEGORY,
      dailyStatus: statusFromProgress(completed, sections.length),
    };
  });
}

async function fetchSectionsDone(client: SupabaseClient, today: string): Promise<SectionsDone> {
  const entries = await Promise.all(
    Object.entries(DAILY_SECTION_TABLES).map(async ([section, table]) => {
      const { data, error } = await client.from(table).select("athlete_id").eq("record_date", today);
      if (error) throw error;
      return [section, new Set((data ?? []).map((r: { athlete_id: string }) => r.athlete_id))] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Lista de deportistas para el panel profesional.
 *  - Sin sesión → datos ficticios (source "demo").
 *  - Profesional autenticado → base de datos; RLS limita el resultado a sus asignados.
 *  - Deportista autenticado → "forbidden" (esta vista no es para su rol).
 */
export async function listAthletes(ctx: SessionContext, today = todayISO()): Promise<DataResult<AthleteSummary[]>> {
  if (ctx.mode === "unavailable") {
    return fail("database", "unavailable", "No se pudo verificar tu sesión. Revisa tu conexión e intenta de nuevo.");
  }
  if (ctx.mode === "demo") {
    if (ctx.reason === "expired") return fail("database", "forbidden", "Tu sesión venció. Ingresa de nuevo para continuar.");
    if (ctx.reason === "no-access") return fail("database", "forbidden", "Tu cuenta no está habilitada en la aplicación.");
    return ok("demo", [...DEMO_ATHLETES]);
  }
  if (!canManageRoster(ctx)) {
    return fail("database", "forbidden", "Tu cuenta no tiene acceso al panel profesional.");
  }
  try {
    const { data, error } = await ctx.client
      .from("athletes")
      .select("id, display_name, category:categories(name), team_memberships(ends_on, team:teams(name))")
      .eq("is_active", true)
      .order("display_name");
    if (error) throw error;
    const rows = z.array(athleteRowSchema).parse(data ?? []);
    const done = await fetchSectionsDone(ctx.client, today);
    return ok("database", mapAthleteRows(rows, done, today));
  } catch {
    // Mensaje genérico: no se filtran detalles internos al navegador.
    return fail("database", "unavailable", "No se pudieron cargar los deportistas. Intenta nuevamente.");
  }
}

/** Atajo para las páginas: resuelve la sesión y carga la lista. */
export async function loadAthletes(): Promise<DataResult<AthleteSummary[]>> {
  return listAthletes(await getSessionContext());
}
