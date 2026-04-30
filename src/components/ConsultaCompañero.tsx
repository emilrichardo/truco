"use client";
// Panel que aparece cuando le tocaría jugar al bot compañero. Dos modos:
//
//  - Envido (baza 1, ventana abierta): muestra el envido del bot y deja
//    elegir cantar (Envido / Real / Falta) o no cantar (Jugá / Vení).
//  - Jugar (baza 2 o 3 cuando el bot abre): el bot pide instrucción
//    sobre qué carta tirar — la más alta (Jugá, matar) o la más baja
//    (Vení, ahorrar). No hay opciones de canto acá.
//
// Posición: como burbuja de habla saliendo del avatar del compañero
// (esquina superior derecha en 2v2). Triangulito apuntando hacia él
// arriba. Así no tapa las cartas del usuario abajo ni las del compañero
// (que viven debajo de su avatar) y queda claro quién está hablando.
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
    decision:
      | "envido"
      | "real_envido"
      | "falta_envido"
      | "juga"
      | "veni"
      | "pasar"
      | "confirmar_truco"
      | "rechazar_truco"
  ) => void;
}) {
  const bot = estado.jugadores.find((j) => j.id === consulta.botJugadorId);
  if (!bot) return null;

  const esEnvido = consulta.tipo === "envido";
  const esTruco = consulta.tipo === "truco";

  const labelCanto: Record<string, string> = {
    cantar_truco: "truco",
    cantar_retruco: "retruco",
    cantar_vale4: "vale 4"
  };

  return (
    // Anclado a la esquina superior derecha — donde vive el avatar del
    // compañero en el layout 2v2. Mobile: top-32 deja respirar el avatar
    // y la mini-mano. Desktop empuja un poco más abajo.
    <div className="absolute z-[800] right-2 top-32 sm:top-36 sm:right-6 max-w-[280px] pointer-events-none">
      <div className="relative card pointer-events-auto p-3 border-2 border-dorado/60 shadow-2xl bg-carbon/95 backdrop-blur-sm">
        {/* Triangulito apuntando hacia arriba al avatar del compañero. */}
        <div
          aria-hidden
          className="absolute -top-2 right-6 w-3.5 h-3.5 rotate-45 bg-carbon border-t-2 border-l-2 border-dorado/60"
        />
        <div className="text-center mb-2">
          <div className="label-slim acento-azul">
            {bot.nombre} te pregunta
          </div>
          {esEnvido ? (
            <>
              <div className="font-display text-base text-crema mt-0.5">
                Tengo{" "}
                <span className="text-dorado">{consulta.envidoBot}</span> de
                envido
              </div>
              <div className="text-text-dim text-[11px] subtitulo-claim">
                ¿Qué hago?
              </div>
            </>
          ) : esTruco ? (
            <>
              <div className="font-display text-base text-crema mt-0.5">
                Tengo mano fuerte
              </div>
              <div className="text-text-dim text-[11px] subtitulo-claim">
                ¿Canto{" "}
                <span className="text-dorado">
                  {labelCanto[consulta.cantoTipo] || "truco"}
                </span>
                ?
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-base text-crema mt-0.5">
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
          <div className="grid grid-cols-3 gap-1 mb-1.5">
            <button
              type="button"
              onClick={() => onResolver("envido")}
              className="btn btn-primary !text-[10px] !px-1 !py-1.5 !min-h-0"
            >
              🃏 Envido
            </button>
            <button
              type="button"
              onClick={() => onResolver("real_envido")}
              className="btn !text-[10px] !px-1 !py-1.5 !min-h-0"
            >
              ⭐ Real
            </button>
            <button
              type="button"
              onClick={() => onResolver("falta_envido")}
              className="btn !text-[10px] !px-1 !py-1.5 !min-h-0"
            >
              🔥 Falta
            </button>
          </div>
        )}

        {esTruco ? (
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => onResolver("confirmar_truco")}
              className="btn btn-primary !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Cantar el truco propuesto"
            >
              🔥 Sí, cantá
            </button>
            <button
              type="button"
              onClick={() => onResolver("rechazar_truco")}
              className="btn !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Mejor no — tirá la carta más alta"
            >
              🤐 No, jugá
            </button>
          </div>
        ) : (
          /* Jugá / Vení / Pasar: tirá la más alta, la más baja, o dejá que
           *  el bot decida. */
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => onResolver("juga")}
              className="btn btn-primary !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Tirá la carta más alta — matar la baza"
            >
              💪 Jugá
            </button>
            <button
              type="button"
              onClick={() => onResolver("veni")}
              className="btn !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Tirá la carta más baja — venir con poco"
            >
              🤏 Vení
            </button>
            <button
              type="button"
              onClick={() => onResolver("pasar")}
              className="btn btn-ghost !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Dejá que el bot decida solo"
            >
              ⏭ Pasar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
