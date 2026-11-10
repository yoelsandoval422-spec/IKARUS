import type { Metadata } from "next";
import { requireArea } from "@/lib/auth/guards";
import { EmptyState, PageHeading } from "@/components/States";

export const metadata: Metadata = { title: "Evaluaciones" };

export const dynamic = "force-dynamic"; // depende de la sesión

export default async function EvaluationsPage() {
  await requireArea("professional", "/profesional/evaluaciones");
  return (
    <>
      <PageHeading title="Evaluaciones" subtitle="Módulo antropométrico ISAK Nivel 1 (ampliable a Nivel 2)." />
      <EmptyState title="Módulo aún no implementado">
        El registro de mediciones y los cálculos antropométricos se desarrollarán en una etapa posterior.
        Esta pantalla solo reserva el lugar del módulo.
      </EmptyState>
    </>
  );
}
