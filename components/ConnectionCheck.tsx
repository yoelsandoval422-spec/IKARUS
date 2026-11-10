"use client";

import { useActionState } from "react";
import { checkConnectionAction, type ConnectionCheckState } from "@/app/configuracion/actions";

export function ConnectionCheck({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(
    async (): Promise<ConnectionCheckState> => checkConnectionAction(),
    {} as ConnectionCheckState,
  );
  return (
    <section aria-labelledby="verif" className="mt-6 rounded-lg border border-slate-300 bg-white p-4">
      <h2 id="verif" className="text-lg font-bold">Verificar conexión</h2>
      <p className="mt-1 text-sm text-slate-700">
        Hace peticiones reales a tu proyecto de Supabase. Hasta que lo ejecutes, la conexión figura como <strong>no verificada</strong>.
      </p>
      <form action={action} className="mt-3">
        <button
          type="submit" disabled={!enabled || pending}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Verificando…" : "Verificar ahora"}
        </button>
        {!enabled ? <span className="ml-3 text-sm text-slate-700">Disponible al iniciar sesión como profesional.</span> : null}
      </form>
      <div aria-live="polite">
        {state.error ? <p className="mt-3 text-sm font-medium text-red-800">⚠ {state.error}</p> : null}
        {state.steps ? (
          <ul className="mt-3 space-y-1 text-sm">
            {state.steps.map((s) => (
              <li key={s.name}>
                <span aria-hidden="true">{s.ok ? "✓" : "✗"} </span>
                <strong>{s.name}:</strong> {s.ok ? "correcto" : "falló"} — {s.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
