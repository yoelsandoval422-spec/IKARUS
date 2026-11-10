import type { AthleteSummary } from "@/types";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/States";

export function AthleteTable({ athletes }: { athletes: readonly AthleteSummary[] }) {
  if (athletes.length === 0) {
    return (
      <EmptyState title="Sin resultados">
        Ningún deportista coincide con los filtros.
      </EmptyState>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <caption className="sr-only">Deportistas</caption>
        <thead className="bg-slate-100 text-slate-800">
          <tr>
            <th scope="col" className="px-3 py-2">Deportista</th>
            <th scope="col" className="px-3 py-2">Equipo</th>
            <th scope="col" className="px-3 py-2">Categoría</th>
            <th scope="col" className="px-3 py-2">Registro de hoy</th>
          </tr>
        </thead>
        <tbody>
          {athletes.map((a) => (
            <tr key={a.id} className="border-t border-slate-200">
              <th scope="row" className="px-3 py-2 font-medium">{a.displayName}</th>
              <td className="px-3 py-2">{a.team}</td>
              <td className="px-3 py-2">{a.category}</td>
              <td className="px-3 py-2"><StatusBadge status={a.dailyStatus} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
