import type { Metadata } from "next";
import { DemoBanner } from "@/components/DemoBanner";
import { DemoRecordForms } from "@/components/DemoRecordForms";
import { PageHeading } from "@/components/States";
import { requireArea } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Deportista" };
export const dynamic = "force-dynamic"; // depende de la sesión

export default async function AthleteHomePage() {
  const ctx = await requireArea("athlete", "/deportista");
  const loggedIn = ctx.mode === "authenticated";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeading
        title={loggedIn ? "Tu registro de hoy" : "Registro diario (demostración)"}
        subtitle="Completa tu registro de hoy en cuatro pasos cortos."
      />
      <DemoBanner
        message={
          loggedIn
            ? "Iniciaste sesión, pero la carga real de registros todavía no está disponible: estos formularios son demostrativos y NO guardan nada."
            : "Los formularios son demostrativos: validan lo que escribes pero no guardan ningún dato."
        }
      />
      <DemoRecordForms />
    </div>
  );
}
