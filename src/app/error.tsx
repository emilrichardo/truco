"use client";
// Error boundary global. Reemplaza el "Application error" genérico de Next por
// un panel con el mensaje real para debuggear en producción.
import { useEffect } from "react";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[truco] error global:", error);
  }, [error]);

  return (
    <main className="min-h-[100dvh] px-4 py-10 max-w-xl mx-auto">
      <div className="card p-5">
        <h1 className="font-display text-xl text-dorado mb-2">
          Algo salió mal
        </h1>
        <pre className="text-xs text-text-dim whitespace-pre-wrap break-words bg-surface-2 p-3 rounded border border-border max-h-[60vh] overflow-auto">
          {error?.name ? `${error.name}: ` : ""}
          {error?.message || String(error)}
          {error?.stack ? `\n\n${error.stack}` : ""}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="flex gap-2 mt-4">
          <button onClick={reset} className="btn btn-primary flex-1">
            Reintentar
          </button>
          <a href="/" className="btn flex-1">
            Inicio
          </a>
        </div>
      </div>
    </main>
  );
}
