// IA del truco — heurística avanzada con personalidad, bluff y memoria.
//
// Niveles de decisión:
// 1. Personalidad estable por jugadorId (hash → agresión, bluff, riesgo, cautela)
// 2. Evaluación de mano (truco) y envido con escala 0..100
// 3. Memoria de cartas vistas (qué quedó en el mazo, posibles del rival)
// 4. Decisiones contextuales: posición (mano/pie), baza, score, bazas ganadas
// 5. Bluff calibrado: tira cantos sin sustento con probabilidad acotada
//
// Todo determinístico salvo donde explícitamente usamos aleatoriedad
// (con probabilidad ponderada por personalidad).

import { jerarquia, calcularEnvido, crearMazo } from "./cartas";
import type { Accion, Carta, EstadoJuego, Jugador } from "./types";
import { accionesLegales } from "./motor";

// ============================================================
// Personalidad
// ============================================================

interface Personalidad {
  /** 0..1 — qué tan seguido sube la apuesta (truco→retruco→vale4). */
  agresion: number;
  /** 0..1 — probabilidad base de mentir / cantar sin tener nada. */
  bluff: number;
  /** 0..1 — tolerancia al riesgo (acepta jugadas ajustadas). */
  riesgo: number;
  /** 0..1 — qué tan tímido/conservador es cuando va perdiendo. */
  cautela: number;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function personalidadDe(jugadorId: string): Personalidad {
  const h = hashStr(jugadorId);
  // 4 valores con piso ~0.45 y techo 1.0 — eliminamos los bots demasiado
  // pasivos. Cada uno sigue teniendo perfil distinto pero todos juegan
  // con un mínimo de carácter.
  const norm = (byte: number) => 0.45 + ((byte & 0xff) / 255) * 0.55;
  return {
    agresion: norm(h >> 0),
    bluff:    norm(h >> 8),
    riesgo:   norm(h >> 16),
    cautela:  norm(h >> 24) * 0.7 // amortiguado: nadie demasiado tímido
  };
}

// ============================================================
// Helpers de cartas / memoria
// ============================================================

interface VistaCartas {
  /** Mis cartas en mano (no jugadas todavía). */
  enMano: Carta[];
  /** Mis 3 cartas originales (incluye las ya tiradas). */
  originales: Carta[];
  /** Cartas que ya se vieron en la mesa (mías y de los rivales). */
  vistas: Carta[];
  /** Cartas posibles que aún no aparecieron (deck - vistas - mías). */
  desconocidas: Carta[];
}

function vistaDeCartas(estado: EstadoJuego, jugadorId: string): VistaCartas {
  const m = estado.manoActual!;
  const enMano = m.cartasPorJugador[jugadorId] || [];
  const tiradasMias: Carta[] = [];
  const todasTiradas: Carta[] = [];
  for (const baza of m.bazas) {
    for (const j of baza.jugadas) {
      todasTiradas.push(j.carta);
      if (j.jugadorId === jugadorId) tiradasMias.push(j.carta);
    }
  }
  const originales = [...enMano, ...tiradasMias];
  const vistas = [...todasTiradas, ...enMano];
  const idsVistos = new Set(vistas.map((c) => c.id));
  const desconocidas = crearMazo().filter((c) => !idsVistos.has(c.id));
  return { enMano, originales, vistas, desconocidas };
}

// ============================================================
// Evaluación de mano
// ============================================================

/** Convierte jerarquía (1..14) a un score 0..100 con peso no lineal:
 *  las cartas top valen mucho más que las medias. */
function valorJerarquia(j: number): number {
  // Curva exponencial suave. 14 → 100, 13 → 88, 12 → 76, ... 1 → 5.
  return Math.min(100, Math.round(5 * Math.pow(1.18, j) + 5));
}

/** Score 0..100 de la mano para truco. Considera la mejor carta y la
 *  capacidad de "back-up" (cartas medias para asegurar bazas). */
function fuerzaTruco(cartas: Carta[]): number {
  if (!cartas.length) return 0;
  const ord = cartas
    .map((c) => valorJerarquia(jerarquia(c)))
    .sort((a, b) => b - a);
  // 60% peso a la mejor, 30% a la segunda, 10% a la tercera.
  const a = ord[0] || 0;
  const b = ord[1] || 0;
  const c = ord[2] || 0;
  return Math.round(a * 0.6 + b * 0.3 + c * 0.1);
}

/** Cantidad esperada de bazas que ganamos con esta mano (0..3). */
function expectativaBazas(cartas: Carta[]): number {
  // Cartas con jerarquía >= 9 (1s, 7s, 3s, 2s) son ganadoras casi siempre.
  // 6-8 son medianas, 1-5 son débiles.
  let exp = 0;
  for (const c of cartas) {
    const j = jerarquia(c);
    if (j >= 12) exp += 0.95; // 1 espada, 1 basto, 7 espada, 7 oro
    else if (j >= 9) exp += 0.8; // 3s, 2s
    else if (j >= 6) exp += 0.45; // figuras
    else exp += 0.15; // 4-7 chicos
  }
  return Math.min(3, exp);
}

// ============================================================
// Decisiones de envido
// ============================================================

interface ContextoCanto {
  estado: EstadoJuego;
  yo: Jugador;
  jugadorId: string;
  legales: Accion["tipo"][];
  vista: VistaCartas;
  personalidad: Personalidad;
}

function decidirEnvido(ctx: ContextoCanto): Accion | null {
  const { estado, jugadorId, legales, vista, personalidad: p } = ctx;
  const mano = estado.manoActual!;

  if (!mano.envidoCantoActivo) return null;

  const miEnvido = calcularEnvido(vista.originales);
  const cadena = mano.envidoCantoActivo.cadena;
  const ultimoCanto = cadena[cadena.length - 1];
  const valorAcumulado = cadena.reduce(
    (acc, c) => acc + (c === "envido" ? 2 : c === "real_envido" ? 3 : 1),
    0
  );

  // Diferencia de score: si voy perdiendo, soy más arriesgado.
  const miEquipo = ctx.yo.equipo;
  const miPunt = estado.puntos[miEquipo];
  const otroPunt = estado.puntos[1 - miEquipo];
  const voyPerdiendo = miPunt < otroPunt;
  const distancia = Math.abs(miPunt - otroPunt);

  // Threshold base para querer: 24 (más agresivo que antes, era 27).
  // El bot acepta envidos con 24+ → 4-5 puntos por debajo del rango fuerte
  // pero suficiente para meter presión.
  let threshold = 24 - p.riesgo * 4 - p.agresion * 3;
  if (voyPerdiendo && distancia > 5) threshold -= 4; // más agresivo si pierdo
  if (distancia > 10 && !voyPerdiendo) threshold += 1; // más cauto si gano cómodo
  if (cadena.length >= 2) threshold += 1; // subida = un poco más exigente
  if (valorAcumulado >= 5) threshold += 2; // mucha plata en juego

  const aceptar = miEnvido >= threshold;

  // ¿Subir? Necesita envido alto + acción legal. Bajamos thresholds.
  const puedeSubirReal =
    legales.includes("cantar_real_envido") && ultimoCanto !== "real_envido";
  const puedeSubirFalta = legales.includes("cantar_falta_envido");

  if (puedeSubirReal && miEnvido >= 28 + (1 - p.agresion) * 2) {
    return { tipo: "cantar_real_envido", jugadorId };
  }
  if (puedeSubirFalta && miEnvido >= 31 + (1 - p.agresion) * 2) {
    return { tipo: "cantar_falta_envido", jugadorId };
  }
  // Falta envido oportunista: si voy perdiendo y tengo mano decente.
  if (puedeSubirFalta && miEnvido >= 28 && voyPerdiendo && distancia > 8) {
    return { tipo: "cantar_falta_envido", jugadorId };
  }

  // Bluff: subir con mano débil para presionar. Más frecuente que antes.
  if (puedeSubirReal && miEnvido < 24) {
    const probBluff = p.bluff * 0.25 - cadena.length * 0.05;
    if (Math.random() < probBluff) {
      return { tipo: "cantar_real_envido", jugadorId };
    }
  }

  return aceptar
    ? { tipo: "responder_quiero", jugadorId }
    : { tipo: "responder_no_quiero", jugadorId };
}

// ============================================================
// Decisiones de truco
// ============================================================

function decidirTruco(ctx: ContextoCanto): Accion | null {
  const { estado, jugadorId, legales, vista, personalidad: p } = ctx;
  const mano = estado.manoActual!;
  if (!mano.trucoCantoActivo) return null;

  const fuerza = fuerzaTruco(vista.enMano);
  const expBazas = expectativaBazas(vista.enMano);
  const nivel = mano.trucoCantoActivo.nivel;

  // Bazas ya ganadas / perdidas — afecta la decisión.
  const bazasGanadas = mano.bazas.filter(
    (b) => b.ganadorEquipo === ctx.yo.equipo
  ).length;
  const bazasPerdidas = mano.bazas.filter(
    (b) => b.ganadorEquipo !== null && b.ganadorEquipo !== ctx.yo.equipo
  ).length;
  const ventajaBazas = bazasGanadas - bazasPerdidas;

  // Score awareness.
  const miEquipo = ctx.yo.equipo;
  const distancia = estado.puntos[miEquipo] - estado.puntos[1 - miEquipo];
  const valorEnJuego =
    nivel === "truco" ? 2 : nivel === "retruco" ? 3 : 4;

  // Threshold para aceptar — bajado: el bot pelea más manos.
  let umbral = 32 - p.riesgo * 8 - ventajaBazas * 10;
  if (distancia < -4) umbral -= 5;       // pierdo, juego
  if (nivel === "vale4") umbral += 6;    // vale 4 = más exigente
  if (valorEnJuego >= 3) umbral += 2;

  const aceptar =
    fuerza >= umbral || (expBazas >= 1.7 && ventajaBazas >= 0);

  // ¿Subir? — bajado a 58 (era 65). El bot resube más seguido.
  const puedeSubir =
    (nivel === "truco" && legales.includes("cantar_retruco")) ||
    (nivel === "retruco" && legales.includes("cantar_vale4"));

  if (puedeSubir && fuerza >= 58 + (1 - p.agresion) * 6 && ventajaBazas >= 0) {
    if (nivel === "truco") return { tipo: "cantar_retruco", jugadorId };
    if (nivel === "retruco") return { tipo: "cantar_vale4", jugadorId };
  }

  // Bluff: resubir con fuerza media pero ventaja en bazas. Más frecuente.
  if (puedeSubir && ventajaBazas >= 1) {
    const probBluff = p.bluff * 0.3;
    if (Math.random() < probBluff) {
      if (nivel === "truco") return { tipo: "cantar_retruco", jugadorId };
      if (nivel === "retruco") return { tipo: "cantar_vale4", jugadorId };
    }
  }

  // Pucherazo: voy perdiendo y la mano no es basura → acepto al voleo.
  if (
    !aceptar &&
    distancia < -6 &&
    fuerza >= 28 &&
    Math.random() < p.riesgo * 0.7
  ) {
    return { tipo: "responder_quiero", jugadorId };
  }

  return aceptar
    ? { tipo: "responder_quiero", jugadorId }
    : { tipo: "responder_no_quiero", jugadorId };
}

// ============================================================
// Cantos espontáneos (no respuesta)
// ============================================================

function intentarCantarEnvido(ctx: ContextoCanto): Accion | null {
  const { estado, jugadorId, legales, vista, personalidad: p, yo } = ctx;
  const mano = estado.manoActual!;

  if (mano.envidoResuelto) return null;
  if (mano.bazas.length > 1) return null;
  if (mano.bazas[0].jugadas.length > 0) return null; // sólo antes de tirar
  if (!legales.includes("cantar_envido")) return null;
  // OJO: antes restringíamos a sólo el mano. Cualquier jugador puede
  // cantar envido en la primera baza si todavía no tiró carta.

  const miEnvido = calcularEnvido(vista.originales);
  const distancia = estado.puntos[yo.equipo] - estado.puntos[1 - yo.equipo];

  // Threshold bajado a 26 (era 28). Bot canta envido más seguido.
  let umbral = 26 - p.riesgo * 5 - p.agresion * 2;
  if (distancia > 8) umbral += 2;
  if (distancia < -5) umbral -= 3;

  // Si tengo flor (3 del mismo palo) → casi siempre canto, es info ganada.
  const palos = new Set(vista.originales.map((c) => c.palo));
  if (palos.size === 1) umbral -= 4;

  if (miEnvido >= umbral) {
    return { tipo: "cantar_envido", jugadorId };
  }

  // Bluff más agresivo: cantar envido con poco para sacar al rival.
  if (Math.random() < p.bluff * 0.18) {
    return { tipo: "cantar_envido", jugadorId };
  }
  return null;
}

function intentarCantarTruco(ctx: ContextoCanto): Accion | null {
  const { jugadorId, legales, vista, personalidad: p, yo, estado } = ctx;
  const mano = estado.manoActual!;
  if (!legales.includes("cantar_truco")) return null;

  const fuerza = fuerzaTruco(vista.enMano);
  const bazasGanadas = mano.bazas.filter(
    (b) => b.ganadorEquipo === yo.equipo
  ).length;
  const bazasPerdidas = mano.bazas.filter(
    (b) => b.ganadorEquipo !== null && b.ganadorEquipo !== yo.equipo
  ).length;
  const distancia = estado.puntos[yo.equipo] - estado.puntos[1 - yo.equipo];

  // Threshold base bajado a 50 (era 60). El bot canta truco más seguido.
  let umbral = 50 - p.agresion * 14 - bazasGanadas * 12;
  if (distancia < -7) umbral -= 8; // vengo perdiendo, juego más fuerte
  if (distancia > 10) umbral += 4; // gano cómodo, ahorro
  if (bazasPerdidas >= 1 && bazasGanadas === 0) umbral += 6; // perdí 1ra, cuidado

  if (fuerza >= umbral) return { tipo: "cantar_truco", jugadorId };

  // Bluff: cantar truco con mano floja para asustar. Más permisivo.
  const puedoBluff =
    bazasGanadas >= 1 || mano.bazas[0].jugadas.length === 0;
  if (puedoBluff && fuerza < 50) {
    if (Math.random() < p.bluff * 0.22) {
      return { tipo: "cantar_truco", jugadorId };
    }
  }
  return null;
}

// ============================================================
// Selección de carta a tirar
// ============================================================

function elegirCarta(ctx: ContextoCanto): Accion {
  const { estado, jugadorId, vista, yo, personalidad: p } = ctx;
  const mano = estado.manoActual!;
  const baza = mano.bazas[mano.bazas.length - 1];
  const numBaza = mano.bazas.length;

  if (vista.enMano.length === 0) {
    // No tengo cartas. Fallback al mazo (no debería pasar acá).
    return { tipo: "ir_al_mazo", jugadorId };
  }

  const ordenadas = vista.enMano
    .slice()
    .sort((a, b) => jerarquia(a) - jerarquia(b));

  // Mejor carta del rival ya tirada en esta baza.
  let mejorRivalEnBaza = -1;
  for (const j of baza.jugadas) {
    const jug = estado.jugadores.find((p) => p.id === j.jugadorId)!;
    if (jug.equipo === yo.equipo) continue;
    const v = jerarquia(j.carta);
    if (v > mejorRivalEnBaza) mejorRivalEnBaza = v;
  }

  const bazasGanadas = mano.bazas
    .slice(0, -1)
    .filter((b) => b.ganadorEquipo === yo.equipo).length;
  const bazasPerdidas = mano.bazas
    .slice(0, -1)
    .filter(
      (b) => b.ganadorEquipo !== null && b.ganadorEquipo !== yo.equipo
    ).length;

  // ESTRATEGIA POR BAZA:

  // Caso 1: hay carta del rival en esta baza → respondemos.
  if (mejorRivalEnBaza >= 0) {
    const ganadora = ordenadas.find((c) => jerarquia(c) > mejorRivalEnBaza);
    if (ganadora) {
      // Si ya gané la primera, puedo regalarla acá (parda ok).
      if (numBaza === 2 && bazasGanadas >= 1) {
        // Tirar la más chica que gane (asegurar 2-0).
        return { tipo: "jugar_carta", jugadorId, cartaId: ganadora.id };
      }
      // Si voy 0-1, NECESITO ganar acá.
      if (numBaza === 2 && bazasPerdidas >= 1) {
        // Asegurar con la mínima ganadora.
        return { tipo: "jugar_carta", jugadorId, cartaId: ganadora.id };
      }
      // Bluff por carta: a veces tiro la más alta cuando podía tirar baja
      // (para que el rival piense que tengo aún más).
      if (p.bluff > 0.6 && Math.random() < p.bluff * 0.12) {
        const top = ordenadas[ordenadas.length - 1];
        return { tipo: "jugar_carta", jugadorId, cartaId: top.id };
      }
      return { tipo: "jugar_carta", jugadorId, cartaId: ganadora.id };
    }
    // No puedo ganar — tiro la más chica (sacrificio).
    return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
  }

  // Caso 2: somos los primeros en esta baza.
  // Estrategia depende de si soy mano y de la baza.
  const esMano = mano.manoJugadorId === jugadorId;

  if (numBaza === 1) {
    // Primera baza: el mano puede liderar fuerte para imponer respeto, o
    // guardar la mejor para una baza decisiva. Personalidad decide.
    if (esMano) {
      if (p.agresion > 0.6) {
        // Bot agresivo lidera con la segunda mejor (guarda la top).
        const idx = Math.min(1, ordenadas.length - 1);
        return {
          tipo: "jugar_carta",
          jugadorId,
          cartaId: ordenadas[ordenadas.length - 1 - idx].id
        };
      }
      // Bot conservador lidera con la del medio.
      const idxMedio = Math.floor(ordenadas.length / 2);
      return {
        tipo: "jugar_carta",
        jugadorId,
        cartaId: ordenadas[idxMedio].id
      };
    }
    // Pie en primera: sigo el ritmo, baja-media.
    return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
  }

  // Segunda o tercera baza, primero en tirar.
  if (numBaza === 2) {
    if (bazasGanadas >= 1) {
      // Gané la 1ra: puedo guardar la mejor para 3ra y tirar media. 2-1 me asegura mano.
      const idxMedio = Math.floor(ordenadas.length / 2);
      return {
        tipo: "jugar_carta",
        jugadorId,
        cartaId: ordenadas[idxMedio].id
      };
    }
    if (bazasPerdidas >= 1) {
      // Perdí la 1ra: necesito ganar acá. Tiro la mejor.
      return {
        tipo: "jugar_carta",
        jugadorId,
        cartaId: ordenadas[ordenadas.length - 1].id
      };
    }
    // Parda en 1ra: tiro la mejor para definir.
    return {
      tipo: "jugar_carta",
      jugadorId,
      cartaId: ordenadas[ordenadas.length - 1].id
    };
  }

  // Tercera baza: tiro la única que me queda (o la mejor restante).
  return {
    tipo: "jugar_carta",
    jugadorId,
    cartaId: ordenadas[ordenadas.length - 1].id
  };
}

// ============================================================
// Decisión maestra
// ============================================================

export function decidirAccionBot(estado: EstadoJuego, jugadorId: string): Accion {
  const yo = estado.jugadores.find((j) => j.id === jugadorId);
  if (!yo) return { tipo: "ir_al_mazo", jugadorId };

  const legales = accionesLegales(estado, jugadorId);
  const vista = vistaDeCartas(estado, jugadorId);
  const personalidad = personalidadDe(jugadorId);
  const ctx: ContextoCanto = { estado, yo, jugadorId, legales, vista, personalidad };

  // Prioridades de respuesta (canto activo del rival):
  const respEnvido = decidirEnvido(ctx);
  if (respEnvido) return respEnvido;
  const respTruco = decidirTruco(ctx);
  if (respTruco) return respTruco;

  // Cantos espontáneos (mi turno, decido si abrir el envido o el truco).
  const cantoEnv = intentarCantarEnvido(ctx);
  if (cantoEnv) return cantoEnv;
  const cantoTruco = intentarCantarTruco(ctx);
  if (cantoTruco) return cantoTruco;

  // Si me toca jugar una carta:
  if (legales.includes("jugar_carta")) {
    return elegirCarta(ctx);
  }

  // Sin opciones — fallback.
  return { tipo: "ir_al_mazo", jugadorId };
}
