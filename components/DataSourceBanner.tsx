import { DemoBanner } from "@/components/DemoBanner";
import type { DataSource } from "@/lib/data/result";

/** Deja siempre claro de dónde vienen los datos. */
export function DataSourceBanner({ source }: { source: DataSource }) {
  if (source === "demo") {
    return (
      <DemoBanner message="Modo demostración: no hay sesión iniciada y nada de lo que veas o escribas se guarda como información real." />
    );
  }
  return (
    <p role="note" className="mb-4 rounded-md border border-emerald-700 bg-emerald-50 px-4 py-2 text-sm text-emerald-950">
      <strong>Datos reales · </strong>
      Se muestran solo los deportistas que tienes asignados.
    </p>
  );
}
