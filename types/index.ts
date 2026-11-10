/** Estado del registro diario de un deportista. */
export type DailyRecordStatus = "pending" | "completed" | "in_progress";

/** Roles de la aplicación. Se asignarán desde el servidor; el deportista nunca elige su rol. */
export type AppRole = "athlete" | "professional";

/** Resumen de un deportista. En el Bloque 1 solo existen datos de DEMOSTRACIÓN. */
export interface AthleteSummary {
  id: string;
  /** Nombre visible ficticio, p. ej. "Deportista Demo 01". */
  displayName: string;
  team: string;
  category: string;
  dailyStatus: DailyRecordStatus;
}

export type RecordSection = "wellbeing" | "nutrition" | "hydration" | "training";

export interface NavItem {
  href: string;
  label: string;
  description?: string;
}
