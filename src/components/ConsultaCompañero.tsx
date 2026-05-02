"use client";
// Panel que aparece cuando le tocaría jugar al bot compañero. Dos modos:
//
//  - Envido (baza 1, ventana abierta): muestra el envido del bot y deja
//    elegir cantar (Envido / Real / Falta) o no cantar (Jugá / Vení).
//  - Jugar (baza 2 o 3 cuando el bot abre): el bot pide instrucción
//    sobre qué carta tirar — la más alta (Jugá, matar) o la más baja
//    (Vení, ahorrar). No hay opciones de canto acá.
//
// El panel arranca abierto. Si el usuario lo cierra (botón ✕), queda
// sólo un icono "?" flotante en la misma posición. Tocar el "?" lo
// vuelve a abrir. Esto evita que el panel ocupe pantalla todo el
// tiempo pero el usuario no pierde acceso a la consulta.
import { useEffect, useState } from "react";
import type { ConsultaCompañero as ConsultaT } from "@/lib/salaLocal";
import type { EstadoJuego } from "@/lib/truco/types";
import { CartaEspanola } from "./CartaEspanola";

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
      | "tapar"
      | "pasar"
      | "decidir_solo"
      | "carta_especifica"
      | "confirmar_truco"
      | "rechazar_truco",
    cartaId?: string
  ) => void;
}) {
  const [abierto, setAbierto] = useState(true);
  // Cada vez que cambia la consulta (nuevo bot/tipo), abrimos por
  // default — sino una consulta nueva podría quedar oculta detrás
  // del estado colapsado de la anterior.
  useEffect(() => {
    setAbierto(true);
  }, [consulta.botJugadorId, consulta.tipo]);

  const bot = estado.jugadores.find((j) => j.id === consulta.botJugadorId);
  if (!bot) return null;

  const esEnvido = consulta.tipo === "envido";
  const esTruco = consulta.tipo === "truco";
  const esTapar = consulta.tipo === "tapar";

  const labelCanto: Record<string, string> = {
    cantar_truco: "truco",
    cantar_retruco: "retruco",
    cantar_vale4: "vale 4"
  };

  // Estado colapsado: sólo un icono "?" para reabrir. Mismo anclaje
  // que el panel para que aparezca en el lugar esperado.
  if (!abierto) {
    return (
      <div className="absolute z-[800] right-2 top-32 sm:top-36 sm:right-6 pointer-events-none">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label={`Ver pregunta de ${bot.nombre}`}
          title={`Ver pregunta de ${bot.nombre}`}
          className="pointer-events-auto w-10 h-10 rounded-full bg-dorado text-carbon text-lg font-bold flex items-center justify-center shadow-2xl border-2 border-carbon hover:scale-110 active:scale-95 transition animate-bounce"
        >
          ?
        </button>
      </div>
    );
  }

  return (
    // Anclado a la esquina superior derecha — donde vive el avatar del
    // compañero en el layout 2v2.
    <div className="absolute z-[800] right-2 top-32 sm:top-36 sm:right-6 max-w-[260px] pointer-events-none">
      <div className="relative card pointer-events-auto p-2 border-2 border-dorado/60 shadow-2xl bg-carbon/95 backdrop-blur-sm">
        {/* Triangulito apuntando hacia arriba al avatar del compañero.
         *  Usa el mismo bg/opacidad que el panel para no notarse el
         *  cambio de tono entre el triángulo y la burbuja. */}
        <div
          aria-hidden
          className="absolute -top-2 right-6 w-3.5 h-3.5 rotate-45 bg-carbon/95 backdrop-blur-sm border-t-2 border-l-2 border-dorado/60"
        />
        {/* Cerrar: colapsa el panel a un icono "?" (NO despacha
         *  decisión — la consulta sigue activa y se puede reabrir). */}
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Minimizar"
          title="Minimizar (la pregunta queda como icono ?)"
          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-carbon border-2 border-dorado/60 text-crema text-xs flex items-center justify-center shadow-md hover:bg-azul-criollo/30 transition"
        >
          ✕
        </button>
        <div className="text-center mb-1.5 pr-3">
          <div className="text-[9px] uppercase tracking-widest text-azul-claro font-bold">
            {bot.nombre}
          </div>
          {esEnvido ? (
            <div className="text-[11px] text-crema leading-tight">
              Tengo <span className="text-dorado font-bold">{consulta.envidoBot}</span>{" "}
              de envido. ¿Qué hago?
            </div>
          ) : esTruco ? (
            <div className="text-[11px] text-crema leading-tight">
              Mano fuerte. ¿Canto{" "}
              <span className="text-dorado font-bold">
                {labelCanto[consulta.cantoTipo] || "truco"}
              </span>
              ?
            </div>
          ) : esTapar ? (
            <div className="text-[11px] text-crema leading-tight">
              Me queda 1 carta y pierdo. ¿La tiro tapada?
            </div>
          ) : (
            <div className="text-[11px] text-crema leading-tight">
              ¿Mato o vengo con poco?
            </div>
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
        ) : esTapar ? (
          /* Tapar: una sola carta y vamos a perder. Tirar tapada (cara
           *  abajo) o tirarla normal igual. */
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => onResolver("tapar")}
              className="btn btn-primary !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Tirá la carta cara abajo — sin revelarla"
            >
              🙈 Tirá tapada
            </button>
            <button
              type="button"
              onClick={() => onResolver("juga")}
              className="btn !text-[10px] !px-1 !py-1.5 !min-h-0"
              title="Tirá la carta normal"
            >
              👁 Mostrala
            </button>
          </div>
        ) : (
          /* Jugá / Vení / Pasar: tirá la más alta, la más baja, o dejá que
           *  el bot decida. Abajo también las cartas del bot — el humano
           *  puede tocar una específica para que el bot tire esa. */
          <>
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
                title="Tira todas sus cartas tapadas y queda fuera de esta mano (vos seguís solo)"
              >
                🙈 Pasar
              </button>
            </div>
            <CartasDelBot
              estado={estado}
              botId={consulta.botJugadorId}
              onElegir={(cartaId) =>
                onResolver("carta_especifica", cartaId)
              }
            />
          </>
        )}
      </div>
    </div>
  );
}

function CartasDelBot({
  estado,
  botId,
  onElegir
}: {
  estado: EstadoJuego;
  botId: string;
  onElegir: (cartaId: string) => void;
}) {
  const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
  if (cartas.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <div className="text-[9px] uppercase tracking-widest text-text-dim/70 text-center mb-1">
        O elegí su carta
      </div>
      <div className="flex justify-center gap-1.5">
        {cartas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onElegir(c.id)}
            className="active:scale-95 hover:-translate-y-1 transition"
            title={`Tirar esta carta`}
          >
            <CartaEspanola carta={c} tamanio="xs" />
          </button>
        ))}
      </div>
    </div>
  );
}
