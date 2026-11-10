import type { Metadata } from "next";
import { requireArea } from "@/lib/auth/guards";
import { EmptyState, PageHeading } from "@/components/States";

export const metadata: Metadata = { title: "Informes" };

export const dynamic = "force-dynamic"; // depende de la sesión

export default async function ReportsPage() {
  await requireArea("professional", "/profesional/informes");
  return (
    <>
      <PageHeading title="Informes" subtitle="Informes individuales y de equipo." />
      <EmptyState title="Todavía no hay informes">
        La generación de informes se implementará en una etapa posterior, cuando existan datos reales que resumir.
      </EmptyState>
    </>
  );
}
