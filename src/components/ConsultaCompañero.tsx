"use client";
// Panel que aparece cuando le tocaría jugar al bot compañero pero hay
// envido cantable y el humano todavía no decidió. En vez de tirar carta
// solo, el bot le muestra al humano cuántos puntos tiene y le ofrece
// opciones de canto + dos formas de "no canto":
//   - "Jugá": tirá la carta más alta (matar para asegurar la baza).
//   - "Vení": tirá la carta más baja (venir con poco, ahorrá cartas).
import type { ConsultaCompañero as ConsultaT } from "@/lib/salaLocal";
import type { EstadoJuego } from "@/lib/truco/types";

export function ConsultaCompañero({
  consulta,
  estado,
  onResolver
}: {
  consulta: ConsultaT;
  estado: EstadoJuego;
  onResolver: (
    decision: "envido" | "real_envido" | "falta_envido" | "juga" | "veni"
  ) => void;
}) {
  const bot = estado.jugadores.find((j) => j.id === consulta.botJugadorId);
  if (!bot) return null;
  return (
    <div className="absolute inset-0 z-[800] flex items-center justify-center p-3 pointer-events-none">
      <div className="card pointer-events-auto p-3 w-full max-w-md border-2 border-dorado/60 shadow-2xl bg-carbon/95 backdrop-blur-sm">
        <div className="text-center mb-2">
          <div className="label-slim acento-azul">
            {bot.nombre} te pregunta
          </div>
          <div className="font-display text-lg text-crema mt-0.5">
            Tengo <span className="text-dorado">{consulta.envidoBot}</span> de
            envido
          </div>
          <div className="text-text-dim text-[11px] subtitulo-claim">
            ¿Qué hago?
          </div>
        </div>

        {/* Opciones de canto */}
        <div className="grid grid-cols-3 gap-1.5 mb-1.5">
          <button
            type="button"
            onClick={() => onResolver("envido")}
            className="btn btn-primary text-xs !px-1.5"
          >
            🃏 Envido
          </button>
          <button
            type="button"
            onClick={() => onResolver("real_envido")}
            className="btn text-xs !px-1.5"
          >
            ⭐ Real
          </button>
          <button
            type="button"
            onClick={() => onResolver("falta_envido")}
            className="btn text-xs !px-1.5"
          >
            🔥 Falta
          </button>
        </div>

        {/* Sin canto: dos sabores. "Jugá" tira la más alta para matar,
         *  "Vení" tira la más baja para ahorrar cartas. */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onResolver("juga")}
            className="btn btn-ghost text-xs"
            title="Tirá la carta más alta — matar la baza"
          >
            💪 Jugá
          </button>
          <button
            type="button"
            onClick={() => onResolver("veni")}
            className="btn btn-ghost text-xs"
            title="Tirá la carta más baja — venir con poco"
          >
            🤏 Vení
          </button>
        </div>
      </div>
    </div>
  );
}
