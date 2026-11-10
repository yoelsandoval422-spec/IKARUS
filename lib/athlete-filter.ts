import type { AthleteSummary, DailyRecordStatus } from "@/types";

export interface AthleteFilters {
  query: string;
  team: string; // "" = todos
  category: string; // "" = todas
  status: DailyRecordStatus | ""; // "" = todos
}

export const EMPTY_FILTERS: AthleteFilters = { query: "", team: "", category: "", status: "" };

const normalize = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();

/** Filtra en el navegador; no consulta ningún servidor. */
export function filterAthletes(
  athletes: readonly AthleteSummary[],
  filters: AthleteFilters,
): AthleteSummary[] {
  const q = normalize(filters.query);
  return athletes.filter(
    (a) =>
      (q === "" || normalize(a.displayName).includes(q)) &&
      (filters.team === "" || a.team === filters.team) &&
      (filters.category === "" || a.category === filters.category) &&
      (filters.status === "" || a.dailyStatus === filters.status),
  );
}

export function countByStatus(athletes: readonly AthleteSummary[]): Record<DailyRecordStatus, number> {
  const counts: Record<DailyRecordStatus, number> = { pending: 0, in_progress: 0, completed: 0 };
  for (const a of athletes) counts[a.dailyStatus] += 1;
  return counts;
}
