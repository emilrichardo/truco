"use client";
import clsx from "clsx";
import { PERSONAJES, urlPersonaje } from "@/data/jugadores";

export function SelectorPersonaje({
  seleccionado,
  ocupados,
  onSeleccionar
}: {
  seleccionado: string;
  ocupados?: string[];
  onSeleccionar: (slug: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {PERSONAJES.map((p) => {
        const tomado = ocupados?.includes(p.slug) && p.slug !== seleccionado;
        return (
          <button
            key={p.slug}
            type="button"
            disabled={tomado}
            onClick={() => onSeleccionar(p.slug)}
            className={clsx(
              "card-frame p-1 transition relative",
              seleccionado === p.slug && "ring-4 ring-truco-gold scale-105",
              tomado && "opacity-30 cursor-not-allowed"
            )}
          >
            <div className="aspect-[3/4] overflow-hidden rounded">
              <img
                src={urlPersonaje(p.slug)}
                alt={p.nombre}
                className="w-full h-full object-cover object-top"
              />
            </div>
            <div className="text-[11px] font-display text-truco-dark text-center mt-0.5">
              {p.nombre}
            </div>
            {tomado && (
              <span className="absolute inset-0 flex items-center justify-center font-display text-truco-red bg-cream/60 text-xs uppercase">
                ocupado
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
