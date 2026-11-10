import type { Metadata } from "next";
import { ConfigWarning } from "@/components/ConfigWarning";
import { ConnectionCheck } from "@/components/ConnectionCheck";
import { PageHeading } from "@/components/States";
import { getSessionContext, type SessionContext } from "@/lib/auth/session";
import { isDemoAllowed } from "@/lib/config";
import { findExposedSecretVars, readSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic"; // leer entorno y sesión en cada petición

function sessionLabel(ctx: SessionContext): string {
  if (ctx.mode === "authenticated") {
    return ctx.role === "professional" ? "Iniciada · profesional" : "Iniciada · deportista";
  }
  if (ctx.mode === "unavailable") return "No verificada (error de conexión con el servicio de sesión)";
  switch (ctx.reason) {
    case "not-configured":
      return "Sin sesión · modo demostración (Supabase sin configurar)";
    case "expired":
      return "Sesión vencida";
    case "no-access":
      return "Cuenta sin perfil activo en la aplicación";
    default:
      return "Sin sesión · modo demostración";
  }
}

function dataLabel(ctx: SessionContext): string {
  if (ctx.mode === "authenticated") return "Base de datos (según tu rol)";
  if (ctx.mode === "unavailable") return "Ninguno (no se pudo verificar la sesión)";
  return ctx.reason === "expired" || ctx.reason === "no-access"
    ? "Ninguno hasta resolver la sesión"
    : "Solo demostración; no se guarda nada";
}

export default async function SettingsPage() {
  const status = readSupabaseEnv();
  const ctx = await getSessionContext();
  // Solo se informa presencia/validez; nunca se imprimen la URL ni las claves.
  const rows: [string, string][] = [
    ["Variable NEXT_PUBLIC_SUPABASE_URL", status.configured || !status.missing.includes("NEXT_PUBLIC_SUPABASE_URL") ? "Presente" : "Falta"],
    ["Variable NEXT_PUBLIC_SUPABASE_ANON_KEY", status.configured || !status.missing.includes("NEXT_PUBLIC_SUPABASE_ANON_KEY") ? "Presente" : "Falta"],
    ["Formato de las variables", status.configured ? "Válido" : status.reason === "invalid" ? "Inválido" : "No evaluable"],
    ["Inicio de sesión", status.configured ? "Disponible" : "No disponible (falta configuración)"],
    ["Modo demostración sin sesión", isDemoAllowed() ? "Permitido (APP_ALLOW_DEMO)" : "Desactivado: se exige iniciar sesión"],
    ["Sesión actual", sessionLabel(ctx)],
    ["Datos mostrados", dataLabel(ctx)],
    ["Cookies de sesión", "httpOnly, SameSite=Lax y Secure en producción"],
    ["Conexión con Supabase", "No verificada (usa el botón de abajo)"],
  ];
  const exposed = findExposedSecretVars(process.env);
  return (
    <>
      <PageHeading title="Configuración" subtitle="Estado de la conexión con Supabase." />
      <ConfigWarning status={status} />
      {exposed.length > 0 ? (
        <div role="alert" className="mt-4 rounded-md border-2 border-red-700 bg-red-50 p-4 text-sm text-red-950">
          <strong>⚠ Variables públicas con nombre o contenido de secreto:</strong> {exposed.join(", ")}.
          <p className="mt-1">
            Las variables <code>NEXT_PUBLIC_*</code> se incluyen en el código que descarga el navegador. Elimínalas y, si
            contenían una clave real, rótala en Supabase. (Solo se muestran los nombres, nunca los valores.)
          </p>
        </div>
      ) : null}
      <dl className="mt-4 divide-y divide-slate-200 rounded-lg border border-slate-300 bg-white text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="font-medium">{k}</dt>
            <dd className="text-right">{v}</dd>
          </div>
        ))}
      </dl>
      <ConnectionCheck enabled={ctx.mode === "authenticated" && ctx.role === "professional"} />
    </>
  );
}
