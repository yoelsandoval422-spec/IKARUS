"use client";

import { useMemo, useState } from "react";
import { AthleteTable } from "@/components/AthleteTable";
import { EMPTY_FILTERS, filterAthletes, type AthleteFilters } from "@/lib/athlete-filter";
import { STATUS_INFO } from "@/lib/status";
import type { AthleteSummary, DailyRecordStatus } from "@/types";

const fieldClass = "mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-2 text-sm";

export function AthleteList({ athletes }: { athletes: readonly AthleteSummary[] }) {
  const teams = useMemo(() => [...new Set(athletes.map((a) => a.team))].sort(), [athletes]);
  const categories = useMemo(() => [...new Set(athletes.map((a) => a.category))].sort(), [athletes]);
  const [filters, setFilters] = useState<AthleteFilters>(EMPTY_FILTERS);
  const results = useMemo(() => filterAthletes(athletes, filters), [athletes, filters]);
  const set = <K extends keyof AthleteFilters>(k: K, v: AthleteFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <form
        role="search"
        aria-label="Filtros del listado"
        onSubmit={(e) => e.preventDefault()}
        className="mb-4 grid gap-3 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div>
          <label htmlFor="f-q" className="text-sm font-medium">Buscar por nombre</label>
          <input id="f-q" type="search" className={fieldClass} value={filters.query}
            onChange={(e) => set("query", e.target.value)} placeholder="Ej.: Demo 03" />
        </div>
        <div>
          <label htmlFor="f-team" className="text-sm font-medium">Equipo</label>
          <select id="f-team" className={fieldClass} value={filters.team} onChange={(e) => set("team", e.target.value)}>
            <option value="">Todos</option>
            {teams.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-cat" className="text-sm font-medium">Categoría</label>
          <select id="f-cat" className={fieldClass} value={filters.category} onChange={(e) => set("category", e.target.value)}>
            <option value="">Todas</option>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="f-status" className="text-sm font-medium">Registro de hoy</label>
          <select id="f-status" className={fieldClass} value={filters.status}
            onChange={(e) => set("status", e.target.value as DailyRecordStatus | "")}>
            <option value="">Todos</option>
            {(Object.keys(STATUS_INFO) as DailyRecordStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_INFO[s].label}</option>
            ))}
          </select>
        </div>
      </form>
      <p className="mb-2 text-sm text-slate-700" aria-live="polite">
        Mostrando {results.length} de {athletes.length} deportistas.
      </p>
      <AthleteTable athletes={results} />
    </div>
  );
}
