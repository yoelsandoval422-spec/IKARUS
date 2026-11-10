import { redirect } from "next/navigation";
import { isDemoAllowed } from "@/lib/config";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { safeRedirectPath, type RouteArea } from "@/lib/auth/redirect";
import type { AppRole } from "@/types";

export type RouteDecision = { action: "allow" } | { action: "redirect"; to: string };

export const ACCESS_DENIED_PATH = "/acceso-denegado";
export const NO_CONNECTION_PATH = "/sin-conexion";

const REQUIRED_ROLE: Record<RouteArea, AppRole> = { professional: "professional", athlete: "athlete" };

/**
 * Decisión de acceso (función pura, probada de forma unitaria):
 *  - Supabase sin configurar → modo demostración si está permitida; si no (producción),
 *    /login, que explica que falta configurar (nunca se muestran datos ficticios).
 *  - No se pudo verificar la sesión (red/servicio) → /sin-conexion (nunca se muestran datos).
 *  - Sesión vencida → /login con aviso, aunque la demostración esté permitida.
 *  - Cuenta sin perfil activo → /acceso-denegado.
 *  - Sin sesión → demostración si está permitida; si no, /login con `next`.
 *  - Con sesión → el rol debe coincidir con el área; si no, /acceso-denegado.
 * Esto es la comprobación de la aplicación; la base de datos vuelve a aplicar RLS.
 */
export function authorizeRoute(
  ctx: SessionContext,
  area: RouteArea,
  opts: { demoAllowed: boolean; path: string },
): RouteDecision {
  const next = encodeURIComponent(safeRedirectPath(opts.path) ?? "/");
  if (ctx.mode === "unavailable") return { action: "redirect", to: `${NO_CONNECTION_PATH}?next=${next}` };
  if (ctx.mode === "demo") {
    if (ctx.reason === "expired") return { action: "redirect", to: `/login?next=${next}&motivo=sesion-vencida` };
    if (ctx.reason === "no-access") return { action: "redirect", to: ACCESS_DENIED_PATH };
    if ((ctx.reason === "no-session" || ctx.reason === "not-configured") && !opts.demoAllowed) return { action: "redirect", to: `/login?next=${next}` };
    return { action: "allow" };
  }
  return ctx.role === REQUIRED_ROLE[area]
    ? { action: "allow" }
    : { action: "redirect", to: ACCESS_DENIED_PATH };
}

/** Úsalo al inicio de cada página protegida (Server Components). */
export async function requireArea(area: RouteArea, path: string): Promise<SessionContext> {
  const ctx = await getSessionContext();
  const decision = authorizeRoute(ctx, area, { demoAllowed: isDemoAllowed(), path });
  if (decision.action === "redirect") redirect(decision.to);
  return ctx;
}
