/**
 * Tipos de las filas de la base de datos (espejo de supabase/migrations).
 * Están escritos a mano; cuando exista un proyecto de Supabase conectado se
 * pueden regenerar con `supabase gen types typescript` y sustituir este archivo.
 * Las fechas `date` viajan como "YYYY-MM-DD" y los `timestamptz` como ISO 8601.
 */
import type { AppRole } from "@/types";

export type { AppRole };
export type MealType = "breakfast" | "lunch" | "snack" | "dinner" | "supplement";
export type SessionType = "training" | "match" | "gym" | "recovery" | "other";
export type IsakLevel = 1 | 2;

interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface ProfileRow extends Timestamps {
  id: string;
  role: AppRole;
  display_name: string | null;
  is_active: boolean;
}

export interface CategoryRow { id: number; name: string; created_at: string }
export interface PositionRow { id: number; code: string; name: string; created_at: string }

export interface TeamRow extends Timestamps {
  id: string;
  name: string;
  category_id: number | null;
  season: string | null;
  is_active: boolean;
}

export interface AthleteRow extends Timestamps {
  id: string;
  user_id: string | null;
  display_name: string;
  birth_date: string | null;
  category_id: number | null;
  position_id: number | null;
  is_active: boolean;
  created_by: string | null;
}

export interface ProfessionalAthleteRow {
  professional_id: string;
  athlete_id: string;
  assigned_at: string;
}

export interface TeamMembershipRow {
  id: string;
  athlete_id: string;
  team_id: string;
  jersey_number: number | null;
  starts_on: string;
  ends_on: string | null;
  created_at: string;
}

interface OwnedRecord extends Timestamps {
  id: string;
  athlete_id: string;
  created_by: string;
}

export interface WellbeingRecordRow extends OwnedRecord {
  record_date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  muscle_soreness: number | null;
  stress: number | null;
  mood: number | null;
  notes: string | null;
}

export interface NutritionRecordRow extends OwnedRecord {
  record_date: string;
  meal: MealType;
  description: string;
}

export interface HydrationRecordRow extends OwnedRecord {
  record_date: string;
  total_ml: number;
  urine_color: number | null;
}

export interface TrainingRecordRow extends OwnedRecord {
  record_date: string;
  session_number: number;
  session: SessionType;
  duration_min: number;
  rpe: number | null;
  notes: string | null;
}

export interface PerformanceRecordRow extends OwnedRecord {
  record_date: string;
  metric_code: string;
  value: number;
  unit: string;
  notes: string | null;
}

export interface ProfessionalNoteRow extends OwnedRecord {
  note_date: string;
  body: string;
  shared_with_athlete: boolean;
}

export interface AnthropometricEvaluationRow extends OwnedRecord {
  evaluated_on: string;
  isak_level: IsakLevel;
  notes: string | null;
}

export interface AnthropometricMeasurementRow {
  id: string;
  evaluation_id: string;
  variable_code: string;
  value: number;
  unit: string;
  created_at: string;
}

/** Secciones del registro diario del deportista y su tabla. */
export const DAILY_SECTION_TABLES = {
  wellbeing: "wellbeing_records",
  nutrition: "nutrition_records",
  hydration: "hydration_records",
  training: "training_records",
} as const;
