"use client";
// Panel que aparece cuando le tocaría jugar al bot compañero. Dos modos:
//
//  - Envido (baza 1, ventana abierta): muestra el envido del bot y deja
//    elegir cantar (Envido / Real / Falta) o no cantar (Jugá / Vení).
//  - Jugar (baza 2 o 3 cuando el bot abre): el bot pide instrucción
//    sobre qué carta tirar — la más alta (Jugá, matar) o la más baja
//    (Vení, ahorrar). No hay opciones de canto acá.
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

  const esEnvido = consulta.tipo === "envido";

  return (
    <div className="absolute inset-0 z-[800] flex items-center justify-center p-3 pointer-events-none">
      <div className="card pointer-events-auto p-3 w-full max-w-md border-2 border-dorado/60 shadow-2xl bg-carbon/95 backdrop-blur-sm">
        <div className="text-center mb-2">
          <div className="label-slim acento-azul">
            {bot.nombre} te pregunta
          </div>
          {esEnvido ? (
            <>
              <div className="font-display text-lg text-crema mt-0.5">
                Tengo{" "}
                <span className="text-dorado">{consulta.envidoBot}</span> de
                envido
              </div>
              <div className="text-text-dim text-[11px] subtitulo-claim">
                ¿Qué hago?
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-lg text-crema mt-0.5">
                Voy a tirar carta
              </div>
              <div className="text-text-dim text-[11px] subtitulo-claim">
                ¿Mato o vengo con poco?
              </div>
            </>
          )}
        </div>

        {/* Cantos sólo en consulta de envido */}
        {esEnvido && (
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
        )}

        {/* Jugá / Vení: tirá la más alta (matar) o la más baja (ahorrar). */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onResolver("juga")}
            className="btn btn-primary text-xs"
            title="Tirá la carta más alta — matar la baza"
          >
            💪 Jugá
          </button>
          <button
            type="button"
            onClick={() => onResolver("veni")}
            className="btn text-xs"
            title="Tirá la carta más baja — venir con poco"
          >
            🤏 Vení
          </button>
        </div>
      </div>
    </div>
  );
}
