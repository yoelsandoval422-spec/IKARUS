import type { AppRole } from "@/types";

export type RouteArea = "professional" | "athlete";

/** Área de la aplicación a la que pertenece una ruta (null = pública/compartida). */
export function areaOf(path: string): RouteArea | null {
  if (path === "/profesional" || path.startsWith("/profesional/")) return "professional";
  if (path === "/deportista" || path.startsWith("/deportista/")) return "athlete";
  return null;
}

export function roleHome(role: AppRole): string {
  return role === "professional" ? "/profesional" : "/deportista";
}

/**
 * Devuelve una ruta interna segura o null. Evita redirecciones abiertas:
 * solo rutas relativas al propio sitio ("/algo"), nunca "//host", "/\\host",
 * esquemas ni caracteres de control.
 */
export function safeRedirectPath(input: string | null | undefined): string | null {
  if (!input || input.length > 200) return null;
  if (!input.startsWith("/") || input.startsWith("//") || input.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(input)) return null;
  try {
    const url = new URL(input, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/** Destino tras iniciar sesión: `next` solo si es segura y corresponde al rol. */
export function postLoginPath(role: AppRole, next: string | null | undefined): string {
  const safe = safeRedirectPath(next);
  if (!safe) return roleHome(role);
  const area = areaOf(safe.split("?")[0] ?? safe);
  const required: RouteArea | null = role === "professional" ? "professional" : "athlete";
  if (area !== null && area !== required) return roleHome(role);
  if (safe === "/login" || safe.startsWith("/login?")) return roleHome(role);
  return safe;
}
