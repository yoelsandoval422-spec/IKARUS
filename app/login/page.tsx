import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { ConfigWarning } from "@/components/ConfigWarning";
import { LoginForm } from "@/components/LoginForm";
import { PageHeading } from "@/components/States";
import { getSessionContext } from "@/lib/auth/session";
import { MSG_SESSION_EXPIRED } from "@/lib/auth/login";
import { BRAND_FULL_TAGLINE } from "@/lib/brand";
import { roleHome, safeRedirectPath } from "@/lib/auth/redirect";
import { readSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Ingresar", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[]; motivo?: string | string[] }> }) {
  const { next, motivo } = await searchParams;
  const ctx = await getSessionContext();
  if (ctx.mode === "authenticated") redirect(roleHome(ctx.role));

  const status = readSupabaseEnv();
  const expired = (Array.isArray(motivo) ? motivo[0] : motivo) === "sesion-vencida" || (ctx.mode === "demo" && ctx.reason === "expired");
  const safeNext = safeRedirectPath(Array.isArray(next) ? next[0] : next) ?? undefined;
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <BrandLogo size="lg" />
        <p className="mt-3 text-sm font-medium text-slate-700">{BRAND_FULL_TAGLINE}</p>
      </div>
      <PageHeading title="Ingresar" subtitle="Usa la cuenta que te dio el profesional responsable del plantel." />
      {expired ? (
        <p role="status" className="mb-4 rounded-md border-2 border-amber-700 bg-amber-50 p-3 text-sm font-medium text-amber-950">
          <span aria-hidden="true">⏱ </span>
          {MSG_SESSION_EXPIRED}
        </p>
      ) : null}
      {status.configured ? null : <div className="mb-4"><ConfigWarning status={status} /></div>}
      <div className="rounded-lg border border-slate-300 bg-white p-4">
        <LoginForm next={safeNext} disabled={!status.configured} />
      </div>
      <p className="mt-4 text-sm text-slate-700">
        ¿No tienes cuenta o olvidaste tu contraseña? Pídele al profesional que la cree o la restablezca.
        Mientras no inicies sesión solo verás datos de demostración, que no son reales.
      </p>
    </div>
  );
}
