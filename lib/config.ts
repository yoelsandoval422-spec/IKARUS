/**
 * ¿Se permite el modo demostración a visitantes sin sesión?
 *  - En PRODUCCIÓN (NODE_ENV=production, como en Vercel) está DESACTIVADO por defecto:
 *    quien no inicie sesión es enviado a /login y nunca ve datos ficticios.
 *    Solo se activa si se define explícitamente APP_ALLOW_DEMO=true.
 *  - En desarrollo y pruebas está permitido por defecto (la app funciona sin Supabase).
 *  - Un valor que no se reconoce nunca abre la demostración en producción.
 */
const TRUE_VALUES = ["true", "1", "yes", "si", "sí", "on"];
const FALSE_VALUES = ["false", "0", "no", "off"];

export function isDemoAllowed(
  value: string | undefined = process.env.APP_ALLOW_DEMO,
  production: boolean = process.env.NODE_ENV === "production",
): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (FALSE_VALUES.includes(v)) return false;
  if (TRUE_VALUES.includes(v)) return true;
  return !production;
}
