import type { Metadata } from "next";
import Link from "next/link";
import { ErrorState, PageHeading } from "@/components/States";
import { getSessionContext } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Acceso denegado", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccessDeniedPage() {
  const ctx = await getSessionContext();
  const noAccount = ctx.mode === "demo" && ctx.reason === "no-access";
  const home = ctx.mode === "authenticated" ? roleHome(ctx.role) : "/";
  return (
    <>
      <PageHeading title="Acceso denegado" />
      <ErrorState title={noAccount ? "Tu cuenta no está habilitada en la aplicación" : "Tu cuenta no tiene permiso para ver esta sección"}>
        {noAccount ? (
          <p>Tu cuenta no tiene un perfil activo. Contacta al profesional responsable del plantel. Mientras tanto puedes cerrar sesión desde el encabezado.</p>
        ) : (
          <p>Cada rol accede solo a sus propias pantallas y datos.</p>
        )}
        <p className="mt-3">
          <Link href={home} className="font-semibold underline">Ir a mi inicio</Link>
        </p>
      </ErrorState>
    </>
  );
}
