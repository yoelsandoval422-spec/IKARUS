import type { Metadata } from "next";
import { requireArea } from "@/lib/auth/guards";
import Link from "next/link";
import { AthleteTable } from "@/components/AthleteTable";
import { DataSourceBanner } from "@/components/DataSourceBanner";
import { SummaryCard } from "@/components/SummaryCard";
import { ErrorState, PageHeading } from "@/components/States";
import { countByStatus } from "@/lib/athlete-filter";
import { loadAthletes } from "@/lib/data/athletes";

export const metadata: Metadata = { title: "Panel profesional" };
export const dynamic = "force-dynamic"; // depende de la sesión

const links = [
  { href: "/profesional/deportistas", label: "Seguimiento diario" },
  { href: "/profesional/evaluaciones", label: "Evaluaciones" },
  { href: "/profesional/informes", label: "Informes" },
];

export default async function ProfessionalDashboardPage() {
  await requireArea("professional", "/profesional");
  const result = await loadAthletes();
  const demo = result.source === "demo";
  return (
    <>
      <PageHeading title="Panel profesional" subtitle={demo ? "Resumen del día (demostración)." : "Resumen del día."} />
      {result.ok ? <DataSourceBanner source={result.source} /> : null}
      {result.ok ? <Summary athletes={result.data} demo={demo} /> : (
        <ErrorState title={result.error === "forbidden" ? "Acceso restringido" : "No se pudo cargar el panel"}>
          {result.message}
        </ErrorState>
      )}
    </>
  );
}

function Summary({ athletes, demo }: { athletes: Parameters<typeof countByStatus>[0]; demo: boolean }) {
  const counts = countByStatus(athletes);
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard title={demo ? "Deportistas (demo)" : "Deportistas"} value={athletes.length} />
        <SummaryCard title="Completaron hoy" value={counts.completed} />
        <SummaryCard title="En curso" value={counts.in_progress} />
        <SummaryCard title="Pendientes" value={counts.pending} />
      </div>
      <nav aria-label="Accesos rápidos" className="mb-6 flex flex-wrap gap-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-md border-2 border-brand-700 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
            {l.label}
          </Link>
        ))}
      </nav>
      <h2 className="mb-2 text-lg font-bold">Deportistas</h2>
      <AthleteTable athletes={athletes} />
    </>
  );
}
