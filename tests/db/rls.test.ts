// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, createDatabase, readAdminScript } from "./harness";

/**
 * Pruebas de seguridad contra PostgreSQL real (PGlite) con las migraciones
 * reales del proyecto. Imitan Supabase con roles y auth.uid() (ver harness.ts).
 * NO prueban una instancia de Supabase en línea.
 */

const U = {
  profA: "00000000-0000-4000-8000-0000000000a1", // deportista A
  athB: "00000000-0000-4000-8000-0000000000b1", // deportista B
  prof1: "00000000-0000-4000-8000-0000000000c1", // profesional 1 (asignado a A)
  prof2: "00000000-0000-4000-8000-0000000000c2", // profesional 2 (asignado a B)
  prof3: "00000000-0000-4000-8000-0000000000c3", // profesional sin asignaciones
  intruso: "00000000-0000-4000-8000-0000000000d1", // usuario sin ficha de deportista
};
const A = "00000000-0000-4000-8000-00000000aa01";
const B = "00000000-0000-4000-8000-00000000bb01";
const C = "00000000-0000-4000-8000-00000000cc01"; // sin cuenta

let db: PGlite;

const q = (sql: string) => db.query<Record<string, unknown>>(sql);
const rows = async (sql: string) => (await q(sql)).rows;
const as = <T>(uid: string | null, fn: () => Promise<T>) => asUser(db, uid, fn);
const denied = (p: Promise<unknown>, re: RegExp = /./) => expect(p).rejects.toThrow(re);

beforeAll(async () => {
  db = await createDatabase();
  // Usuarios (el trigger crea sus perfiles). Se intenta colar role en metadatos.
  await db.exec(`
    insert into auth.users (id, email, raw_user_meta_data) values
      ('${U.profA}', 'a@demo.test', '{"role":"professional","full_name":"Atleta A"}'),
      ('${U.athB}',  'b@demo.test', '{}'),
      ('${U.prof1}', 'p1@demo.test', '{}'),
      ('${U.prof2}', 'p2@demo.test', '{}'),
      ('${U.prof3}', 'p3@demo.test', '{}'),
      ('${U.intruso}', 'x@demo.test', '{}');
  `);
  // Administración (rol postgres): promoción y alta de fichas.
  for (const email of ["p1@demo.test", "p2@demo.test", "p3@demo.test"]) {
    await db.exec(readAdminScript("01_promover_profesional.sql", { REEMPLAZAR_CORREO_PROFESIONAL: email }));
  }
  await db.exec(`
    insert into public.athletes (id, user_id, display_name, category_id, position_id)
      values ('${A}', null, 'Deportista A', 1, 1), ('${B}', null, 'Deportista B', 2, 2), ('${C}', null, 'Deportista C', 3, 3);
  `);
  await db.exec(readAdminScript("03_vincular_cuenta_deportista.sql", { REEMPLAZAR_CORREO_DEPORTISTA: "a@demo.test", "00000000-0000-0000-0000-000000000000": A }));
  await db.exec(readAdminScript("03_vincular_cuenta_deportista.sql", { REEMPLAZAR_CORREO_DEPORTISTA: "b@demo.test", "00000000-0000-0000-0000-000000000000": B }));
  await db.exec(readAdminScript("02_asignar_deportista.sql", { REEMPLAZAR_CORREO_PROFESIONAL: "p1@demo.test", "00000000-0000-0000-0000-000000000000": A }));
  await db.exec(readAdminScript("02_asignar_deportista.sql", { REEMPLAZAR_CORREO_PROFESIONAL: "p2@demo.test", "00000000-0000-0000-0000-000000000000": B }));
  // Un registro de bienestar de B (insertado por el servidor) para pruebas de aislamiento.
  await db.exec(`
    insert into public.wellbeing_records (athlete_id, record_date, sleep_hours, created_by)
      values ('${B}', current_date, 7, '${U.athB}');
  `);
});

afterAll(async () => {
  await db.close();
});

