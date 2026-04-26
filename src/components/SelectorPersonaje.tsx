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
        const elegido = seleccionado === p.slug;
        return (
          <button
            key={p.slug}
            type="button"
            disabled={tomado}
            onClick={() => onSeleccionar(p.slug)}
            className={clsx(
              "card p-1 transition relative overflow-hidden",
              elegido
                ? "ring-2 ring-dorado border-dorado shadow-marca scale-[1.02]"
                : "hover:border-azul-criollo/60",
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
            <div
              className={clsx(
                "text-xs font-bold text-center mt-1 truncate",
                elegido ? "text-dorado" : "text-crema"
              )}
            >
              {p.nombre}
            </div>
            {elegido && (
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-dorado text-carbon text-[10px] font-bold flex items-center justify-center shadow-md">
                ✓
              </span>
            )}
            {tomado && (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] uppercase bg-carbon/80 text-text-dim subtitulo-claim">
                ocupado
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
