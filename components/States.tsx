import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-400 bg-white p-8 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {children ? <div className="mt-1 text-sm text-slate-700">{children}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Ocurrió un error",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="rounded-lg border-2 border-red-700 bg-red-50 p-6 text-red-950">
      <p className="font-semibold">
        <span aria-hidden="true">⚠ </span>
        {title}
      </p>
      {children ? <div className="mt-1 text-sm">{children}</div> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="p-8 text-center text-slate-700">
      <span
        aria-hidden="true"
        className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent align-middle"
      />
      {label}
    </div>
  );
}

export function PageHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
      {subtitle ? <p className="mt-1 text-slate-700">{subtitle}</p> : null}
    </div>
  );
}
