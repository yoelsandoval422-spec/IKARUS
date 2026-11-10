// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, MIGRATIONS_DIR, readAdminScript } from "./harness";

/**
 * Migración 04 y comprobaciones transversales de aislamiento entre deportistas.
 * Se ejecutan contra PostgreSQL real (PGlite) con las migraciones reales.
 */
const U = {
  a: "00000000-0000-4000-8000-0000000001a1", // deportista A
  b: "00000000-0000-4000-8000-0000000001b1", // deportista B
  p1: "00000000-0000-4000-8000-0000000001c1", // profesional asignado a A
  p2: "00000000-0000-4000-8000-0000000001c2", // profesional asignado a B
  p3: "00000000-0000-4000-8000-0000000001c3", // profesional sin asignaciones
  x: "00000000-0000-4000-8000-0000000001d1", // usuario sin ficha
};
const A = "00000000-0000-4000-8000-00000001aa01";
const B = "00000000-0000-4000-8000-00000001bb01";
const ZERO = "00000000-0000-0000-0000-000000000000";

const TABLES = [
  "wellbeing_records", "nutrition_records", "hydration_records", "training_records",
  "performance_records", "professional_notes", "anthropometric_evaluations",
  "anthropometric_measurements", "team_memberships",
] as const;

let db: PGlite;
const rows = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows;
const as = <T>(uid: string | null, fn: () => Promise<T>) => asUser(db, uid, fn);
const count = async (table: string) => Number((await rows(`select count(*)::int as n from public.${table}`))[0]?.n);

beforeAll(async () => {
  db = await createDatabase();
  await db.exec(`
    insert into auth.users (id, email) values
      ('${U.a}','a@h.test'), ('${U.b}','b@h.test'), ('${U.p1}','p1@h.test'),
      ('${U.p2}','p2@h.test'), ('${U.p3}','p3@h.test'), ('${U.x}','x@h.test');
  `);
  for (const e of ["p1@h.test", "p2@h.test", "p3@h.test"]) {
    await db.exec(readAdminScript("01_promover_profesional.sql", { REEMPLAZAR_CORREO_PROFESIONAL: e }));
  }
  await db.exec(`insert into public.athletes (id, display_name) values ('${A}','Atleta A'), ('${B}','Atleta B')`);
  await db.exec(readAdminScript("03_vincular_cuenta_deportista.sql", { REEMPLAZAR_CORREO_DEPORTISTA: "a@h.test", [ZERO]: A }));
  await db.exec(readAdminScript("03_vincular_cuenta_deportista.sql", { REEMPLAZAR_CORREO_DEPORTISTA: "b@h.test", [ZERO]: B }));
  await db.exec(readAdminScript("02_asignar_deportista.sql", { REEMPLAZAR_CORREO_PROFESIONAL: "p1@h.test", [ZERO]: A }));
  await db.exec(readAdminScript("02_asignar_deportista.sql", { REEMPLAZAR_CORREO_PROFESIONAL: "p2@h.test", [ZERO]: B }));

  // Datos privados SOLO del deportista B (insertados por el servidor).
  await db.exec(`
    insert into public.wellbeing_records (athlete_id, record_date, sleep_hours, created_by) values ('${B}', current_date, 7, '${U.b}');
    insert into public.nutrition_records (athlete_id, record_date, meal, description, created_by) values ('${B}', current_date, 'lunch', 'Almuerzo B', '${U.b}');
    insert into public.hydration_records (athlete_id, record_date, total_ml, created_by) values ('${B}', current_date, 2000, '${U.b}');
    insert into public.training_records (athlete_id, record_date, duration_min, created_by) values ('${B}', current_date, 60, '${U.b}');
    insert into public.performance_records (athlete_id, record_date, metric_code, value, unit, created_by) values ('${B}', current_date, 'cmj', 31, 'cm', '${U.p2}');
    insert into public.professional_notes (athlete_id, body, shared_with_athlete, created_by) values
      ('${B}', 'Nota privada de B', false, '${U.p2}'), ('${B}', 'Nota compartida de B', true, '${U.p2}');
    insert into public.anthropometric_evaluations (id, athlete_id, evaluated_on, created_by) values
      ('00000000-0000-4000-8000-0000000eeb01', '${B}', current_date, '${U.p2}');
    insert into public.anthropometric_measurements (evaluation_id, variable_code, value, unit) values
      ('00000000-0000-4000-8000-0000000eeb01', 'peso', 70, 'kg');
    insert into public.teams (id, name, season) values ('00000000-0000-4000-8000-0000000ee001', 'Equipo X', '2026');
    insert into public.team_memberships (athlete_id, team_id) values ('${B}', '00000000-0000-4000-8000-0000000ee001');
  `);
});

afterAll(async () => {
  await db.close();
});

