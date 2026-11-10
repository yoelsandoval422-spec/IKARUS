import type { DailyRecordStatus } from "@/types";

export interface StatusInfo {
  label: string;
  /** Símbolo para no depender solo del color. */
  symbol: string;
  className: string;
}

export const STATUS_INFO: Record<DailyRecordStatus, StatusInfo> = {
  completed: { label: "Completado", symbol: "✓", className: "bg-emerald-50 text-emerald-900 border-emerald-700" },
  in_progress: { label: "En curso", symbol: "◐", className: "bg-amber-50 text-amber-900 border-amber-700" },
  pending: { label: "Pendiente", symbol: "○", className: "bg-slate-100 text-slate-900 border-slate-600" },
};

/** Deriva el estado diario a partir de la cantidad de secciones completadas. */
export function statusFromProgress(done: number, total: number): DailyRecordStatus {
  if (total <= 0 || done <= 0) return "pending";
  return done >= total ? "completed" : "in_progress";
}
