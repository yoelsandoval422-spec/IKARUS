import { z } from "zod";

export const MSG_CONNECTION =
  "No se pudo conectar con el servicio de autenticación. Intenta de nuevo en un momento.";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Ingresa tu correo.")
    .max(254, "El correo es demasiado largo.")
    .email("El correo no tiene un formato válido."),
  password: z.string().min(1, "Ingresa tu contraseña.").max(200, "La contraseña es demasiado larga."),
});

export interface LoginState {
  /** Error general (credenciales, conexión, configuración). */
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  /** Se devuelve solo el correo para no obligar a reescribirlo; nunca la contraseña. */
  email?: string;
}

interface AuthErrorLike {
  status?: number;
  code?: string;
  name?: string;
}

/**
 * Traduce errores de Supabase Auth a mensajes claros en español.
 * No se muestra el texto original (podría filtrar detalles) y las credenciales
 * incorrectas usan un mensaje único para no revelar si el correo existe.
 */
export function mapAuthError(error: AuthErrorLike): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials" || code === "user_not_found") return "Correo o contraseña incorrectos.";
  if (code === "email_not_confirmed") return "Debes confirmar tu correo antes de ingresar.";
  if (code === "user_banned") return "Tu cuenta está deshabilitada. Contacta al profesional responsable.";
  if (error.status === 429 || code.includes("rate_limit")) return "Demasiados intentos. Espera unos minutos e intenta de nuevo.";
  if (error.name === "AuthRetryableFetchError" || (error.status !== undefined && error.status >= 500) || error.status === 0) {
    return MSG_CONNECTION;
  }
  if (error.status === 400 || error.status === 401 || error.status === 422) return "Correo o contraseña incorrectos.";
  return "No se pudo iniciar sesión. Intenta de nuevo.";
}

export const MSG_NOT_CONFIGURED =
  "El inicio de sesión no está disponible porque Supabase no está configurado. La aplicación sigue en modo demostración.";
export const MSG_NO_PROFILE =
  "Tu cuenta todavía no está habilitada en la aplicación. Contacta al profesional responsable.";
export const MSG_SESSION_EXPIRED = "Tu sesión venció. Ingresa de nuevo para continuar.";
