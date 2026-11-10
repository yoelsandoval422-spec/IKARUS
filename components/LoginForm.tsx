"use client";

import { useActionState } from "react";
import { signInAction } from "@/app/login/actions";
import type { LoginState } from "@/lib/auth/login";

const input = "mt-1 w-full rounded-md border border-slate-500 bg-white px-3 py-3 text-base disabled:bg-slate-100";
const initial: LoginState = {};

export function LoginForm({ next, disabled = false }: { next?: string; disabled?: boolean }) {
  const [state, formAction, pending] = useActionState(signInAction, initial);
  return (
    <form action={formAction} noValidate className="space-y-4" aria-describedby={state.error ? "login-error" : undefined}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <p id="login-error" role="alert" className="rounded-md border-2 border-red-700 bg-red-50 p-3 text-sm font-medium text-red-950">
          <span aria-hidden="true">⚠ </span>
          {state.error}
        </p>
      ) : null}
      <div>
        <label htmlFor="email" className="block text-base font-medium">Correo electrónico</label>
        <input
          id="email" name="email" type="email" autoComplete="username" inputMode="email"
          defaultValue={state.email ?? ""} disabled={disabled || pending} className={input}
          aria-invalid={state.fieldErrors?.email ? true : undefined}
          aria-describedby={state.fieldErrors?.email ? "email-err" : undefined}
        />
        {state.fieldErrors?.email ? <p id="email-err" className="mt-1 text-sm font-medium text-red-800">⚠ {state.fieldErrors.email}</p> : null}
      </div>
      <div>
        <label htmlFor="password" className="block text-base font-medium">Contraseña</label>
        <input
          id="password" name="password" type="password" autoComplete="current-password"
          disabled={disabled || pending} className={input}
          aria-invalid={state.fieldErrors?.password ? true : undefined}
          aria-describedby={state.fieldErrors?.password ? "password-err" : undefined}
        />
        {state.fieldErrors?.password ? <p id="password-err" className="mt-1 text-sm font-medium text-red-800">⚠ {state.fieldErrors.password}</p> : null}
      </div>
      <button
        type="submit" disabled={disabled || pending}
        className="min-h-12 w-full rounded-lg bg-brand-700 px-4 py-3 text-base font-semibold text-white hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
