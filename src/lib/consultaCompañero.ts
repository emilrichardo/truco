"use client";
// Lógica compartida para la consulta del bot compañero al humano.
// Se usa en modo Solo (salaLocal) y en sala online (sala/[id]/page).
import { decidirAccionBot } from "@/lib/truco/ia";
import { calcularEnvido, jerarquia } from "@/lib/truco/cartas";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";

/** Consulta del bot compañero al humano antes de tirar carta.
 *  - tipo "envido": baza 1 con envido cantable. El bot revela su envido
 *    y deja que el humano decida si cantar o no.
 *  - tipo "jugar": baza 2 o 3 cuando el bot abre la baza. No se canta
 *    nada — el humano elige si tira la carta más alta (jugá) o la más
 *    baja (vení), o si pasa y deja que el bot decida solo. */
export type ConsultaCompañero =
  | { tipo: "envido"; botJugadorId: string; envidoBot: number }
  | { tipo: "jugar"; botJugadorId: string };

export type DecisionConsulta =
  | "envido"
  | "real_envido"
  | "falta_envido"
  | "juga"
  | "veni"
  | "pasar";

/** Decide si el bot que está por actuar debe pedir input al humano antes
 *  de tirar carta. Aplica cuando el bot es PIE de su equipo y el
 *  compañero es humano. Para "jugar" sólo cuando el bot abre la baza. */
export function deberiaConsultar(
  estado: EstadoJuego,
  bot: Jugador
): ConsultaCompañero | null {
  if (!bot.esBot) return null;
  const compañeros = estado.jugadores.filter(
    (j) => j.equipo === bot.equipo && j.id !== bot.id
  );
  const compañeroHumano = compañeros.some((j) => !j.esBot);
  if (!compañeroHumano) return null;
  const mano = estado.manoActual;
  if (!mano) return null;
  if (mano.turnoJugadorId !== bot.id) return null;
  if (mano.envidoCantoActivo || mano.trucoCantoActivo) return null;

  // Bot debe ser PIE del equipo (último en jugar en orden anti-horario
  // desde el mano de la mano). Si el humano es pie no hace falta
  // consultar — ya tiene el control en su propio panel.
  const manoAsiento = estado.jugadores.find(
    (j) => j.id === mano.manoJugadorId
  )?.asiento;
  if (manoAsiento === undefined) return null;
  const n = estado.jugadores.length;
  const distanciaDeJuego = (asiento: number) =>
    (asiento - manoAsiento + n) % n;
  const miDist = distanciaDeJuego(bot.asiento);
  const botEsPie = compañeros.every(
    (c) => distanciaDeJuego(c.asiento) < miDist
  );
  if (!botEsPie) return null;

  const enBaza1 = mano.bazas.length === 1;
  if (enBaza1) {
    if (estado.conFlor && mano.florCantores.length > 0) return null;
    const envidoCantable =
      !mano.envidoResuelto &&
      mano.trucoEstado === "ninguno" &&
      mano.bazas[0].jugadas.length < estado.jugadores.length;
    if (envidoCantable) {
      const cartas = mano.cartasPorJugador[bot.id] || [];
      const envidoBot = calcularEnvido(cartas);
      return { tipo: "envido", botJugadorId: bot.id, envidoBot };
    }
  }

  const baza = mano.bazas[mano.bazas.length - 1];
  if (baza.jugadas.length === 0) {
    return { tipo: "jugar", botJugadorId: bot.id };
  }
  return null;
}

/** Convierte la decisión del humano en una Accion concreta para el bot.
 *  - "envido"/"real_envido"/"falta_envido": cantar esa apuesta.
 *  - "juga": carta más alta del bot.
 *  - "veni": carta más baja.
 *  - "pasar": deja que la IA del bot decida (puede cantar truco o jugar
 *    cualquier carta según lo que considere mejor). */
export function accionDesdeConsulta(
  estado: EstadoJuego,
  botId: string,
  decision: DecisionConsulta
): Accion {
  if (decision === "pasar") {
    return decidirAccionBot(estado, botId);
  }
  if (decision === "juga" || decision === "veni") {
    const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
    if (cartas.length === 0) return decidirAccionBot(estado, botId);
    const ordenadas = [...cartas].sort(
      (a, b) => jerarquia(a) - jerarquia(b)
    );
    const elegida =
      decision === "juga" ? ordenadas[ordenadas.length - 1] : ordenadas[0];
    return {
      tipo: "jugar_carta",
      jugadorId: botId,
      cartaId: elegida.id
    };
  }
  return {
    tipo: `cantar_${decision}` as Accion["tipo"],
    jugadorId: botId
  };
}
