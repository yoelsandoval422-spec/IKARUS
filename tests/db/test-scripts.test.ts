// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase } from "./harness";

/**
 * Ejecuta los scripts REALES de supabase/test/ contra PostgreSQL (PGlite) con las migraciones reales.
 * Comprueba que sembrar, verificar y reiniciar funcionan y que NO tocan datos que no son de prueba.
 * No prueba un proyecto de Supabase en línea.
 */
const DIR = path.resolve(import.meta.dirname, "../../supabase/test");
const script = (name: string, replacements: Record<string, string> = {}) => {
  let sql = readFileSync(path.join(DIR, name), "utf8");
  for (const [from, to] of Object.entries(replacements)) sql = sql.replaceAll(`'${from}'`, `'${to}'`);
  return sql;
};

const EMAILS = {
  REEMPLAZAR_PRO1: "pro1@t.test", REEMPLAZAR_PRO2: "pro2@t.test",
  REEMPLAZAR_ATH1: "ath1@t.test", REEMPLAZAR_ATH2: "ath2@t.test", REEMPLAZAR_ATH3: "ath3@t.test",
};
const IDS = {
  pro1: "00000000-0000-4000-8000-000000000f01", pro2: "00000000-0000-4000-8000-000000000f02",
  ath1: "00000000-0000-4000-8000-000000000f11", ath2: "00000000-0000-4000-8000-000000000f12",
  ath3: "00000000-0000-4000-8000-000000000f13", real: "00000000-0000-4000-8000-000000000f99",
};
const A1 = "7e570000-0000-4000-8000-0000000000a1";
const A2 = "7e570000-0000-4000-8000-0000000000a2";
const A3 = "7e570000-0000-4000-8000-0000000000a3";
const REAL_ATH = "00000000-0000-4000-8000-0000000000aa";

let db: PGlite;
const rows = async (sql: string) => (await db.query<Record<string, unknown>>(sql)).rows;
const num = async (sql: string) => Number((await rows(sql))[0]?.n);

beforeAll(async () => {
  db = await createDatabase();
  await db.exec(`insert into auth.users (id, email) values
    ('${IDS.pro1}','pro1@t.test'), ('${IDS.pro2}','pro2@t.test'), ('${IDS.ath1}','ath1@t.test'),
    ('${IDS.ath2}','ath2@t.test'), ('${IDS.ath3}','ath3@t.test'), ('${IDS.real}','real@t.test')`);
});
afterAll(async () => {
  await db.close();
});

describe("03_verificar_rls.sql", () => {
  it("todas las comprobaciones dan ok = true sobre las migraciones reales", async () => {
    const r = await rows(script("03_verificar_rls.sql").replace(/;\s*$/, ""));
    expect(r.length).toBeGreaterThanOrEqual(14);
    expect(r.filter((x) => x.ok !== true), JSON.stringify(r.filter((x) => x.ok !== true))).toEqual([]);
  });

  it("detecta un problema real: si se concede UPDATE sobre profiles.role, la comprobación falla", async () => {
    await db.exec("grant update (role) on public.profiles to authenticated");
    const r = await rows(script("03_verificar_rls.sql").replace(/;\s*$/, ""));
    const failed = r.filter((x) => x.ok !== true).map((x) => x.comprobacion);
    expect(failed).toContain("authenticated NO puede cambiar profiles.role");
    await db.exec("revoke update (role) on public.profiles from authenticated");
  });

  it("detecta una tabla sin RLS", async () => {
    await db.exec("create table public.tabla_expuesta (id int)");
    const r = await rows(script("03_verificar_rls.sql").replace(/;\s*$/, ""));
    expect(r.filter((x) => x.ok !== true).map((x) => x.comprobacion)).toContain("Todas las tablas de public tienen RLS activado");
    await db.exec("drop table public.tabla_expuesta");
  });
});

