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
 *    baja (vení), o si pasa y deja que el bot decida solo.
 *  - tipo "truco": el bot tiene mano fuerte y quiere cantar truco/
 *    retruco/vale4. Pide permiso al humano. Si rechaza, juega carta. */
export type ConsultaCompañero =
  | { tipo: "envido"; botJugadorId: string; envidoBot: number }
  | { tipo: "jugar"; botJugadorId: string }
  | {
      tipo: "truco";
      botJugadorId: string;
      cantoTipo: "cantar_truco" | "cantar_retruco" | "cantar_vale4";
    };

export type DecisionConsulta =
  | "envido"
  | "real_envido"
  | "falta_envido"
  | "juga"
  | "veni"
  | "pasar"
  | "confirmar_truco"
  | "rechazar_truco";

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

  // Para baza 1: si el envido está cantable, ofrecemos "consulta de
  // envido" (revelamos puntos y dejamos que el humano decida). Esto
  // lo seguimos limitando al pie del equipo — solo el pie sabe si
  // corta o sigue. Sino el bot mano canta envido sin pensar.
  const enBaza1 = mano.bazas.length === 1;
  if (enBaza1) {
    const manoAsiento = estado.jugadores.find(
      (j) => j.id === mano.manoJugadorId
    )?.asiento;
    if (manoAsiento !== undefined) {
      const n = estado.jugadores.length;
      const distanciaDeJuego = (asiento: number) =>
        (asiento - manoAsiento + n) % n;
      const miDist = distanciaDeJuego(bot.asiento);
      const botEsPie = compañeros.every(
        (c) => distanciaDeJuego(c.asiento) < miDist
      );
      if (botEsPie) {
        if (estado.conFlor && mano.florCantores.length > 0) {
          // sin envido por flor — caemos al "consulta de jugar"
        } else {
          const envidoCantable =
            !mano.envidoResuelto &&
            mano.trucoEstado === "ninguno" &&
            mano.bazas[0].jugadas.length < estado.jugadores.length;
          if (envidoCantable) {
            const cartas = mano.cartasPorJugador[bot.id] || [];
            const envidoBot = calcularEnvido(cartas);
            return {
              tipo: "envido",
              botJugadorId: bot.id,
              envidoBot
            };
          }
        }
      }
    }
  }

  // Consulta de "jugar": preguntamos al humano antes de que el bot
  // tire carta. Pero con un filtro: si el rival YA jugó en esta baza
  // y el bot no tiene NI UNA carta que pueda ganar/empatar, la
  // consulta es estéril — la única opción razonable es "vení" (tirar
  // la chica como sacrificio). En ese caso skipeamos la consulta y
  // el bot tira automáticamente la chica.
  const baza = mano.bazas[mano.bazas.length - 1];
  const yaJugoEnBaza = baza.jugadas.some((j) => j.jugadorId === bot.id);
  if (!yaJugoEnBaza) {
    // Si rival ya jugó en esta baza, evaluamos si el bot puede ganar
    // o empatar. Sino no preguntamos.
    let mejorRivalEnBaza = -1;
    for (const j of baza.jugadas) {
      const jug = estado.jugadores.find((p) => p.id === j.jugadorId);
      if (!jug || jug.equipo === bot.equipo) continue;
      const v = jerarquia(j.carta);
      if (v > mejorRivalEnBaza) mejorRivalEnBaza = v;
    }
    if (mejorRivalEnBaza >= 0) {
      const cartas = mano.cartasPorJugador[bot.id] || [];
      const puedoGanarOEmpatar = cartas.some(
        (c) => jerarquia(c) >= mejorRivalEnBaza
      );
      if (!puedoGanarOEmpatar) {
        // Pregunta inútil — el bot va a tirar la chica de todas
        // formas. No molestamos al humano.
        return null;
      }
    }
    return { tipo: "jugar", botJugadorId: bot.id };
  }
  return null;
}

/** Convierte la decisión del humano en una Accion concreta para el bot.
 *  - "envido"/"real_envido"/"falta_envido": cantar esa apuesta.
 *  - "juga": carta más alta del bot.
 *  - "veni": carta más baja.
 *  - "pasar": deja que la IA del bot decida.
 *  - "confirmar_truco" / "rechazar_truco": llegan junto a una consulta de
 *    tipo "truco" — confirmar canta el nivel propuesto, rechazar fuerza
 *    al bot a jugar carta (la más alta — "matar" la baza).
 */
export function accionDesdeConsulta(
  estado: EstadoJuego,
  botId: string,
  decision: DecisionConsulta,
  consulta?: ConsultaCompañero
): Accion {
  if (decision === "pasar") {
    return decidirAccionBot(estado, botId);
  }
  if (decision === "confirmar_truco") {
    const tipo =
      consulta && consulta.tipo === "truco"
        ? consulta.cantoTipo
        : "cantar_truco";
    return { tipo, jugadorId: botId };
  }
  if (decision === "rechazar_truco") {
    // El humano rechaza el canto — el bot juega la carta más alta para
    // intentar ganar la baza igual sin abrir el canto.
    const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
    if (cartas.length === 0) return decidirAccionBot(estado, botId);
    const ordenadas = [...cartas].sort(
      (a, b) => jerarquia(a) - jerarquia(b)
    );
    return {
      tipo: "jugar_carta",
      jugadorId: botId,
      cartaId: ordenadas[ordenadas.length - 1].id
    };
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
