import type { Metadata } from "next";
import { requireArea } from "@/lib/auth/guards";
import { AthleteList } from "@/components/AthleteList";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { ErrorState, PageHeading } from "@/components/States";
import { loadAthletes } from "@/lib/data/athletes";

export const metadata: Metadata = { title: "Deportistas" };
export const dynamic = "force-dynamic"; // depende de la sesión

export default async function AthletesPage() {
  await requireArea("professional", "/profesional/deportistas");
  const result = await loadAthletes();
  return (
    <>
      <PageHeading title="Deportistas" subtitle="Listado con búsqueda y filtros en el navegador." />
      {result.ok ? <DataSourceBanner source={result.source} /> : null}
      {result.ok ? (
        <AthleteList athletes={result.data} />
      ) : (
        <ErrorState title={result.error === "forbidden" ? "Acceso restringido" : "No se pudo cargar el listado"}>
          {result.message}
        </ErrorState>
      )}
    </>
  );
}
