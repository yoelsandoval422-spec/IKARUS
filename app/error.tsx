"use client";

import { ErrorState } from "@/components/States";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No se pudo mostrar esta pantalla"
      action={
        <button type="button" onClick={reset} className="rounded-md bg-red-800 px-4 py-2 text-sm font-semibold text-white">
          Reintentar
        </button>
      }
    >
      Ocurrió un problema inesperado. Puedes reintentar o volver al inicio.
    </ErrorState>
  );
}
