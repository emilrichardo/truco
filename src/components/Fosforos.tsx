"use client";
// Contador de puntos visualizado como fósforos. Cada grupo: 4 verticales + 1 cruzado = 5 pts.
import clsx from "clsx";

export function Fosforos({
  puntos,
  objetivo,
  etiqueta,
  destacado
}: {
  puntos: number;
  objetivo: 15 | 30;
  etiqueta: string;
  destacado?: boolean;
}) {
  const grupos = Math.floor(puntos / 5);
  const restantes = puntos % 5;
  const items: JSX.Element[] = [];
  for (let g = 0; g < grupos; g++) {
    items.push(
      <span key={`g${g}`} className="inline-block relative mx-1">
        <span className="fosforo" />
        <span className="fosforo" />
        <span className="fosforo" />
        <span className="fosforo" />
        <span className="fosforo cruzado" />
      </span>
    );
  }
  if (restantes > 0) {
    items.push(
      <span key="resto" className="inline-block relative mx-1">
        {Array.from({ length: restantes }).map((_, i) => (
          <span key={i} className="fosforo" />
        ))}
      </span>
    );
  }

  return (
    <div
      className={clsx(
        "parchment rounded-lg p-3 min-w-[180px]",
        destacado && "ring-2 ring-truco-gold"
      )}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-display text-truco-dark text-sm uppercase tracking-wider">
          {etiqueta}
        </span>
        <span className="font-display text-truco-red text-2xl leading-none">
          {puntos}
          <span className="text-xs text-truco-dark/60">/{objetivo}</span>
        </span>
      </div>
      <div className="mt-2 min-h-[40px] flex items-end flex-wrap">
        {items.length ? items : <span className="text-truco-dark/40 text-xs italic">aún sin puntos</span>}
      </div>
    </div>
  );
}