describe("01_sembrar_datos_de_prueba.sql", () => {
  it("se niega a correr si faltan cuentas (con los marcadores sin reemplazar)", async () => {
    await expect(db.exec(script("01_sembrar_datos_de_prueba.sql"))).rejects.toThrow(/Falta alguna cuenta de prueba/);
    expect(await num(`select count(*)::int as n from public.athletes`)).toBe(0);
  });

  it("siembra roles, fichas, asignaciones y registros", async () => {
    await db.exec(script("01_sembrar_datos_de_prueba.sql", EMAILS));
    expect(await rows(`select email, p.role from auth.users u join public.profiles p on p.id=u.id where u.email like '%@t.test' and u.email <> 'real@t.test' order by email`)).toEqual([
      { email: "ath1@t.test", role: "athlete" }, { email: "ath2@t.test", role: "athlete" }, { email: "ath3@t.test", role: "athlete" },
      { email: "pro1@t.test", role: "professional" }, { email: "pro2@t.test", role: "professional" },
    ]);
    expect(await num(`select count(*)::int as n from public.athletes where id::text like '7e570000-%'`)).toBe(3);
    expect(await num(`select count(*)::int as n from public.professional_athletes`)).toBe(3);
    expect(await num(`select count(*)::int as n from public.wellbeing_records`)).toBe(3);
  });

  it("es repetible (no duplica ni falla al ejecutarlo de nuevo)", async () => {
    await db.exec(script("01_sembrar_datos_de_prueba.sql", EMAILS));
    expect(await num(`select count(*)::int as n from public.athletes`)).toBe(3);
    expect(await num(`select count(*)::int as n from public.professional_notes`)).toBe(3);
  });

  it("los datos sembrados respetan el aislamiento: ath1 solo ve lo suyo; pro1 ve 2 deportistas; pro2, 1", async () => {
    expect(await asUser(db, IDS.ath1, () => rows(`select id from public.athletes`))).toEqual([{ id: A1 }]);
    expect(await asUser(db, IDS.ath1, () => num(`select count(*)::int as n from public.wellbeing_records where athlete_id <> '${A1}'`))).toBe(0);
    expect((await asUser(db, IDS.pro1, () => rows(`select id from public.athletes order by id`))).map((r) => r.id)).toEqual([A1, A2]);
    expect(await asUser(db, IDS.pro2, () => rows(`select id from public.athletes`))).toEqual([{ id: A3 }]);
    // el deportista 1 ve su nota compartida pero no la privada
    expect(await asUser(db, IDS.ath1, () => rows(`select body from public.professional_notes`))).toEqual([{ body: "TEST nota COMPARTIDA de TEST 1" }]);
  });

  it("pasa la verificación de seguridad con datos sembrados", async () => {
    const r = await rows(script("03_verificar_rls.sql").replace(/;\s*$/, ""));
    expect(r.filter((x) => x.ok !== true)).toEqual([]);
  });
});

describe("protección contra ejecutarlo en un proyecto con datos reales", () => {
  it("el sembrado aborta si existe un deportista que no es de prueba", async () => {
    await db.exec(`insert into public.athletes (id, display_name) values ('${REAL_ATH}', 'Deportista REAL')`);
    await expect(db.exec(script("01_sembrar_datos_de_prueba.sql", EMAILS))).rejects.toThrow(/NO son de prueba/);
  });

  it("el reinicio NO toca al deportista real ni a sus datos; solo borra los de prueba", async () => {
    await db.exec(`insert into public.wellbeing_records (athlete_id, record_date, sleep_hours, created_by) values ('${REAL_ATH}', current_date, 7, '${IDS.real}')`);
    const before = await num(`select count(*)::int as n from public.wellbeing_records where athlete_id='${REAL_ATH}'`);
    await db.exec(script("02_reiniciar_datos_de_prueba.sql"));
    expect(await num(`select count(*)::int as n from public.athletes where id::text like '7e570000-%'`)).toBe(0);
    expect(await num(`select count(*)::int as n from public.teams where id::text like '7e570000-%'`)).toBe(0);
    expect(await num(`select count(*)::int as n from public.wellbeing_records where athlete_id::text like '7e570000-%'`)).toBe(0);
    expect(await num(`select count(*)::int as n from public.athletes where id='${REAL_ATH}'`)).toBe(1);
    expect(await num(`select count(*)::int as n from public.wellbeing_records where athlete_id='${REAL_ATH}'`)).toBe(before);
    // las cuentas y perfiles se conservan
    expect(await num(`select count(*)::int as n from auth.users`)).toBe(6);
  });

  it("tras el reinicio y quitar el dato real, se puede sembrar otra vez", async () => {
    await db.exec(`delete from public.athletes where id='${REAL_ATH}'`);
    await db.exec(script("01_sembrar_datos_de_prueba.sql", EMAILS));
    expect(await num(`select count(*)::int as n from public.athletes`)).toBe(3);
    await db.exec(script("02_reiniciar_datos_de_prueba.sql"));
    expect(await num(`select count(*)::int as n from public.athletes`)).toBe(0);
  });
});