describe("migraciones y estructura", () => {
  it("todas las tablas de public tienen RLS activado", async () => {
    const r = await rows(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(r).toEqual([]);
  });
  it("anon no tiene ningún privilegio sobre las tablas de public", async () => {
    const r = await rows(`select table_name, privilege_type from information_schema.role_table_grants
      where table_schema='public' and grantee='anon'`);
    expect(r).toEqual([]);
  });
  it("authenticated no puede borrar en ninguna tabla de public", async () => {
    const r = await rows(`select table_name from information_schema.role_table_grants
      where table_schema='public' and grantee='authenticated' and privilege_type in ('DELETE','TRUNCATE')`);
    expect(r).toEqual([]);
  });
  it("el perfil de cada usuario se crea como athlete aunque los metadatos pidan professional", async () => {
    const r = await rows(`select role, display_name from public.profiles where id='${U.profA}'`);
    expect(r).toEqual([{ role: "athlete", display_name: "Atleta A" }]);
  });
});

describe("roles: nadie se otorga el rol de profesional", () => {
  it("un deportista no puede actualizar su rol", async () => {
    await as(U.profA, async () => {
      await denied(q(`update public.profiles set role='professional' where id='${U.profA}'`), /permission denied/);
    });
    expect((await rows(`select role from public.profiles where id='${U.profA}'`))[0]?.role).toBe("athlete");
  });
  it("tampoco puede reactivar/desactivarse ni cambiar su id", async () => {
    await as(U.athB, async () => {
      await denied(q(`update public.profiles set is_active=false where id='${U.athB}'`), /permission denied/);
      await denied(q(`update public.profiles set id=gen_random_uuid() where id='${U.athB}'`), /permission denied/);
    });
  });
  it("puede cambiar su nombre visible", async () => {
    await as(U.athB, async () => {
      const r = await rows(`update public.profiles set display_name='B Demo' where id='${U.athB}' returning id`);
      expect(r).toHaveLength(1);
    });
  });
  it("no puede insertar perfiles ni ver los ajenos", async () => {
    await as(U.athB, async () => {
      await denied(q(`insert into public.profiles (id, role) values (gen_random_uuid(), 'professional')`), /permission denied/);
      const r = await rows(`select id from public.profiles`);
      expect(r).toEqual([{ id: U.athB }]);
    });
  });
  it("el trigger rechaza el cambio de rol aunque se concediera UPDATE amplio", async () => {
    await db.exec(`grant update on public.profiles to authenticated`);
    try {
      await as(U.athB, async () => {
        await denied(q(`update public.profiles set role='professional' where id='${U.athB}'`), /No está permitido modificar el rol/);
      });
    } finally {
      await db.exec(`revoke update on public.profiles from authenticated; grant update (display_name) on public.profiles to authenticated`);
    }
  });
  it("un profesional promovido solo por el servidor puede asignar; no puede asignarse a sí mismo", async () => {
    await as(U.prof3, async () => {
      await denied(q(`insert into public.professional_athletes (professional_id, athlete_id) values ('${U.prof3}', '${A}')`), /permission denied/);
    });
  });
  it("no se puede asignar un perfil que no es profesional", async () => {
    await denied(q(`insert into public.professional_athletes (professional_id, athlete_id) values ('${U.athB}', '${A}')`), /rol de profesional/);
  });
  it("un profesional degradado pierde el acceso inmediatamente", async () => {
    await db.exec(`update public.profiles set role='athlete' where id='${U.prof1}'`);
    try {
      await as(U.prof1, async () => {
        expect(await rows(`select id from public.athletes`)).toEqual([]);
      });
    } finally {
      await db.exec(`update public.profiles set role='professional' where id='${U.prof1}'`);
    }
  });
});

describe("deportista: solo sus propios registros", () => {
  it("ve únicamente su ficha", async () => {
    await as(U.profA, async () => {
      expect((await rows(`select id from public.athletes`)).map((r) => r.id)).toEqual([A]);
    });
  });
  it("crea su registro de bienestar y no puede duplicarlo", async () => {
    await as(U.profA, async () => {
      await q(`insert into public.wellbeing_records (athlete_id, record_date, sleep_hours, mood) values ('${A}', current_date, 8, 4)`);
      await denied(q(`insert into public.wellbeing_records (athlete_id, record_date, sleep_hours) values ('${A}', current_date, 6)`), /duplicate key/);
    });
  });
  it("no puede crear registros para otro deportista", async () => {
    await as(U.profA, async () => {
      await denied(q(`insert into public.wellbeing_records (athlete_id, record_date, sleep_hours) values ('${B}', current_date - 1, 6)`), /row-level security/);
      await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${C}', current_date, 500)`), /row-level security/);
    });
  });
  it("no puede falsear el autor (created_by)", async () => {
    await as(U.profA, async () => {
      await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml, created_by) values ('${A}', current_date, 500, '${U.prof1}')`), /row-level security/);
    });
  });
  it("no ve ni modifica los registros de otro deportista", async () => {
    await as(U.profA, async () => {
      expect(await rows(`select id from public.wellbeing_records where athlete_id='${B}'`)).toEqual([]);
      expect(await rows(`update public.wellbeing_records set sleep_hours=1 where athlete_id='${B}' returning id`)).toEqual([]);
    });
    expect((await rows(`select sleep_hours from public.wellbeing_records where athlete_id='${B}'`))[0]?.sleep_hours).toBe("7.00");
  });
  it("no puede reasignar un registro propio a otro deportista", async () => {
    await as(U.profA, async () => {
      await denied(q(`update public.wellbeing_records set athlete_id='${B}' where athlete_id='${A}'`), /permission denied/);
    });
  });
  it("el trigger impide reasignar aunque se concediera UPDATE sobre athlete_id", async () => {
    await db.exec(`grant update (athlete_id) on public.wellbeing_records to authenticated`);
    try {
      await as(U.profA, async () => {
        await denied(q(`update public.wellbeing_records set athlete_id='${B}' where athlete_id='${A}'`), /otro deportista|row-level security/);
      });
    } finally {
      await db.exec(`revoke update (athlete_id) on public.wellbeing_records from authenticated`);
    }
  });
  it("respeta la ventana de edición (no futuro lejano ni más de 14 días atrás)", async () => {
    await as(U.profA, async () => {
      await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${A}', current_date + 5, 500)`), /row-level security/);
      await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${A}', current_date - 30, 500)`), /row-level security/);
      await q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${A}', current_date - 3, 1500)`);
    });
  });
  it("edita su registro reciente pero no puede borrar", async () => {
    await as(U.profA, async () => {
      const r = await rows(`update public.hydration_records set total_ml=2000 where athlete_id='${A}' returning total_ml`);
      expect(r).toHaveLength(1);
      await denied(q(`delete from public.hydration_records where athlete_id='${A}'`), /permission denied/);
    });
  });
  it("registros antiguos quedan inmutables para el deportista", async () => {
    await db.exec(`insert into public.hydration_records (athlete_id, record_date, total_ml, created_by) values ('${A}', current_date - 60, 900, '${U.profA}')`);
    await as(U.profA, async () => {
      expect(await rows(`update public.hydration_records set total_ml=1 where record_date = current_date - 60 returning id`)).toEqual([]);
    });
  });
  it("valida rangos con restricciones CHECK", async () => {
    await as(U.profA, async () => {
      await denied(q(`insert into public.training_records (athlete_id, record_date, duration_min, rpe) values ('${A}', current_date, 60, 11)`), /check constraint/);
      await denied(q(`insert into public.training_records (athlete_id, record_date, duration_min) values ('${A}', current_date, 0)`), /check constraint/);
      await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${A}', current_date - 1, -5)`), /check constraint/);
    });
  });
  it("permite varias comidas y sesiones por día, sin repetir tipo ni número", async () => {
    await as(U.profA, async () => {
      await q(`insert into public.nutrition_records (athlete_id, record_date, meal, description) values ('${A}', current_date, 'breakfast', 'Avena')`);
      await q(`insert into public.nutrition_records (athlete_id, record_date, meal, description) values ('${A}', current_date, 'lunch', 'Pollo y arroz')`);
      await denied(q(`insert into public.nutrition_records (athlete_id, record_date, meal, description) values ('${A}', current_date, 'lunch', 'Otra')`), /duplicate key/);
      await q(`insert into public.training_records (athlete_id, record_date, session_number, duration_min) values ('${A}', current_date, 1, 60)`);
      await q(`insert into public.training_records (athlete_id, record_date, session_number, duration_min) values ('${A}', current_date, 2, 30)`);
      await denied(q(`insert into public.training_records (athlete_id, record_date, session_number, duration_min) values ('${A}', current_date, 2, 45)`), /duplicate key/);
    });
  });
  it("no puede escribir registros profesionales (rendimiento, observaciones, evaluaciones)", async () => {
    await as(U.profA, async () => {
      await denied(q(`insert into public.performance_records (athlete_id, record_date, metric_code, value, unit) values ('${A}', current_date, 'cmj', 30, 'cm')`), /row-level security/);
      await denied(q(`insert into public.professional_notes (athlete_id, body) values ('${A}', 'nota')`), /row-level security/);
      await denied(q(`insert into public.anthropometric_evaluations (athlete_id, evaluated_on) values ('${A}', current_date)`), /row-level security/);
    });
  });
  it("no puede crear deportistas ni vincular cuentas", async () => {
    await as(U.profA, async () => {
      await denied(q(`insert into public.athletes (display_name) values ('Falso')`), /row-level security/);
      await denied(q(`update public.athletes set user_id='${U.intruso}' where id='${A}'`), /permission denied/);
    });
  });
  it("un usuario sin ficha de deportista no puede registrar nada", async () => {
    await as(U.intruso, async () => {
      expect(await rows(`select id from public.athletes`)).toEqual([]);
      await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${A}', current_date, 500)`), /row-level security/);
    });
  });
  it("un deportista desactivado no puede registrar", async () => {
    await db.exec(`update public.athletes set is_active=false where id='${B}'`);
    try {
      await as(U.athB, async () => {
        await denied(q(`insert into public.hydration_records (athlete_id, record_date, total_ml) values ('${B}', current_date - 2, 500)`), /row-level security/);
      });
    } finally {
      await db.exec(`update public.athletes set is_active=true where id='${B}'`);
    }
  });
  it("sin sesión (anon) no se accede a nada", async () => {
    await as(null, async () => {
      await denied(q(`select * from public.athletes`), /permission denied/);
      await denied(q(`select * from public.wellbeing_records`), /permission denied/);
    });
  });
});

