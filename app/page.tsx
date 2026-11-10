import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { DemoBanner } from "@/components/DemoBanner";
import { getSessionContext } from "@/lib/auth/session";
import { roleHome } from "@/lib/auth/redirect";
import { BRAND } from "@/lib/brand";
import { isDemoAllowed } from "@/lib/config";

export const dynamic = "force-dynamic";

const primary =
  "inline-flex min-h-11 items-center rounded-md bg-slate-950 px-5 py-2.5 font-semibold text-white hover:bg-slate-800";
const cardClass = "block rounded-lg border-2 border-slate-300 bg-white p-6 shadow-sm hover:border-amber-600";

export default async function HomePage() {
  const ctx = await getSessionContext();
  const showDemo = ctx.mode === "demo" && isDemoAllowed() && (ctx.reason === "no-session" || ctx.reason === "not-configured");
  return (
    <>
      <section className="py-6 sm:py-10">
        <BrandLogo size="lg" />
        <p className="mt-6 text-2xl font-bold text-slate-900 sm:text-3xl">{BRAND.tagline}</p>
        <p className="mt-3 max-w-2xl text-lg text-slate-700">{BRAND.concept}</p>
        <p className="mt-3 max-w-2xl text-slate-700">{BRAND.description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {ctx.mode === "authenticated" ? (
            <Link href={roleHome(ctx.role)} className={primary}>
              {ctx.role === "professional" ? "Ir a mi panel" : "Ir a mi registro"}
            </Link>
          ) : (
            <Link href="/login" className={primary}>
              Ingresar
            </Link>
          )}
        </div>
      </section>
      {showDemo ? (
        <>
          <DemoBanner message="Estás viendo IKARU en modo demostración: los datos son ficticios y nada se guarda. Es solo para desarrollo; en la versión publicada se exige iniciar sesión." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Link href="/deportista" className={cardClass}>
              <h2 className="text-xl font-bold text-slate-950">Soy deportista</h2>
              <p className="mt-2 text-slate-700">Recorrer la pantalla de registro diario (demostrativa).</p>
            </Link>
            <Link href="/profesional" className={cardClass}>
              <h2 className="text-xl font-bold text-slate-950">Soy profesional</h2>
              <p className="mt-2 text-slate-700">Recorrer el panel de seguimiento (con datos ficticios).</p>
            </Link>
          </div>
        </>
      ) : null}
    </>
  );
}
