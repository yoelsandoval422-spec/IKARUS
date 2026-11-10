// @vitest-environment node
import type { PGlite } from "@electric-sql/pglite";
import type { ZodType } from "zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  athleteInputSchema,
  evaluationInputSchema,
  hydrationInputSchema,
  measurementInputSchema,
  nutritionInputSchema,
  performanceInputSchema,
  professionalNoteInputSchema,
  trainingInputSchema,
  wellbeingInputSchema,
} from "@/lib/schemas/records";
import { createDatabase } from "./harness";

/**
 * Coherencia Zod ↔ restricciones CHECK: para cada campo se prueban los valores
 * límite y se exige que Zod y PostgreSQL acepten/rechacen exactamente lo mismo.
 */
const USER = "00000000-0000-4000-8000-0000000000e1";
const ATH = "00000000-0000-4000-8000-00000000ee01";
const EVAL = "00000000-0000-4000-8000-00000000ee02";

let db: PGlite;
let n = 0;

const lit = (v: unknown): string =>
  v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replaceAll("'", "''")}'`;

/** Inserta como administrador (sin RLS) para aislar solo las restricciones CHECK/UNIQUE de la tabla. */
async function dbAccepts(table: string, cols: Record<string, unknown>): Promise<boolean> {
  n += 1;
  const day = new Date(Date.UTC(2020, 0, 1 + n)).toISOString().slice(0, 10); // fecha distinta → sin choque UNIQUE
  const base: Record<string, unknown> = { created_by: USER };
  if (table === "athletes") delete base.created_by;
  else if (table === "anthropometric_measurements") delete base.created_by;
  else base.athlete_id = ATH;
  if ("record_date" in cols) cols = { ...cols, record_date: day };
  if ("evaluated_on" in cols) cols = { ...cols, evaluated_on: day };
  if (table === "anthropometric_measurements") {
    base.evaluation_id = EVAL;
    if (cols.variable_code === "peso") cols = { ...cols, variable_code: `peso_${n}` }; // evita choque UNIQUE entre intentos
  }
  const all = { ...base, ...cols };
  const sql = `insert into public.${table} (${Object.keys(all).join(",")}) values (${Object.values(all).map(lit).join(",")})`;
  try {
    await db.exec(sql);
    return true;
  } catch {
    return false;
  }
}

beforeAll(async () => {
  db = await createDatabase();
  await db.exec(`
    insert into auth.users (id, email) values ('${USER}', 'e@demo.test');
    insert into public.athletes (id, display_name) values ('${ATH}', 'Atleta E');
    insert into public.anthropometric_evaluations (id, athlete_id, evaluated_on, created_by)
      values ('${EVAL}', '${ATH}', '2019-01-01', '${USER}');
  `);
});
afterAll(async () => {
  await db.close();
});

interface Case {
  label: string;
  schema: ZodType;
  table: string;
  zodBase: Record<string, unknown>;
  dbBase: Record<string, unknown>;
  zodField: string;
  dbColumn: string;
  values: unknown[];
}

const D = "2026-01-01";
const rec = { recordDate: D };
const dbRec = { record_date: D };
const num = (label: string, schema: ZodType, table: string, zodField: string, dbColumn: string, lo: number, hi: number,
  zodBase: Record<string, unknown>, dbBase: Record<string, unknown>, step = 1): Case => ({
  label, schema, table, zodField, dbColumn, zodBase, dbBase, values: [lo - step, lo, hi, hi + step],
});