describe("profesional: solo deportistas asignados", () => {
  it("ve solo a sus asignados", async () => {
    await as(U.prof1, async () => {
      expect((await rows(`select id from public.athletes order by id`)).map((r) => r.id)).toEqual([A]);
    });
    await as(U.prof2, async () => {
      expect((await rows(`select id from public.athletes`)).map((r) => r.id)).toEqual([B]);
    });
  });
  it("un profesional sin asignaciones no ve deportistas ni registros", async () => {
    await as(U.prof3, async () => {
      expect(await rows(`select id from public.athletes`)).toEqual([]);
      expect(await rows(`select id from public.wellbeing_records`)).toEqual([]);
      expect(await rows(`select professional_id from public.professional_athletes`)).toEqual([]);
    });
  });
  it("lee los registros de su deportista pero no los de otros", async () => {
    await as(U.prof1, async () => {
      const r = await rows(`select distinct athlete_id from public.wellbeing_records`);
      expect(r).toEqual([{ athlete_id: A }]);
    });
  });
  it("no escribe los auto-registros del deportista", async () => {
    await as(U.prof1, async () => {
      await denied(q(`insert into public.wellbeing_records (athlete_id, record_date, sleep_hours) values ('${A}', current_date - 4, 5)`), /row-level security/);
      expect(await rows(`update public.hydration_records set total_ml=1 where athlete_id='${A}' returning id`)).toEqual([]);
    });
  });
  it("registra rendimiento solo para sus asignados y como autor verdadero", async () => {
    await as(U.prof1, async () => {
      await q(`insert into public.performance_records (athlete_id, record_date, metric_code, value, unit) values ('${A}', current_date, 'cmj', 31.5, 'cm')`);
      await denied(q(`insert into public.performance_records (athlete_id, record_date, metric_code, value, unit) values ('${A}', current_date, 'cmj', 32, 'cm')`), /duplicate key/);
      await denied(q(`insert into public.performance_records (athlete_id, record_date, metric_code, value, unit) values ('${B}', current_date, 'cmj', 30, 'cm')`), /row-level security/);
      await denied(q(`insert into public.performance_records (athlete_id, record_date, metric_code, value, unit, created_by) values ('${A}', current_date, 'sprint', 4, 's', '${U.prof2}')`), /row-level security/);
    });
  });
  it("observaciones: asignado escribe; el deportista solo ve las compartidas", async () => {
    await as(U.prof1, async () => {
      await q(`insert into public.professional_notes (athlete_id, body, shared_with_athlete) values ('${A}', 'Privada', false)`);
      await q(`insert into public.professional_notes (athlete_id, body, shared_with_athlete) values ('${A}', 'Compartida', true)`);
      await denied(q(`insert into public.professional_notes (athlete_id, body) values ('${B}', 'ajena')`), /row-level security/);
    });
    await as(U.profA, async () => {
      expect((await rows(`select body from public.professional_notes`)).map((r) => r.body)).toEqual(["Compartida"]);
    });
    await as(U.prof2, async () => {
      expect(await rows(`select body from public.professional_notes where athlete_id='${A}'`)).toEqual([]);
    });
  });
  it("solo el autor edita su observación", async () => {
    await db.exec(`insert into public.professional_athletes values ('${U.prof2}', '${A}') on conflict do nothing`);
    try {
      await as(U.prof2, async () => {
        expect(await rows(`update public.professional_notes set body='cambiada' where athlete_id='${A}' returning id`)).toEqual([]);
      });
    } finally {
      await db.exec(`delete from public.professional_athletes where professional_id='${U.prof2}' and athlete_id='${A}'`);
    }
  });
  it("crea un deportista, queda asignado (RETURNING funciona) y no puede vincular cuenta", async () => {
    await as(U.prof2, async () => {
      const r = await rows(`insert into public.athletes (display_name, category_id) values ('Nuevo Demo', 1) returning id, created_by`);
      expect(r).toHaveLength(1);
      expect(r[0]?.created_by).toBe(U.prof2);
      expect((await rows(`select id from public.athletes`)).length).toBe(2);
      await denied(q(`insert into public.athletes (display_name, user_id) values ('Con cuenta', '${U.intruso}')`), /permission denied/);
    });
    await as(U.prof1, async () => {
      expect((await rows(`select id from public.athletes`)).map((r) => r.id)).toEqual([A]); // no ve el nuevo
    });
  });
  it("edita datos de su deportista pero no de otros, ni el vínculo de cuenta", async () => {
    await as(U.prof1, async () => {
      expect(await rows(`update public.athletes set display_name='A editado' where id='${A}' returning id`)).toHaveLength(1);
      expect(await rows(`update public.athletes set display_name='hack' where id='${B}' returning id`)).toEqual([]);
      await denied(q(`update public.athletes set user_id='${U.intruso}' where id='${A}'`), /permission denied/);
    });
  });
  it("no puede ver ni editar asignaciones ajenas", async () => {
    await as(U.prof1, async () => {
      expect((await rows(`select professional_id from public.professional_athletes`)).map((r) => r.professional_id)).toEqual([U.prof1]);
      await denied(q(`update public.professional_athletes set athlete_id='${B}'`), /permission denied/);
    });
  });
});

