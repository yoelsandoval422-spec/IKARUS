export type AuthFailure = "no-session" | "expired" | "unavailable";

interface AuthErrorLike {
  /** Los errores reales de Supabase Auth siempre traen `message`; aquí no se usa ni se muestra. */
  message?: string;
  name?: string;
  status?: number;
  code?: string;
}

const EXPIRED_CODES = new Set([
  "bad_jwt",
  "session_expired",
  "session_not_found",
  "refresh_token_not_found",
  "refresh_token_already_used",
]);

/**
 * Clasifica un error de `auth.getUser()` para mostrar el estado correcto:
 *  - "no-session": nunca hubo sesión (o no hay datos suficientes para afirmar otra cosa);
 *  - "expired": había una sesión que ya no es válida (token vencido o revocado);
 *  - "unavailable": no se pudo consultar el servicio (red caída o error 5xx): NO se debe
 *    confundir con "sin sesión", porque el usuario podría estar autenticado.
 */
export function classifyAuthFailure(error: AuthErrorLike | null | undefined): AuthFailure {
  if (!error) return "no-session";
  if (error.name === "AuthSessionMissingError") return "no-session";
  if (
    error.name === "AuthRetryableFetchError" ||
    error.status === 0 ||
    (typeof error.status === "number" && error.status >= 500)
  ) {
    return "unavailable";
  }
  if (
    error.name === "AuthInvalidJwtError" ||
    (error.code !== undefined && EXPIRED_CODES.has(error.code)) ||
    error.status === 401 ||
    error.status === 403
  ) {
    return "expired";
  }
  return "no-session";
}