describe("migración 04", () => {
  it("in_edit_window es STABLE (no IMMUTABLE: depende de current_date)", async () => {
    const r = await rows(`select provolatile from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.proname='in_edit_window'`);
    expect(r).toEqual([{ provolatile: "s" }]);
  });

  it("crea el perfil de usuarios anteriores a la migración 01, siempre como athlete, y es repetible", async () => {
    // Simula un usuario creado antes de las migraciones: sin perfil y con metadatos que piden rol profesional.
    await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
      ('00000000-0000-4000-8000-0000000001e1', 'viejo@h.test', '{"role":"professional","full_name":"Viejo"}')`);
    await db.exec(`delete from public.profiles where id='00000000-0000-4000-8000-0000000001e1'`);
    const sql04 = readFileSync(path.join(MIGRATIONS_DIR, "20261027100000_auth_hardening.sql"), "utf8");
    await db.exec(sql04);
    await db.exec(sql04); // idempotente
    const r = await rows(`select role, display_name from public.profiles where id='00000000-0000-4000-8000-0000000001e1'`);
    expect(r).toEqual([{ role: "athlete", display_name: "Viejo" }]);
  });

  it("anon no puede usar el schema private ni ejecutar sus funciones (salvo triggers)", async () => {
    const usage = await rows(`select has_schema_privilege('anon','private','usage') as u`);
    expect(usage[0]?.u).toBe(false);
    // has_function_privilege('anon') también es true si el privilegio llega por PUBLIC.
    const exposed = await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='private' and p.prorettype <> 'trigger'::regtype
        and has_function_privilege('anon', p.oid, 'execute')`);
    expect(exposed).toEqual([]);
  });
});

describe("aislamiento entre deportistas (lectura cruzada)", () => {
  it.each(TABLES)("%s: el deportista A, su profesional (p1), un profesional sin asignaciones y un usuario sin ficha ven 0 filas de B", async (table) => {
    for (const uid of [U.a, U.p1, U.p3, U.x]) {
      expect(await as(uid, () => count(table))).toBe(0);
    }
  });

  it.each(TABLES)("%s: sin sesión (anon) no hay acceso", async (table) => {
    await as(null, async () => {
      await expect(db.query(`select * from public.${table}`)).rejects.toThrow(/permission denied/);
    });
  });

  it.each(TABLES)("%s: control positivo: el deportista B y su profesional (p2) sí ven sus datos", async (table) => {
    expect(await as(U.p2, () => count(table))).toBeGreaterThan(0);
    expect(await as(U.b, () => count(table))).toBeGreaterThan(0);
  });

  it("el deportista B ve solo las observaciones compartidas", async () => {
    const n = await as(U.b, () => rows(`select body from public.professional_notes`));
    expect(n).toEqual([{ body: "Nota compartida de B" }]);
  });

  it("athletes y professional_athletes: cada usuario ve solo lo suyo", async () => {
    expect(await as(U.a, () => rows(`select id from public.athletes`))).toEqual([{ id: A }]);
    expect(await as(U.b, () => rows(`select id from public.athletes`))).toEqual([{ id: B }]);
    expect(await as(U.p1, () => rows(`select id from public.athletes`))).toEqual([{ id: A }]);
    expect(await as(U.p3, () => rows(`select id from public.athletes`))).toEqual([]);
    expect(await as(U.x, () => rows(`select id from public.athletes`))).toEqual([]);
    expect(await as(U.p1, () => rows(`select athlete_id from public.professional_athletes`))).toEqual([{ athlete_id: A }]);
    expect(await as(U.a, () => rows(`select * from public.professional_athletes`))).toEqual([]);
  });

  it("perfiles: nadie lee el perfil de otro usuario", async () => {
    for (const uid of [U.a, U.p1, U.x]) {
      const r = await as(uid, () => rows(`select id from public.profiles`));
      expect(r).toEqual([{ id: uid }]);
    }
  });
});

describe("escalada de privilegios (deportista → profesional)", () => {
  it("ninguna vía de escritura permite que un deportista obtenga el rol o una asignación", async () => {
    await as(U.a, async () => {
      for (const sql of [
        `update public.profiles set role='professional' where id='${U.a}'`,
        `insert into public.professional_athletes (professional_id, athlete_id) values ('${U.a}','${B}')`,
        `update public.athletes set user_id='${U.a}' where id='${B}'`,
        `insert into public.athletes (display_name, user_id) values ('Falso', '${U.a}')`,
        `insert into public.athletes (display_name) values ('Falso sin ser profesional')`,
        `insert into public.professional_notes (athlete_id, body, created_by) values ('${A}', 'x', '${U.a}')`,
        `insert into public.teams (name) values ('Equipo pirata')`,
      ]) {
        await expect(db.query(sql), sql).rejects.toThrow();
      }
    });
    expect((await rows(`select role from public.profiles where id='${U.a}'`))[0]?.role).toBe("athlete");
    expect(await rows(`select 1 from public.professional_athletes where professional_id='${U.a}'`)).toEqual([]);
  });

  it("un profesional no puede asignarse a sí mismo un deportista ajeno ni leer sus datos", async () => {
    await as(U.p1, async () => {
      await expect(db.query(`insert into public.professional_athletes (professional_id, athlete_id) values ('${U.p1}','${B}')`)).rejects.toThrow();
    });
    expect(await as(U.p1, () => count("wellbeing_records"))).toBe(0);
  });
});