describe("equipos, membresías y puestos", () => {
  let team1 = "";
  let team2 = "";
  it("un profesional crea equipos; un deportista no", async () => {
    await as(U.prof1, async () => {
      const r1 = await rows(`insert into public.teams (name, category_id, season) values ('Demo Norte', 2, '2026') returning id`);
      team1 = String(r1[0]?.id);
      const r2 = await rows(`insert into public.teams (name, category_id, season) values ('Demo Sur', 3, '2026') returning id`);
      team2 = String(r2[0]?.id);
    });
    await as(U.profA, async () => {
      await denied(q(`insert into public.teams (name) values ('Falso')`), /row-level security/);
      expect((await rows(`select id from public.teams`)).length).toBe(2); // lectura permitida
    });
  });
  it("membresía vigente única por deportista y equipo; camiseta única por equipo", async () => {
    await as(U.prof1, async () => {
      await q(`insert into public.team_memberships (athlete_id, team_id, jersey_number) values ('${A}', '${team1}', 7)`);
      await denied(q(`insert into public.team_memberships (athlete_id, team_id) values ('${A}', '${team1}')`), /duplicate key/);
      await denied(q(`insert into public.team_memberships (athlete_id, team_id, jersey_number, starts_on, ends_on) values ('${A}', '${team2}', 1, current_date, current_date - 1)`), /check constraint/);
    });
    await db.exec(`insert into public.team_memberships (athlete_id, team_id, jersey_number) values ('${C}', '${team1}', 8)`);
    await expect(q(`insert into public.team_memberships (athlete_id, team_id, jersey_number) values ('${B}', '${team1}', 7)`)).rejects.toThrow(/duplicate key/);
  });
  it("la membresía puede cerrarse y reabrirse después", async () => {
    await as(U.prof1, async () => {
      await q(`update public.team_memberships set ends_on = current_date where athlete_id='${A}' and team_id='${team1}'`);
      await q(`insert into public.team_memberships (athlete_id, team_id, jersey_number) values ('${A}', '${team1}', 7)`);
    });
  });
  it("un profesional no gestiona membresías de deportistas no asignados", async () => {
    await as(U.prof1, async () => {
      await denied(q(`insert into public.team_memberships (athlete_id, team_id) values ('${B}', '${team2}')`), /row-level security/);
    });
  });
  it("referencias inválidas son rechazadas", async () => {
    await expect(q(`insert into public.team_memberships (athlete_id, team_id) values (gen_random_uuid(), '${team1}')`)).rejects.toThrow(/foreign key/);
    await expect(q(`insert into public.athletes (display_name, position_id) values ('X', 999)`)).rejects.toThrow(/foreign key/);
  });
  it("no se puede borrar un equipo con membresías (RESTRICT)", async () => {
    await expect(q(`delete from public.teams where id='${team1}'`)).rejects.toThrow(/foreign key/);
  });
  it("un usuario vinculado a una ficha no puede vincularse a otra (UNIQUE)", async () => {
    await expect(q(`update public.athletes set user_id='${U.profA}' where id='${C}'`)).rejects.toThrow(/duplicate key/);
  });
});

