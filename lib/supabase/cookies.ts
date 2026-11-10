import type { CookieOptions } from "@supabase/ssr";

/**
 * Opciones de las cookies de sesión. @supabase/ssr usa por defecto `httpOnly: false`
 * (para que un cliente de navegador pueda leerlas). Esta aplicación autentica SOLO en el
 * servidor (Server Actions, proxy y Server Components), así que el navegador nunca necesita
 * leer el token: con `httpOnly` un fallo XSS no puede robar la sesión.
 *  - `secure` en producción (solo HTTPS); en desarrollo local (http) se permite sin él.
 *  - `sameSite: "lax"` mitiga CSRF.
 * Si algún día se usa el cliente de Supabase en el navegador con sesión, habrá que revisar esto.
 */
export function authCookieOptions(production: boolean = process.env.NODE_ENV === "production"): CookieOptions {
  return { httpOnly: true, secure: production, sameSite: "lax", path: "/" };
}
