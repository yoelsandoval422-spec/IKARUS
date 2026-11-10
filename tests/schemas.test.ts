import { describe, expect, it } from "vitest";
import {
  athleteInputSchema,
  evaluationInputSchema,
  hydrationInputSchema,
  isWithinEditWindow,
  measurementInputSchema,
  nutritionInputSchema,
  performanceInputSchema,
  professionalNoteInputSchema,
  teamMembershipInputSchema,
  trainingInputSchema,
  wellbeingInputSchema,
} from "@/lib/schemas/records";

const date = "2026-10-20";

describe("validaciones de registros", () => {
  it("bienestar: acepta límites y rechaza fuera de rango", () => {
    expect(wellbeingInputSchema.safeParse({ recordDate: date, sleepHours: 24, mood: 5, fatigue: 1 }).success).toBe(true);
    expect(wellbeingInputSchema.safeParse({ recordDate: date, sleepHours: 25 }).success).toBe(false);
    expect(wellbeingInputSchema.safeParse({ recordDate: date, mood: 6 }).success).toBe(false);
    expect(wellbeingInputSchema.safeParse({ recordDate: date, stress: 2.5 }).success).toBe(false);
  });
  it("rechaza fechas con formato inválido o inexistentes", () => {
    expect(wellbeingInputSchema.safeParse({ recordDate: "20/10/2026" }).success).toBe(false);
    expect(wellbeingInputSchema.safeParse({ recordDate: "2026-02-30" }).success).toBe(false);
    expect(wellbeingInputSchema.safeParse({ recordDate: "2026-02-28" }).success).toBe(true);
  });
  it("no deja pasar athlete_id ni created_by (los fija el servidor)", () => {
    const r = wellbeingInputSchema.safeParse({ recordDate: date, athlete_id: "x", created_by: "y" });
    expect(r.success).toBe(true);
    expect(r.success && "athlete_id" in r.data).toBe(false);
    expect(r.success && "created_by" in r.data).toBe(false);
  });
  it("alimentación: comida válida y descripción obligatoria", () => {
    expect(nutritionInputSchema.safeParse({ recordDate: date, meal: "lunch", description: "Pollo y arroz" }).success).toBe(true);
    expect(nutritionInputSchema.safeParse({ recordDate: date, meal: "brunch", description: "x" }).success).toBe(false);
    expect(nutritionInputSchema.safeParse({ recordDate: date, meal: "lunch", description: "   " }).success).toBe(false);
  });
  it("hidratación y entrenamiento: rangos y valores por defecto", () => {
    expect(hydrationInputSchema.safeParse({ recordDate: date, totalMl: 10000 }).success).toBe(true);
    expect(hydrationInputSchema.safeParse({ recordDate: date, totalMl: -1 }).success).toBe(false);
    const t = trainingInputSchema.parse({ recordDate: date, durationMin: 90, rpe: 7 });
    expect(t.sessionNumber).toBe(1);
    expect(t.session).toBe("training");
    expect(trainingInputSchema.safeParse({ recordDate: date, durationMin: 0 }).success).toBe(false);
    expect(trainingInputSchema.safeParse({ recordDate: date, durationMin: 60, rpe: 11 }).success).toBe(false);
  });
  it("rendimiento: código de métrica con formato controlado", () => {
    const base = { recordDate: date, value: 42.5, unit: "cm" };
    expect(performanceInputSchema.safeParse({ ...base, metricCode: "cmj_height" }).success).toBe(true);
    expect(performanceInputSchema.safeParse({ ...base, metricCode: "CMJ Height" }).success).toBe(false);
    expect(performanceInputSchema.safeParse({ ...base, metricCode: "cmj", value: Infinity }).success).toBe(false);
  });
  it("observaciones: texto obligatorio; compartida por defecto = no", () => {
    expect(professionalNoteInputSchema.parse({ body: "Buena evolución" }).sharedWithAthlete).toBe(false);
    expect(professionalNoteInputSchema.safeParse({ body: "  " }).success).toBe(false);
    expect(professionalNoteInputSchema.safeParse({ body: "a".repeat(2001) }).success).toBe(false);
  });
  it("deportista, membresía y antropometría", () => {
    expect(athleteInputSchema.safeParse({ displayName: "  " }).success).toBe(false);
    expect(athleteInputSchema.safeParse({ displayName: "Ana", birthDate: "1899-12-31" }).success).toBe(false);
    const team = "11111111-1111-4111-8111-111111111111";
    expect(teamMembershipInputSchema.safeParse({ teamId: team, jerseyNumber: 99 }).success).toBe(true);
    expect(teamMembershipInputSchema.safeParse({ teamId: team, jerseyNumber: 100 }).success).toBe(false);
    expect(teamMembershipInputSchema.safeParse({ teamId: "no-uuid" }).success).toBe(false);
    expect(teamMembershipInputSchema.safeParse({ teamId: team, startsOn: "2026-05-02", endsOn: "2026-05-01" }).success).toBe(false);
    expect(evaluationInputSchema.parse({ evaluatedOn: date }).isakLevel).toBe(1);
    expect(evaluationInputSchema.safeParse({ evaluatedOn: date, isakLevel: 3 }).success).toBe(false);
    expect(measurementInputSchema.safeParse({ variableCode: "peso", value: -1, unit: "kg" }).success).toBe(false);
  });
});

describe("ventana de edición del deportista", () => {
  const today = "2026-10-20";
  it("permite 14 días atrás y 1 adelante", () => {
    expect(isWithinEditWindow("2026-10-06", today)).toBe(true);
    expect(isWithinEditWindow("2026-10-21", today)).toBe(true);
  });
  it("rechaza fuera de la ventana", () => {
    expect(isWithinEditWindow("2026-10-05", today)).toBe(false);
    expect(isWithinEditWindow("2026-10-22", today)).toBe(false);
  });
});
