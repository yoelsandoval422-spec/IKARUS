import { z } from "zod";

/**
 * Validaciones Zod que ESPEJAN las restricciones CHECK de la base de datos
 * (supabase/migrations). La base sigue siendo la autoridad: estas reglas dan
 * errores claros antes de llegar a ella. tests/db/consistency.test.ts comprueba
 * que ambas coinciden en los valores límite.
 *
 * Reciben el payload editable por el usuario: `athlete_id` y `created_by` NO
 * forman parte porque los fija el servidor a partir de la sesión.
 * Los números deben llegar ya convertidos (los formularios envían texto).
 */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateString = z
  .string()
  .regex(ISO_DATE, "Fecha inválida (usa AAAA-MM-DD).")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "La fecha no existe.");

const scale = (min: number, max: number) => z.number().int().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const code = z.string().regex(/^[a-z0-9_]{2,60}$/, "Código inválido (minúsculas, números y _; 2 a 60 caracteres).");

/** Días hacia atrás / adelante en que un deportista puede registrar (ver private.in_edit_window). */
export const EDIT_WINDOW = { daysBack: 14, daysForward: 1 } as const;

export function isWithinEditWindow(recordDate: string, today: string): boolean {
  const day = 86_400_000;
  const diff = (Date.parse(`${recordDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / day;
  return diff >= -EDIT_WINDOW.daysBack && diff <= EDIT_WINDOW.daysForward;
}

export const wellbeingInputSchema = z.object({
  recordDate: dateString,
  sleepHours: z.number().min(0).max(24).optional(),
  sleepQuality: scale(1, 5).optional(),
  fatigue: scale(1, 5).optional(),
  muscleSoreness: scale(1, 5).optional(),
  stress: scale(1, 5).optional(),
  mood: scale(1, 5).optional(),
  notes: optionalText(500),
});

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner", "supplement"] as const;
export const nutritionInputSchema = z.object({
  recordDate: dateString,
  meal: z.enum(MEAL_TYPES),
  description: z.string().trim().min(1, "Describe la comida.").max(500),
});

export const hydrationInputSchema = z.object({
  recordDate: dateString,
  totalMl: z.number().int().min(0).max(10000),
  urineColor: scale(1, 8).optional(),
});

export const SESSION_TYPES = ["training", "match", "gym", "recovery", "other"] as const;
export const trainingInputSchema = z.object({
  recordDate: dateString,
  sessionNumber: scale(1, 5).default(1),
  session: z.enum(SESSION_TYPES).default("training"),
  durationMin: z.number().int().min(1).max(600),
  rpe: scale(1, 10).optional(),
  notes: optionalText(500),
});

export const performanceInputSchema = z.object({
  recordDate: dateString,
  metricCode: code,
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(20),
  notes: optionalText(500),
});

export const professionalNoteInputSchema = z.object({
  noteDate: dateString.optional(),
  body: z.string().trim().min(1, "La observación está vacía.").max(2000),
  sharedWithAthlete: z.boolean().default(false),
});

export const athleteInputSchema = z.object({
  displayName: z.string().trim().min(1, "Falta el nombre.").max(120),
  birthDate: dateString.refine((v) => v > "1900-01-01", "Fecha de nacimiento fuera de rango.").optional(),
  categoryId: z.number().int().positive().optional(),
  positionId: z.number().int().positive().optional(),
});

export const teamMembershipInputSchema = z
  .object({
    teamId: z.string().uuid(),
    jerseyNumber: scale(0, 99).optional(),
    startsOn: dateString.optional(),
    endsOn: dateString.optional(),
  })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, {
    message: "La fecha de fin no puede ser anterior al inicio.",
    path: ["endsOn"],
  });

export const evaluationInputSchema = z.object({
  evaluatedOn: dateString,
  isakLevel: z.union([z.literal(1), z.literal(2)]).default(1),
  notes: optionalText(1000),
});

export const measurementInputSchema = z.object({
  variableCode: code,
  value: z.number().finite().min(0),
  unit: z.string().trim().min(1).max(20),
});

export type WellbeingInput = z.infer<typeof wellbeingInputSchema>;
export type NutritionInput = z.infer<typeof nutritionInputSchema>;
export type HydrationInput = z.infer<typeof hydrationInputSchema>;
export type TrainingInput = z.infer<typeof trainingInputSchema>;
export type PerformanceInput = z.infer<typeof performanceInputSchema>;
export type ProfessionalNoteInput = z.infer<typeof professionalNoteInputSchema>;
export type AthleteInput = z.infer<typeof athleteInputSchema>;
export type EvaluationInput = z.infer<typeof evaluationInputSchema>;
export type MeasurementInput = z.infer<typeof measurementInputSchema>;