const cases: Case[] = [
  num("sueño (h)", wellbeingInputSchema, "wellbeing_records", "sleepHours", "sleep_hours", 0, 24, rec, dbRec, 0.5),
  num("calidad de sueño", wellbeingInputSchema, "wellbeing_records", "sleepQuality", "sleep_quality", 1, 5, rec, dbRec),
  num("fatiga", wellbeingInputSchema, "wellbeing_records", "fatigue", "fatigue", 1, 5, rec, dbRec),
  num("dolor muscular", wellbeingInputSchema, "wellbeing_records", "muscleSoreness", "muscle_soreness", 1, 5, rec, dbRec),
  num("estrés", wellbeingInputSchema, "wellbeing_records", "stress", "stress", 1, 5, rec, dbRec),
  num("ánimo", wellbeingInputSchema, "wellbeing_records", "mood", "mood", 1, 5, rec, dbRec),
  num("líquido (ml)", hydrationInputSchema, "hydration_records", "totalMl", "total_ml", 0, 10000,
    rec, dbRec),
  num("color de orina", hydrationInputSchema, "hydration_records", "urineColor", "urine_color", 1, 8,
    { ...rec, totalMl: 1000 }, { ...dbRec, total_ml: 1000 }),
  num("duración (min)", trainingInputSchema, "training_records", "durationMin", "duration_min", 1, 600, rec, dbRec),
  num("RPE", trainingInputSchema, "training_records", "rpe", "rpe", 1, 10,
    { ...rec, durationMin: 60 }, { ...dbRec, duration_min: 60 }),
  num("medición ≥ 0", measurementInputSchema, "anthropometric_measurements", "value", "value", 0, 500,
    { variableCode: "peso", unit: "kg" }, { variable_code: "peso", unit: "kg" }, 0.5),
];
// "medición ≥ 0": el máximo no existe en la base; se corrige abajo para no afirmar un límite superior.
cases[cases.length - 1]!.values = [-0.5, 0, 500];

const text = (label: string, schema: ZodType, table: string, zodField: string, dbColumn: string, max: number,
  zodBase: Record<string, unknown>, dbBase: Record<string, unknown>, required: boolean): Case => ({
  label, schema, table, zodField, dbColumn, zodBase, dbBase,
  values: ["a".repeat(max), "a".repeat(max + 1), ...(required ? ["", "   "] : [])],
});
cases.push(
  text("descripción de comida", nutritionInputSchema, "nutrition_records", "description", "description", 500,
    { ...rec, meal: "lunch" }, { ...dbRec, meal: "lunch" }, true),
  text("notas de bienestar", wellbeingInputSchema, "wellbeing_records", "notes", "notes", 500, rec, dbRec, false),
  text("notas de entrenamiento", trainingInputSchema, "training_records", "notes", "notes", 500,
    { ...rec, durationMin: 60 }, { ...dbRec, duration_min: 60 }, false),
  text("observación profesional", professionalNoteInputSchema, "professional_notes", "body", "body", 2000, {}, {}, true),
  text("nombre del deportista", athleteInputSchema, "athletes", "displayName", "display_name", 120, {}, {}, true),
  text("unidad de rendimiento", performanceInputSchema, "performance_records", "unit", "unit", 20,
    { ...rec, metricCode: "cmj", value: 1 }, { ...dbRec, metric_code: "cmj", value: 1 }, true),
  { label: "código de métrica", schema: performanceInputSchema, table: "performance_records", zodField: "metricCode",
    dbColumn: "metric_code", zodBase: { ...rec, value: 1, unit: "cm" }, dbBase: { ...dbRec, value: 1, unit: "cm" },
    values: ["ab", "a", "cmj_height_2", "CMJ", "cmj height", "a".repeat(60), "a".repeat(61)] },
  { label: "nivel ISAK", schema: evaluationInputSchema, table: "anthropometric_evaluations", zodField: "isakLevel",
    dbColumn: "isak_level", zodBase: { evaluatedOn: D }, dbBase: { evaluated_on: D }, values: [0, 1, 2, 3] },
  { label: "número de sesión", schema: trainingInputSchema, table: "training_records", zodField: "sessionNumber",
    dbColumn: "session_number", zodBase: { ...rec, durationMin: 60 }, dbBase: { ...dbRec, duration_min: 60 }, values: [0, 1, 5, 6] },
);

describe("Zod y la base aceptan/rechazan lo mismo en los valores límite", () => {
  for (const c of cases) {
    it(c.label, async () => {
      for (const v of c.values) {
        const zodOk = c.schema.safeParse({ ...c.zodBase, [c.zodField]: v }).success;
        const dbOk = await dbAccepts(c.table, { ...c.dbBase, [c.dbColumn]: v });
        expect({ valor: v, zod: zodOk, db: dbOk }).toEqual({ valor: v, zod: zodOk, db: zodOk });
      }
    });
  }
});
