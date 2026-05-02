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
 *  - tipo "tapar": baza 3, al bot le queda una sola carta y va a perder
 *    contra el rival que ya jugó. Le pregunta al humano si tira la
 *    carta normal o "tapada" (cara abajo, sin revelar) para ocultar
 *    información de cara a la mano siguiente.
 *  - tipo "truco": el bot tiene mano fuerte y quiere cantar truco/
 *    retruco/vale4. Pide permiso al humano. Si rechaza, juega carta. */
export type ConsultaCompañero =
  | { tipo: "envido"; botJugadorId: string; envidoBot: number }
  | { tipo: "jugar"; botJugadorId: string }
  | { tipo: "tapar"; botJugadorId: string }
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
  | "tapar"
  | "pasar"
  /** El humano eligió una carta específica de la mano del bot. El
   *  cartaId viaja como segundo argumento en accionDesdeConsulta /
   *  onResolver. */
  | "carta_especifica"
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

  // Consulta de "jugar" / "tapar": preguntamos al humano antes de que
  // el bot tire carta.
  //  - Si al bot le queda una sola carta (baza 3): no tiene sentido
  //    preguntar "vení o jugá" — sólo hay una opción. Pero si el bot
  //    va a perder contra el rival que ya jugó, ofrecemos "tapar" para
  //    no revelar la carta de cara a la mano siguiente.
  //  - Si tiene varias cartas: preguntamos "vení o jugá" salvo que el
  //    rival ya haya jugado y el bot no pueda ganar/empatar — ahí
  //    skipeamos la consulta (única opción es tirar la chica).
  const baza = mano.bazas[mano.bazas.length - 1];
  const yaJugoEnBaza = baza.jugadas.some((j) => j.jugadorId === bot.id);
  if (!yaJugoEnBaza) {
    let mejorRivalEnBaza = -1;
    let mejorCompañeroEnBaza = -1;
    for (const j of baza.jugadas) {
      const jug = estado.jugadores.find((p) => p.id === j.jugadorId);
      if (!jug) continue;
      const v = jerarquia(j.carta);
      if (jug.equipo === bot.equipo) {
        if (v > mejorCompañeroEnBaza) mejorCompañeroEnBaza = v;
      } else {
        if (v > mejorRivalEnBaza) mejorRivalEnBaza = v;
      }
    }
    const cartas = mano.cartasPorJugador[bot.id] || [];
    const puedoGanarOEmpatar =
      mejorRivalEnBaza < 0 ||
      cartas.some((c) => jerarquia(c) >= mejorRivalEnBaza);
    // Si mi compañero (humano) ya jugó y está ganando esta baza, no
    // tiene sentido preguntar: lo lógico es que el bot tire chica para
    // no desperdiciar carta. Sólo preguntamos cuando hay que pelear
    // por la baza.
    const equipoYaGana =
      mejorCompañeroEnBaza >= 0 && mejorCompañeroEnBaza > mejorRivalEnBaza;

    if (cartas.length <= 1) {
      // Una sola carta. Sólo molestamos al humano si tiene sentido
      // ofrecer la tapada (rival ya jugó y vamos a perder).
      if (!puedoGanarOEmpatar && mejorRivalEnBaza >= 0 && !equipoYaGana) {
        return { tipo: "tapar", botJugadorId: bot.id };
      }
      return null;
    }
    if (equipoYaGana) {
      // Compañero ya tiene la baza — bot tira la chica solo, sin
      // consulta.
      return null;
    }
    if (!puedoGanarOEmpatar) {
      // Pregunta inútil — el bot va a tirar la chica de todas formas.
      return null;
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
  consulta?: ConsultaCompañero,
  cartaId?: string
): Accion {
  if (decision === "carta_especifica") {
    const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
    const elegida = cartaId ? cartas.find((c) => c.id === cartaId) : undefined;
    if (!elegida) return decidirAccionBot(estado, botId);
    return {
      tipo: "jugar_carta",
      jugadorId: botId,
      cartaId: elegida.id
    };
  }
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
  if (decision === "tapar") {
    // Tapar: el bot tira su única carta restante cara abajo.
    const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
    if (cartas.length === 0) return decidirAccionBot(estado, botId);
    return {
      tipo: "jugar_carta",
      jugadorId: botId,
      cartaId: cartas[0].id,
      cartaTapada: true
    };
  }
  return {
    tipo: `cantar_${decision}` as Accion["tipo"],
    jugadorId: botId
  };
}
