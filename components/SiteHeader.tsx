import Link from "next/link";
import { Nav } from "@/components/Nav";
import { signOutAction } from "@/app/login/actions";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { BrandLogo } from "@/components/BrandLogo";
import { isDemoAllowed } from "@/lib/config";
import { mainNavFor, type NavAudience } from "@/lib/navigation";

const badge = "rounded-full border px-2.5 py-0.5 font-semibold";
const outlineLink =
  "rounded-md border-2 border-brand-700 px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50";

function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button type="submit" className="rounded-md border-2 border-slate-600 px-3 py-1.5 font-semibold hover:bg-slate-100">
        Cerrar sesión
      </button>
    </form>
  );
}

/** Indicador de sesión: deja claro si estás en demostración, con cuenta real o con un problema. */
export function SessionControls({ ctx }: { ctx: SessionContext }) {
  if (ctx.mode === "authenticated") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className={`${badge} border-emerald-700 bg-emerald-50 text-emerald-950`}>
          Sesión · {ctx.role === "professional" ? "profesional" : "deportista"}
        </span>
        <SignOutButton />
      </div>
    );
  }
  if (ctx.mode === "unavailable") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className={`${badge} border-red-700 bg-red-50 text-red-950`}>Sesión no verificada</span>
      </div>
    );
  }
  if (ctx.reason === "no-access") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className={`${badge} border-red-700 bg-red-50 text-red-950`}>Cuenta sin acceso</span>
        <SignOutButton />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={`${badge} border-amber-700 bg-amber-50 text-amber-950`}>
        {ctx.reason === "expired" ? "Sesión vencida" : "Modo demostración"}
      </span>
      <Link href="/login" className={outlineLink}>
        Ingresar
      </Link>
    </div>
  );
}

export function audienceOf(ctx: SessionContext, demoAllowed: boolean): NavAudience {
  if (ctx.mode === "authenticated") return ctx.role;
  if (ctx.mode === "demo" && demoAllowed && (ctx.reason === "not-configured" || ctx.reason === "no-session")) return "demo";
  return "visitor";
}

export async function SiteHeader() {
  const ctx = await getSessionContext();
  return (
    <header className="border-b border-slate-300 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" aria-label={`${BRAND.name}, ir al inicio`}>
          <BrandLogo />
        </Link>
        <Nav items={mainNavFor(audienceOf(ctx, isDemoAllowed()))} label="Navegación principal" />
        <SessionControls ctx={ctx} />
      </div>
    </header>
  );
}
