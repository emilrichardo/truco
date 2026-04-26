// IA básica para jugar Truco. Heurística simple: evalúa fuerza de mano y de envido.
import { jerarquia, calcularEnvido } from "./cartas";
import type { Accion, EstadoJuego } from "./types";
import { accionesLegales } from "./motor";

function cartasDe(estado: EstadoJuego, jugadorId: string) {
  const m = estado.manoActual!;
  const enMano = m.cartasPorJugador[jugadorId] || [];
  const tiradas = m.bazas.flatMap((b) =>
    b.jugadas.filter((j) => j.jugadorId === jugadorId).map((j) => j.carta)
  );
  return { enMano, originales: [...enMano, ...tiradas] };
}

export function decidirAccionBot(estado: EstadoJuego, jugadorId: string): Accion {
  const legales = accionesLegales(estado, jugadorId);
  const mano = estado.manoActual!;
  const { enMano, originales } = cartasDe(estado, jugadorId);

  // Responder envido
  if (mano.envidoCantoActivo) {
    const e = calcularEnvido(originales);
    // Acepta si tiene 27+; sube si tiene 30+.
    if (e >= 31 && legales.includes("cantar_real_envido")) {
      return { tipo: "cantar_real_envido", jugadorId };
    }
    if (e >= 27) return { tipo: "responder_quiero", jugadorId };
    return { tipo: "responder_no_quiero", jugadorId };
  }

  // Responder truco
  if (mano.trucoCantoActivo) {
    const fuerza = fuerzaMano(enMano.map(jerarquia));
    if (fuerza >= 28 && mano.trucoCantoActivo.nivel === "truco") {
      return { tipo: "cantar_retruco", jugadorId };
    }
    if (fuerza >= 18) return { tipo: "responder_quiero", jugadorId };
    return { tipo: "responder_no_quiero", jugadorId };
  }

  // Su turno y nada pendiente → decidir.
  // Tirar carta: la más baja que asegure ganar la baza si puede; si no, la más baja.
  const baza = mano.bazas[mano.bazas.length - 1];
  const mejorRivalEnBaza = (() => {
    let best = -1;
    for (const j of baza.jugadas) {
      const jug = estado.jugadores.find((p) => p.id === j.jugadorId)!;
      const me = estado.jugadores.find((p) => p.id === jugadorId)!;
      if (jug.equipo === me.equipo) continue;
      const v = jerarquia(j.carta);
      if (v > best) best = v;
    }
    return best;
  })();

  // ¿Cantar envido al inicio?
  if (
    !mano.envidoResuelto &&
    mano.bazas.length === 1 &&
    baza.jugadas.length === 0 &&
    mano.manoJugadorId === jugadorId &&
    legales.includes("cantar_envido")
  ) {
    const e = calcularEnvido(originales);
    if (e >= 28) return { tipo: "cantar_envido", jugadorId };
  }

  // ¿Cantar truco si tiene mano fuerte?
  if (legales.includes("cantar_truco")) {
    const f = fuerzaMano(enMano.map(jerarquia));
    if (f >= 26) return { tipo: "cantar_truco", jugadorId };
  }

  // Elegir carta: si puede superar al rival, jugar la más chica que lo logre.
  if (legales.includes("jugar_carta") && enMano.length > 0) {
    const ordenadas = enMano.slice().sort((a, b) => jerarquia(a) - jerarquia(b));
    if (mejorRivalEnBaza >= 0) {
      const ganadora = ordenadas.find((c) => jerarquia(c) > mejorRivalEnBaza);
      if (ganadora) return { tipo: "jugar_carta", jugadorId, cartaId: ganadora.id };
      // No puede ganar → tirar la más baja.
      return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
    }
    // Es el primero en la baza → tirar carta media.
    const idx = Math.min(1, ordenadas.length - 1);
    return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[idx].id };
  }

  // Fallback: ir al mazo si no hay nada mejor.
  if (legales.includes("ir_al_mazo")) return { tipo: "ir_al_mazo", jugadorId };
  return { tipo: "ir_al_mazo", jugadorId };
}

function fuerzaMano(jerarquias: number[]): number {
  // Suma con peso a la mejor carta. Heurística: max + 0.5 * (suma del resto).
  if (!jerarquias.length) return 0;
  const orden = jerarquias.slice().sort((a, b) => b - a);
  return orden[0] + (orden[1] || 0) * 0.5 + (orden[2] || 0) * 0.25;
}
