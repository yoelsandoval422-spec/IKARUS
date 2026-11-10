import { z } from "zod";

/** Esquemas de los formularios DEMOSTRATIVOS del deportista (no se guardan datos). */
const num = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label}: ingresa un valor.`)
    .refine((v) => !Number.isNaN(Number(v)), `${label}: debe ser un número.`)
    .refine((v) => Number(v) >= min && Number(v) <= max, `${label}: debe estar entre ${min} y ${max}.`);

export const wellbeingSchema = z.object({
  sleepHours: num("Horas de sueño", 0, 24),
  energy: num("Nivel de energía", 1, 5),
});

export const nutritionSchema = z.object({
  meal: z.string().trim().min(1, "Comida: elige una opción."),
  description: z.string().trim().min(3, "Descripción: escribe al menos 3 caracteres.").max(300, "Descripción: máximo 300 caracteres."),
});

export const hydrationSchema = z.object({
  ml: num("Líquido (ml)", 0, 10000),
});

export const trainingSchema = z.object({
  minutes: num("Duración (min)", 0, 600),
  effort: num("Esfuerzo percibido", 1, 10),
});

export type FormErrors = Record<string, string>;

/** Convierte un resultado de Zod en un mapa campo → mensaje. */
export function collectErrors(error: z.ZodError): FormErrors {
  const out: FormErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
