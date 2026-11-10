import { isDemoAllowed } from "@/lib/config";
import type { SupabaseEnvStatus } from "@/lib/supabase/env";

/** Aviso de configuración de Supabase. Nunca imprime URL ni claves. */
export function ConfigWarning({ status, demo = isDemoAllowed() }: { status: SupabaseEnvStatus; demo?: boolean }) {
  if (status.configured) {
    return (
      <div role="status" className="rounded-md border border-emerald-700 bg-emerald-50 p-4 text-emerald-950">
        <strong>✓ Variables de Supabase detectadas.</strong>
        <p className="mt-1 text-sm">
          Las variables existen y tienen formato válido. Esto solo comprueba el formato:
          no se verificó que el proyecto de Supabase responda ni que las migraciones estén aplicadas.
          {demo ? "Sin sesión iniciada la aplicación sigue en modo demostración." : "Para entrar hay que iniciar sesión."}
        </p>
      </div>
    );
  }
  if (status.reason === "privileged-key") {
    return (
      <div role="alert" className="rounded-md border-2 border-red-700 bg-red-50 p-4 text-red-950">
        <strong>⚠ La clave configurada parece una clave privilegiada.</strong>
        <p className="mt-1 text-sm">
          Las claves <code>service_role</code> o <code>sb_secret_…</code> nunca deben usarse en la aplicación web: darían
          acceso total a la base. La aplicación las ignora{demo ? " y sigue en modo demostración" : " y no permite iniciar sesión"}. Reemplázala por la clave
          pública (anon/publishable) y, si la clave privilegiada estuvo expuesta, rótala en el panel de Supabase.
        </p>
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-md border-2 border-amber-700 bg-amber-50 p-4 text-amber-950">
      <strong>⚠ Supabase no está configurado.</strong>
      <p className="mt-1 text-sm">
        {status.reason === "missing"
          ? `Faltan variables: ${status.missing.join(", ")}.`
          : "Las variables existen pero no tienen un formato válido."}{" "}
        {demo ? (
          <>
            La aplicación funciona igualmente en modo demostración. Copia <code>.env.example</code> a{" "}
            <code>.env.local</code> y completa los valores públicos.
          </>
        ) : (
          "Todavía no se puede iniciar sesión. Quien administra el sitio debe cargar esas variables en Vercel (Settings → Environment Variables) y volver a desplegar."
        )}
      </p>
    </div>
  );
}
