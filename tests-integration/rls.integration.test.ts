import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FIXTURE, readIntegrationConfig } from "./config";
import { ALL_TABLES, ATHLETE_DATA_TABLES, anonClient, signedInClient, today } from "./helpers";

/**
 * PRUEBAS DE INTEGRACIÓN contra un proyecto de Supabase de PRUEBAS (por HTTP, con la clave pública
 * y cuentas reales de prueba). Aquí sí se ejercitan Auth, PostgREST y las políticas RLS reales.
 *
 * Requisitos (ver README → "Supabase de prueba"):
 *   1) migraciones 01–04 ejecutadas; 2) 5 cuentas creadas; 3) supabase/test/01_sembrar_… ejecutado;
 *   4) .env.test.local completado; 5) npm run test:integration
 * Sin variables TEST_* estas pruebas se OMITEN (no cuentan como aprobadas).
 */
const result = readIntegrationConfig(process.env);

if (result.status === "invalid") {
  describe("configuración de integración", () => {
    it("es válida", () => {
      throw new Error(result.reason);
    });
  });
}

describe.skipIf(result.status !== "ok")("integración con Supabase de PRUEBAS", () => {
  const cfg = result.status === "ok" ? result.config : (undefined as never);
  let pro1!: SupabaseClient, pro2!: SupabaseClient, ath1!: SupabaseClient, ath2!: SupabaseClient, ath3!: SupabaseClient;
  const anon = () => anonClient(cfg);
  const ids = (rows: { id?: string }[] | null) => (rows ?? []).map((r) => r.id).sort();

  beforeAll(async () => {
    pro1 = await signedInClient(cfg, "PRO1");
    pro2 = await signedInClient(cfg, "PRO2");
    ath1 = await signedInClient(cfg, "ATH1");
    ath2 = await signedInClient(cfg, "ATH2");
    ath3 = await signedInClient(cfg, "ATH3");
  });
  afterAll(async () => {
    await Promise.all([pro1, pro2, ath1, ath2, ath3].map((c) => c?.auth.signOut()));
  });

  describe("conexión", () => {
    it("el servicio de autenticación del proyecto responde y acepta la clave pública", async () => {
      const res = await fetch(`${cfg.url.replace(/\/$/, "")}/auth/v1/health`, { headers: { apikey: cfg.anonKey } });
      expect(res.status).toBe(200);
    });
    it("una contraseña incorrecta es rechazada", async () => {
      const { data, error } = await anon().auth.signInWithPassword({ email: cfg.accounts.ATH1.email, password: "incorrecta-" + Date.now() });
      expect(data.session).toBeNull();
      expect(error).not.toBeNull();
    });
  });

  describe("sin sesión (anon)", () => {
    it.each(ALL_TABLES)("%s: no devuelve ninguna fila", async (table) => {
      const { data } = await anon().from(table).select("*");
      expect(data ?? []).toEqual([]);
    });
    it("no puede escribir", async () => {
      const { error } = await anon().from("wellbeing_records").insert({ athlete_id: FIXTURE.A1, record_date: today(), sleep_hours: 5 });
      expect(error).not.toBeNull();
    });
  });

  describe("deportista (ath1 ↔ TEST 1)", () => {
    it("ve únicamente su propio perfil (rol athlete) y su propia ficha", async () => {
      const prof = await ath1.from("profiles").select("id, role");
      expect(prof.data).toHaveLength(1);
      expect(prof.data?.[0]?.role).toBe("athlete");
      expect(ids((await ath1.from("athletes").select("id")).data)).toEqual([FIXTURE.A1]);
    });

    it.each(ATHLETE_DATA_TABLES)("%s: no ve filas de otros deportistas (ni siquiera del que comparte profesional)", async (table) => {
      const { data } = await ath1.from(table).select("athlete_id").neq("athlete_id", FIXTURE.A1);
      expect(data ?? []).toEqual([]);
    });

    it("control positivo: sí ve su propio registro de bienestar de hoy", async () => {
      const { data, error } = await ath1.from("wellbeing_records").select("athlete_id").eq("athlete_id", FIXTURE.A1);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });

    it("NO puede convertirse en profesional (update de role) y su rol sigue intacto", async () => {
      const me = (await ath1.auth.getUser()).data.user?.id as string;
      const { error } = await ath1.from("profiles").update({ role: "professional" }).eq("id", me);
      expect(error).not.toBeNull();
      expect((await ath1.from("profiles").select("role").eq("id", me).single()).data?.role).toBe("athlete");
    });

    it("tampoco puede reactivarse/desactivarse ni cambiar su propio id", async () => {
      const me = (await ath1.auth.getUser()).data.user?.id as string;
      expect((await ath1.from("profiles").update({ is_active: false }).eq("id", me)).error).not.toBeNull();
      expect((await ath1.from("profiles").update({ id: crypto.randomUUID() }).eq("id", me)).error).not.toBeNull();
    });

    it("NO puede asignarse profesionales/deportistas ni crear fichas, equipos o categorías", async () => {
      const me = (await ath1.auth.getUser()).data.user?.id as string;
      expect((await ath1.from("professional_athletes").insert({ professional_id: me, athlete_id: FIXTURE.A3 })).error).not.toBeNull();
      expect((await ath1.from("athletes").insert({ display_name: "Intruso" })).error).not.toBeNull();
      expect((await ath1.from("teams").insert({ name: "Equipo pirata" })).error).not.toBeNull();
      expect((await ath1.from("categories").insert({ name: "Pirata" })).error).not.toBeNull();
    });

    it("NO puede vincular otra ficha a su cuenta ni quedarse con la de otro", async () => {
      const me = (await ath1.auth.getUser()).data.user?.id as string;
      expect((await ath1.from("athletes").update({ user_id: me }).eq("id", FIXTURE.A3)).error).not.toBeNull();
    });

    it("NO puede crear registros para otro deportista (RLS)", async () => {
      const { error } = await ath1.from("wellbeing_records").insert({ athlete_id: FIXTURE.A2, record_date: today(), sleep_hours: 1 });
      expect(error?.code).toBe("42501");
    });

    it("NO puede modificar registros de otro deportista (0 filas afectadas) y el dato no cambia", async () => {
      const { data } = await ath1.from("wellbeing_records").update({ sleep_hours: 1 }).eq("athlete_id", FIXTURE.A2).select();
      expect(data ?? []).toEqual([]);
      const check = await pro1.from("wellbeing_records").select("sleep_hours").eq("athlete_id", FIXTURE.A2).single();
      expect(Number(check.data?.sleep_hours)).toBe(6);
    });

    it("NO puede mover un registro propio a otro deportista", async () => {
      const { error } = await ath1.from("wellbeing_records").update({ athlete_id: FIXTURE.A2 }).eq("athlete_id", FIXTURE.A1);
      expect(error).not.toBeNull();
    });

    it("un segundo registro de bienestar para el mismo día es rechazado (clave única)", async () => {
      const { error } = await ath1.from("wellbeing_records").insert({ athlete_id: FIXTURE.A1, record_date: today(), sleep_hours: 9 });
      expect(error?.code).toBe("23505");
    });

    it("NO puede borrar registros (ni los propios)", async () => {
      const { error } = await ath1.from("wellbeing_records").delete().eq("athlete_id", FIXTURE.A1);
      expect(error).not.toBeNull();
      const still = await ath1.from("wellbeing_records").select("athlete_id").eq("athlete_id", FIXTURE.A1);
      expect((still.data ?? []).length).toBeGreaterThan(0);
    });

    it("solo ve las observaciones COMPARTIDAS, no las privadas", async () => {
      const { data } = await ath1.from("professional_notes").select("body");
      expect((data ?? []).map((n) => n.body)).toEqual(["TEST nota COMPARTIDA de TEST 1"]);
    });

    it("NO puede escribir registros profesionales (observaciones, rendimiento, evaluaciones)", async () => {
      const me = (await ath1.auth.getUser()).data.user?.id as string;
      expect((await ath1.from("professional_notes").insert({ athlete_id: FIXTURE.A1, body: "x", created_by: me })).error).not.toBeNull();
      expect((await ath1.from("performance_records").insert({ athlete_id: FIXTURE.A1, record_date: today(), metric_code: "it_x", value: 1, unit: "u" })).error).not.toBeNull();
      expect((await ath1.from("anthropometric_evaluations").insert({ athlete_id: FIXTURE.A1, evaluated_on: today() })).error).not.toBeNull();
    });
  });

  describe("profesional 1 (asignado a TEST 1 y TEST 2)", () => {
    it("ve solo a sus deportistas asignados, no a TEST 3", async () => {
      expect(ids((await pro1.from("athletes").select("id")).data)).toEqual([FIXTURE.A1, FIXTURE.A2].sort());
    });
    it("ve solo sus propias asignaciones", async () => {
      const { data } = await pro1.from("professional_athletes").select("athlete_id");
      expect((data ?? []).map((r) => r.athlete_id).sort()).toEqual([FIXTURE.A1, FIXTURE.A2].sort());
    });
    it.each(ATHLETE_DATA_TABLES)("%s: no ve filas del deportista no asignado (TEST 3)", async (table) => {
      const { data } = await pro1.from(table).select("athlete_id").eq("athlete_id", FIXTURE.A3);
      expect(data ?? []).toEqual([]);
    });
    it("control positivo: ve los registros y las observaciones (también privadas) de sus asignados", async () => {
      expect(((await pro1.from("wellbeing_records").select("athlete_id").eq("athlete_id", FIXTURE.A1)).data ?? []).length).toBeGreaterThan(0);
      expect(((await pro1.from("professional_notes").select("id").eq("athlete_id", FIXTURE.A1)).data ?? []).length).toBe(2);
    });
    it("NO puede asignarse el deportista de otro profesional", async () => {
      const me = (await pro1.auth.getUser()).data.user?.id as string;
      expect((await pro1.from("professional_athletes").insert({ professional_id: me, athlete_id: FIXTURE.A3 })).error).not.toBeNull();
    });
    it("NO puede modificar ni escribir sobre un deportista no asignado", async () => {
      const upd = await pro1.from("athletes").update({ display_name: "Hackeado" }).eq("id", FIXTURE.A3).select();
      expect(upd.data ?? []).toEqual([]);
      const perf = await pro1.from("performance_records").insert({ athlete_id: FIXTURE.A3, record_date: today(), metric_code: "it_no", value: 1, unit: "u" });
      expect(perf.error).not.toBeNull();
    });
    it("NO puede cambiar el rol de otro usuario ni ver perfiles ajenos", async () => {
      const profiles = await pro1.from("profiles").select("id");
      expect(profiles.data).toHaveLength(1);
      const other = (await ath1.auth.getUser()).data.user?.id as string;
      const { data } = await pro1.from("profiles").update({ role: "professional" }).eq("id", other).select();
      expect(data ?? []).toEqual([]);
    });
    it("NO escribe los auto-registros del deportista", async () => {
      const { error } = await pro1.from("hydration_records").insert({ athlete_id: FIXTURE.A2, record_date: today(), total_ml: 1 });
      expect(error).not.toBeNull();
    });
    it("control positivo: puede registrar rendimiento de un deportista asignado y este lo ve", async () => {
      const code = `it_${Date.now().toString(36)}`;
      const ins = await pro1.from("performance_records").insert({ athlete_id: FIXTURE.A1, record_date: today(), metric_code: code, value: 42, unit: "cm" });
      expect(ins.error).toBeNull();
      const seen = await ath1.from("performance_records").select("metric_code").eq("metric_code", code);
      expect(seen.data).toHaveLength(1);
    });
  });

  describe("profesional 2 (asignado solo a TEST 3) y cruce entre cuentas", () => {
    it("ve solo a TEST 3", async () => {
      expect(ids((await pro2.from("athletes").select("id")).data)).toEqual([FIXTURE.A3]);
    });
    it("no ve las observaciones privadas de los deportistas de pro1", async () => {
      const { data } = await pro2.from("professional_notes").select("body");
      expect((data ?? []).map((n) => n.body)).toEqual(["TEST nota PRIVADA de TEST 3"]);
    });
    it("los otros deportistas (ath2, ath3) tampoco ven datos de ath1", async () => {
      for (const c of [ath2, ath3]) {
        expect(((await c.from("wellbeing_records").select("athlete_id").eq("athlete_id", FIXTURE.A1)).data ?? [])).toEqual([]);
        expect(((await c.from("professional_notes").select("id").eq("athlete_id", FIXTURE.A1)).data ?? [])).toEqual([]);
      }
    });
  });
});
