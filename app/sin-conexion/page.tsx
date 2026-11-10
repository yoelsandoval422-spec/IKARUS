import type { Metadata } from "next";
import { ErrorState, PageHeading } from "@/components/States";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Sin conexión", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NoConnectionPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const retry = safeRedirectPath(Array.isArray(next) ? next[0] : next) ?? "/";
  return (
    <>
      <PageHeading title="No se pudo verificar tu sesión" />
      <ErrorState title="Problema de conexión">
        <p>
          No fue posible comunicarse con el servicio de sesión. Tus datos no se muestran hasta poder confirmar quién eres.
          Revisa tu conexión a internet e intenta de nuevo. Si el problema continúa, avisa al profesional responsable.
        </p>
        <p className="mt-3">
          {/* Enlace normal a propósito (no <Link>): fuerza una carga completa para que el encabezado
              recalcule el estado de la sesión; con navegación blanda quedaría "Sesión no verificada". */}
          <a href={retry} className="font-semibold underline">Reintentar</a>
        </p>
      </ErrorState>
    </>
  );
}