describe("evaluaciones antropométricas (estructura)", () => {
  let evalId = "";
  it("el profesional asignado crea evaluación y mediciones; sin duplicados", async () => {
    await as(U.prof1, async () => {
      const r = await rows(`insert into public.anthropometric_evaluations (athlete_id, evaluated_on, isak_level) values ('${A}', current_date, 1) returning id`);
      evalId = String(r[0]?.id);
      await q(`insert into public.anthropometric_measurements (evaluation_id, variable_code, value, unit) values ('${evalId}', 'body_mass', 78.4, 'kg')`);
      await denied(q(`insert into public.anthropometric_measurements (evaluation_id, variable_code, value, unit) values ('${evalId}', 'body_mass', 79, 'kg')`), /duplicate key/);
      await denied(q(`insert into public.anthropometric_evaluations (athlete_id, evaluated_on, isak_level) values ('${A}', current_date, 1)`), /duplicate key/);
      await denied(q(`insert into public.anthropometric_evaluations (athlete_id, evaluated_on, isak_level) values ('${A}', current_date, 3)`), /check constraint/);
    });
  });
  it("el deportista lee las suyas pero no las modifica; otros no las ven", async () => {
    await as(U.profA, async () => {
      expect(await rows(`select id from public.anthropometric_measurements`)).toHaveLength(1);
      await denied(q(`insert into public.anthropometric_measurements (evaluation_id, variable_code, value, unit) values ('${evalId}', 'stature', 180, 'cm')`), /row-level security/);
    });
    await as(U.athB, async () => {
      expect(await rows(`select id from public.anthropometric_evaluations`)).toEqual([]);
      expect(await rows(`select id from public.anthropometric_measurements`)).toEqual([]);
    });
    await as(U.prof2, async () => {
      await denied(q(`insert into public.anthropometric_measurements (evaluation_id, variable_code, value, unit) values ('${evalId}', 'stature', 180, 'cm')`), /row-level security/);
    });
  });
  it("las mediciones no se pueden mover a otra evaluación", async () => {
    await expect(q(`update public.anthropometric_measurements set evaluation_id=gen_random_uuid()`)).rejects.toThrow(/mover una medición|foreign key/);
  });
});

describe("historial independiente por deportista", () => {
  it("borrar un deportista elimina solo su propio historial", async () => {
    const before = await rows(`select count(*)::int n from public.wellbeing_records where athlete_id='${B}'`);
    await db.exec(`delete from public.athletes where id='${A}'`);
    const a = await rows(`select count(*)::int n from public.wellbeing_records where athlete_id='${A}'`);
    const b = await rows(`select count(*)::int n from public.wellbeing_records where athlete_id='${B}'`);
    expect(a[0]?.n).toBe(0);
    expect(b[0]?.n).toBe(before[0]?.n);
  });
});
