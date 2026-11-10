import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoAllowed } from "@/lib/config";
import { areaOf } from "@/lib/auth/redirect";
import { authCookieOptions } from "./cookies";
import { readSupabaseEnv, type SupabaseEnvStatus } from "./env";

/**
 * Renovación de sesión (patrón recomendado por Supabase SSR para el `proxy.ts` de Next 16):
 *  1) lee las cookies de la petición;
 *  2) `getClaims()` valida el JWT y renueva el token si caducó;
 *  3) las cookies renovadas se escriben en la petición (para que los Server Components
 *     lean el token nuevo) y en la respuesta (para el navegador).
 * Además hace una redirección OPTIMISTA a /login cuando el modo demostración está
 * desactivado y no hay sesión. No consulta la base ni el rol: la autorización real
 * ocurre en cada página (lib/auth/guards.ts) y en las políticas RLS.
 */
export async function updateSession(
  request: NextRequest,
  status: SupabaseEnvStatus = readSupabaseEnv(),
  demoAllowed: boolean = isDemoAllowed(),
): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  if (!status.configured) return response;

  const supabase = createServerClient(status.url, status.anonKey, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items, headers) => {
        for (const { name, value } of items) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) response.cookies.set(name, value, options);
        // Evita que una CDN/caché guarde respuestas con cookies de sesión.
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });

  let hasSession = false;
  try {
    const { data } = await supabase.auth.getClaims();
    hasSession = Boolean(data?.claims);
  } catch {
    hasSession = false; // fallo de red: se deja pasar; las páginas vuelven a verificar
  }

  const { pathname, search } = request.nextUrl;
  if (!hasSession && !demoAllowed && areaOf(pathname) !== null) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const hadSessionCookie = request.cookies.getAll().some((c) => /^sb-.+-auth-token/.test(c.name));
    url.search = `?next=${encodeURIComponent(pathname + search)}${hadSessionCookie ? "&motivo=sesion-vencida" : ""}`;
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}
