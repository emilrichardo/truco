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

import {
  jerarquia,
  calcularEnvido,
  crearMazo,
  esMachoEfectivo
} from "./cartas";
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
  // Piso alto: el bot debe sentirse como alguien que sabe jugar truco,
  // no como un validador de probabilidades. Mantiene personalidad por id
  // pero todos tienen iniciativa, riesgo y algo de mentira.
  const norm = (byte: number, min = 0.58, max = 1) =>
    min + ((byte & 0xff) / 255) * (max - min);
  return {
    agresion: norm(h >> 0, 0.62, 1),
    bluff:    norm(h >> 8, 0.55, 0.98),
    riesgo:   norm(h >> 16, 0.6, 1),
    cautela:  norm(h >> 24, 0.18, 0.45)
  };
}

function firmaCarta(c: Carta): string {
  return `${c.numero}-${c.palo}`;
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
  const firmasVistas = new Set(vistas.map(firmaCarta));
  const desconocidas = crearMazo().filter(
    (c) => !firmasVistas.has(firmaCarta(c))
  );
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

function contarDesconocidasFuertes(vista: VistaCartas, umbral = 10): number {
  return vista.desconocidas.filter((c) => jerarquia(c) >= umbral).length;
}

function maximaDesconocida(vista: VistaCartas): number {
  return vista.desconocidas.reduce((max, c) => Math.max(max, jerarquia(c)), 0);
}

function cartasRestantesRivales(estado: EstadoJuego, yo: Jugador): number {
  const mano = estado.manoActual!;
  return estado.jugadores
    .filter((j) => j.equipo !== yo.equipo)
    .reduce((acc, j) => acc + (mano.cartasPorJugador[j.id]?.length || 0), 0);
}

function ventajaPorCartasVistas(ctx: ContextoCanto): number {
  // Si ya salieron muchas altas, una mano media sube de valor. Si el mazo
  // desconocido todavía está cargado de cartas fuertes, nos ponemos más finos.
  const fuertes = contarDesconocidasFuertes(ctx.vista);
  const max = maximaDesconocida(ctx.vista);
  let ajuste = 0;
  if (fuertes <= 3) ajuste += 5;
  else if (fuertes >= 8) ajuste -= 4;
  if (max <= 10) ajuste += 4;
  return ajuste;
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

function azarContextual(ctx: ContextoCanto, sal: string): number {
  const mano = ctx.estado.manoActual!;
  const baza = mano.bazas[mano.bazas.length - 1];
  const cartas = ctx.vista.enMano.map(firmaCarta).sort().join(",");
  const mesa = baza.jugadas
    .map((j) => `${j.jugadorId}:${firmaCarta(j.carta)}`)
    .join("|");
  const seed = [
    sal,
    ctx.jugadorId,
    mano.numero,
    ctx.estado.version,
    mano.bazas.length,
    cartas,
    mesa
  ].join(":");
  return (hashStr(seed) % 10000) / 10000;
}

function compañerosDe(estado: EstadoJuego, yo: Jugador): Jugador[] {
  return estado.jugadores.filter(
    (j) => j.equipo === yo.equipo && j.id !== yo.id
  );
}

function cartasAliadasEnMano(ctx: ContextoCanto): Carta[] {
  const mano = ctx.estado.manoActual!;
  return compañerosDe(ctx.estado, ctx.yo).flatMap(
    (j) => mano.cartasPorJugador[j.id] || []
  );
}

function maxJerarquia(cartas: Carta[]): number {
  return cartas.reduce((max, c) => Math.max(max, jerarquia(c)), 0);
}

function fuerzaEquipo(ctx: ContextoCanto): number {
  const propias = fuerzaTruco(ctx.vista.enMano);
  const aliadas = cartasAliadasEnMano(ctx);
  if (!aliadas.length) return propias;

  const mejorAliada = maxJerarquia(aliadas);
  const topPropia = maxJerarquia(ctx.vista.enMano);
  const parejaFuerte =
    topPropia >= 11 && mejorAliada >= 10
      ? 12
      : topPropia >= 9 && mejorAliada >= 12
          ? 8
          : 0;
  return Math.min(
    100,
    Math.round(propias + fuerzaTruco(aliadas) * 0.35 + parejaFuerte)
  );
}

function cartasVistasPorEquipo(ctx: ContextoCanto, equipo: 0 | 1): Carta[] {
  const mano = ctx.estado.manoActual!;
  const out: Carta[] = [];
  for (const baza of mano.bazas) {
    for (const jugada of baza.jugadas) {
      const jugador = ctx.estado.jugadores.find(
        (j) => j.id === jugada.jugadorId
      );
      if (jugador?.equipo === equipo) out.push(jugada.carta);
    }
  }
  return out;
}

function lecturaRival(ctx: ContextoCanto): {
  maxVisto: number;
  fuertesVistas: number;
  fuertesOcultas: number;
  maxOculta: number;
} {
  const vistasRival = cartasVistasPorEquipo(ctx, (1 - ctx.yo.equipo) as 0 | 1);
  return {
    maxVisto: maxJerarquia(vistasRival),
    fuertesVistas: vistasRival.filter((c) => jerarquia(c) >= 10).length,
    fuertesOcultas: contarDesconocidasFuertes(ctx.vista, 10),
    maxOculta: maximaDesconocida(ctx.vista)
  };
}

function presionDeMarcador(ctx: ContextoCanto): number {
  const mis = ctx.estado.puntos[ctx.yo.equipo];
  const rivales = ctx.estado.puntos[1 - ctx.yo.equipo];
  const faltanMios = ctx.estado.puntosObjetivo - mis;
  const faltanRivales = ctx.estado.puntosObjetivo - rivales;
  let presion = 0;
  if (mis < rivales) presion += Math.min(10, (rivales - mis) * 0.7);
  if (faltanRivales <= 3) presion += 6;
  if (faltanMios <= 4) presion += 3;
  if (mis > rivales + 8) presion -= 3;
  return presion;
}

function puntosParaGanar(estado: EstadoJuego, equipo: 0 | 1): number {
  return estado.puntosObjetivo - estado.puntos[equipo];
}

function estaCercaDeCierre(estado: EstadoJuego, equipo: 0 | 1): boolean {
  return puntosParaGanar(estado, equipo) <= 4 ||
    puntosParaGanar(estado, (1 - equipo) as 0 | 1) <= 4;
}

function mejorEnvidoEquipo(ctx: ContextoCanto): number {
  const mano = ctx.estado.manoActual!;
  const mios = calcularEnvido(ctx.vista.originales);
  const aliados = compañerosDe(ctx.estado, ctx.yo).map((j) =>
    calcularEnvido(mano.cartasPorJugador[j.id] || [])
  );
  return Math.max(mios, ...aliados);
}

function decidirEnvido(ctx: ContextoCanto): Accion | null {
  const { estado, jugadorId, legales, vista, personalidad: p } = ctx;
  const mano = estado.manoActual!;

  if (!mano.envidoCantoActivo) return null;

  const miEnvido = calcularEnvido(vista.originales);
  const envidoEquipo = mejorEnvidoEquipo(ctx);
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

  const aceptarBase = envidoEquipo >= threshold;
  const aceptarDeAtras =
    voyPerdiendo &&
    envidoEquipo >= threshold - 6 &&
    azarContextual(ctx, "quiero-envido-de-atras") <
      p.riesgo * 0.48 + p.bluff * 0.18;
  const aceptarPicante =
    !aceptarBase &&
    envidoEquipo >= threshold - 4 &&
    azarContextual(ctx, "quiero-envido-picante") <
      p.riesgo * 0.38 + p.agresion * 0.16;
  const aceptarDeOficio =
    !aceptarBase &&
    envidoEquipo >= 22 &&
    valorAcumulado <= 3 &&
    azarContextual(ctx, "quiero-envido-oficio") <
      p.riesgo * 0.24 + p.bluff * 0.18;
  const aceptar = aceptarBase || aceptarDeAtras || aceptarPicante;

  // ¿Subir? Necesita envido alto + acción legal. Bajamos thresholds.
  const puedeSubirReal =
    legales.includes("cantar_real_envido") && ultimoCanto !== "real_envido";
  const puedeSubirFalta = legales.includes("cantar_falta_envido");

  if (puedeSubirReal && envidoEquipo >= 26 + (1 - p.agresion) * 2) {
    return { tipo: "cantar_real_envido", jugadorId };
  }
  if (puedeSubirFalta && envidoEquipo >= 29 + (1 - p.agresion) * 2) {
    return { tipo: "cantar_falta_envido", jugadorId };
  }
  // Falta envido oportunista: si voy perdiendo y tengo mano decente.
  if (puedeSubirFalta && envidoEquipo >= 28 && voyPerdiendo && distancia > 8) {
    return { tipo: "cantar_falta_envido", jugadorId };
  }

  // Bluff: subir con mano débil para presionar. Más frecuente que antes.
  if (puedeSubirReal && envidoEquipo < 24) {
    const probBluff =
      p.bluff * 0.48 +
      (voyPerdiendo ? 0.12 : 0) -
      cadena.length * 0.05;
    if (azarContextual(ctx, "bluff-real-envido") < probBluff) {
      return { tipo: "cantar_real_envido", jugadorId };
    }
  }
  if (
    puedeSubirFalta &&
    envidoEquipo >= 22 &&
    envidoEquipo < 29 &&
    (voyPerdiendo || distancia > 6)
  ) {
    const probBluff =
      p.bluff * 0.28 +
      p.riesgo * 0.08 +
      (voyPerdiendo ? 0.12 : 0);
    if (azarContextual(ctx, "bluff-falta-envido") < probBluff) {
      return { tipo: "cantar_falta_envido", jugadorId };
    }
  }

  return (aceptar || aceptarDeOficio)
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
  const fuerzaConEquipo = fuerzaEquipo(ctx);
  const expBazas = expectativaBazas(vista.enMano);
  const respaldoAliado = maxJerarquia(cartasAliadasEnMano(ctx));
  const rival = lecturaRival(ctx);
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
  let umbral = 21 - p.riesgo * 11 - ventajaBazas * 10;
  umbral -= ventajaPorCartasVistas(ctx);
  umbral -= respaldoAliado >= 12 ? 8 : respaldoAliado >= 10 ? 4 : 0;
  umbral -= presionDeMarcador(ctx) * 0.45;
  if (rival.fuertesVistas >= 2) umbral -= 3;
  if (rival.maxOculta >= 13 && fuerza < 45 && respaldoAliado < 10) umbral += 5;
  if (distancia < -4) umbral -= 5;       // pierdo, juego
  if (nivel === "vale4") umbral += 6;    // vale 4 = más exigente
  if (valorEnJuego >= 3) umbral += 2;

  const aceptarBase =
    fuerzaConEquipo >= umbral || (expBazas >= 1.7 && ventajaBazas >= 0);
  const aceptarDeMentira =
    !aceptarBase &&
    fuerzaConEquipo >= 16 &&
    nivel !== "vale4" &&
    azarContextual(ctx, "quiero-truco-de-mentira") <
      p.bluff * 0.48 +
        p.riesgo * 0.26 +
        Math.max(0, presionDeMarcador(ctx)) * 0.012;
  const aceptarPorMesa =
    !aceptarBase &&
    fuerzaConEquipo >= 22 &&
    (rival.fuertesVistas >= 1 || respaldoAliado >= 9) &&
    azarContextual(ctx, "quiero-truco-lectura-mesa") <
      p.riesgo * 0.45 + p.agresion * 0.18;
  const aceptarDeGuapo =
    !aceptarBase &&
    nivel === "truco" &&
    fuerzaConEquipo >= 18 &&
    distancia <= 0 &&
    azarContextual(ctx, "quiero-truco-guapo") <
      p.riesgo * 0.34 + p.bluff * 0.28;
  const aceptar = aceptarBase || aceptarDeMentira || aceptarPorMesa || aceptarDeGuapo;

  // ¿Subir? — bajado a 58 (era 65). El bot resube más seguido.
  const puedeSubir =
    (nivel === "truco" && legales.includes("cantar_retruco")) ||
    (nivel === "retruco" && legales.includes("cantar_vale4"));

  const umbralSubida =
    46 + (1 - p.agresion) * 6 - (respaldoAliado >= 12 ? 8 : 0);
  if (
    puedeSubir &&
    fuerzaConEquipo >= umbralSubida &&
    ventajaBazas >= -1 &&
    rival.maxVisto < 14
  ) {
    if (nivel === "truco") return { tipo: "cantar_retruco", jugadorId };
    if (nivel === "retruco") return { tipo: "cantar_vale4", jugadorId };
  }

  // Bluff: resubir con fuerza media cuando el rival ya gastó cartas altas,
  // tenemos respaldo del compañero, o el marcador exige mover la mano.
  if (puedeSubir && ventajaBazas >= -1 && fuerzaConEquipo >= 24) {
    const probBluff =
      p.bluff * 0.42 +
      (rival.fuertesVistas >= 1 ? 0.1 : 0) +
      (respaldoAliado >= 10 ? 0.09 : 0) +
      Math.max(0, presionDeMarcador(ctx)) * 0.012;
    if (azarContextual(ctx, "bluff-resubir-truco") < probBluff) {
      if (nivel === "truco") return { tipo: "cantar_retruco", jugadorId };
      if (nivel === "retruco") return { tipo: "cantar_vale4", jugadorId };
    }
  }

  // Pucherazo: voy perdiendo y la mano no es basura → acepto al voleo.
  if (
    !aceptar &&
    distancia < -6 &&
    fuerzaConEquipo >= 28 &&
    azarContextual(ctx, "quiero-de-atras") < p.riesgo * 0.7
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
  const puedeEnvido = legales.includes("cantar_envido");
  const puedeReal = legales.includes("cantar_real_envido");
  const puedeFalta = legales.includes("cantar_falta_envido");
  if (!puedeEnvido && !puedeReal && !puedeFalta) return null;

  // Etiqueta trucera 2v2: si tengo compañero humano, NUNCA canto envido
  // por mi cuenta. La decisión la toma siempre el humano — él sabe sus
  // puntos y elige si canta o no. El bot no le pisa la jugada ni cuando
  // es mano de equipo ni cuando es pie. La canilla del envido es del
  // humano siempre que esté sentado en el equipo.
  const compañeros = estado.jugadores.filter(
    (j) => j.equipo === yo.equipo && j.id !== jugadorId
  );
  const tengoCompañeroHumano = compañeros.some((j) => !j.esBot);
  if (tengoCompañeroHumano) return null;

  // El envido lo canta el PIE del equipo, no el mano. Si soy el primero
  // en jugar de mi equipo (menor distancia desde el mano de la mano),
  // me callo y espero a que decida el pie — él tiene más info y la
  // costumbre dice que es su canto. En 1v1 cada equipo tiene un único
  // jugador → es trivialmente pie y no entra a este return.
  const manoJ = estado.jugadores.find((j) => j.id === mano.manoJugadorId);
  if (manoJ && compañeros.length > 0) {
    const n = estado.jugadores.length;
    const dist = (asiento: number) => (asiento - manoJ.asiento + n) % n;
    const miDist = dist(yo.asiento);
    const algunoMasAtrasEnElEquipo = compañeros.some(
      (c) => dist(c.asiento) > miDist
    );
    if (algunoMasAtrasEnElEquipo) return null;
  }

  const miEnvido = calcularEnvido(vista.originales);
  const distancia = estado.puntos[yo.equipo] - estado.puntos[1 - yo.equipo];
  const voyPerdiendo = distancia < 0;
  const cierreCerca = estaCercaDeCierre(estado, yo.equipo);

  // Threshold bajado a 26 (era 28). Bot canta envido más seguido.
  let umbral = 24 - p.riesgo * 5 - p.agresion * 3;
  if (distancia > 8) umbral += 2;
  if (distancia < -5) umbral -= 3;

  // Tres del mismo palo suele dejar un envido alto; empujamos un poco el canto.
  const palos = new Set(vista.originales.map((c) => c.palo));
  if (palos.size === 1) umbral -= 4;

  if (
    puedeFalta &&
    (miEnvido >= 31 ||
      (miEnvido >= 28 && (voyPerdiendo || cierreCerca)) ||
      (miEnvido >= 25 &&
        voyPerdiendo &&
        azarContextual(ctx, "abrir-falta-de-atras") <
          p.riesgo * 0.34 + p.bluff * 0.22))
  ) {
    return { tipo: "cantar_falta_envido", jugadorId };
  }

  if (
    puedeReal &&
    (miEnvido >= 28 ||
      (miEnvido >= 25 &&
        azarContextual(ctx, "abrir-real-presion") <
          p.agresion * 0.28 + p.riesgo * 0.16))
  ) {
    return { tipo: "cantar_real_envido", jugadorId };
  }

  if (miEnvido >= umbral) {
    return { tipo: "cantar_envido", jugadorId };
  }

  // Bluff más agresivo: cantar con poco para sacar al rival o comprar
  // información. Los mejores no mienten siempre; mienten cuando el
  // contexto hace creíble la presión.
  const bluffCreible = miEnvido >= 18 || distancia < -6 || cierreCerca;
  if (bluffCreible) {
    const bluff = azarContextual(ctx, "bluff-envido");
    if (
      puedeReal &&
      miEnvido >= 20 &&
      bluff < p.bluff * 0.18 + (voyPerdiendo ? 0.08 : 0)
    ) {
      return { tipo: "cantar_real_envido", jugadorId };
    }
    if (puedeFalta && cierreCerca && bluff < p.bluff * 0.1) {
      return { tipo: "cantar_falta_envido", jugadorId };
    }
    if (puedeEnvido && bluff < p.bluff * 0.34 + p.riesgo * 0.08) {
      return { tipo: "cantar_envido", jugadorId };
    }
  }
  return null;
}

function intentarCantarTruco(ctx: ContextoCanto): Accion | null {
  const { jugadorId, legales, vista, personalidad: p, yo, estado } = ctx;
  const mano = estado.manoActual!;
  // Detectamos cuál de los 3 niveles está disponible. Antes sólo
  // chequeábamos cantar_truco — y entonces si el rival ya había cantado
  // truco y vos como equipo aceptaste, la IA nunca subía a retruco
  // aunque tuviera el 1 de basto en mano. Ahora cubrimos los 3 niveles.
  const cantoLegal: Accion["tipo"] | null = legales.includes("cantar_truco")
    ? "cantar_truco"
    : legales.includes("cantar_retruco")
      ? "cantar_retruco"
      : legales.includes("cantar_vale4")
        ? "cantar_vale4"
        : null;
  if (!cantoLegal) return null;

  // Con compañero humano: la IA puede DECIDIR cantar truco (devuelve la
  // acción), pero el dispatcher de bots NO la despacha directo — la
  // muestra como una consulta al humano ("tengo mano fuerte, ¿canto?").
  // Filtramos acá los casos donde no tiene fuerza suficiente para no
  // molestar al humano con una consulta innecesaria. Antes había una
  // excepción "manoExcepcional" que dejaba al bot cantar solo: la
  // sacamos — siempre se le pregunta al humano cuando es compañero.
  const tengoCompañeroHumano = estado.jugadores.some(
    (j) => j.equipo === yo.equipo && j.id !== jugadorId && !j.esBot
  );
  if (tengoCompañeroHumano) {
    const baza = mano.bazas[mano.bazas.length - 1];
    const idsQueJugaron = new Set(baza.jugadas.map((j) => j.jugadorId));
    const mejorRival = baza.jugadas.reduce((max, jugada) => {
      const jug = estado.jugadores.find((j) => j.id === jugada.jugadorId);
      if (!jug || jug.equipo === yo.equipo) return max;
      return Math.max(max, jerarquia(jugada.carta));
    }, -1);
    const humanoPendientePuedeMatar =
      mejorRival >= 0 &&
      estado.jugadores.some((j) => {
        if (j.esBot || j.equipo !== yo.equipo || idsQueJugaron.has(j.id)) {
          return false;
        }
        return (mano.cartasPorJugador[j.id] || []).some(
          (c) => jerarquia(c) > mejorRival
        );
      });
    if (humanoPendientePuedeMatar) return null;

    const fuerzaActual = fuerzaEquipo(ctx);
    const cartasYaJugadas = mano.bazas.flatMap((b) =>
      b.jugadas.map((j) => j.carta)
    );
    const tieneMacho = vista.enMano.some((c) =>
      esMachoEfectivo(c, cartasYaJugadas)
    );
    // Sólo proponemos canto si la mano lo amerita — el humano siempre
    // puede rechazar pero no queremos popups vacíos.
    const bluffConsultable =
      fuerzaActual >= 34 &&
      azarContextual(ctx, "consultar-bluff-truco") <
        p.bluff * 0.3 + p.agresion * 0.08;
    if (fuerzaActual < 50 && !tieneMacho && !bluffConsultable) return null;
  }

  // Etiqueta trucera: en la primera baza el bot no abre truco como reflejo.
  // Esa ventana suele ser de envido; el truco se vuelve más natural después
  // de ver la primera carta/baza. Sólo rompemos la etiqueta con mano
  // verdaderamente monstruosa o marcador muy urgente.
  const fuerza = fuerzaTruco(vista.enMano);
  const fuerzaConEquipo = fuerzaEquipo(ctx);
  const respaldoAliado = maxJerarquia(cartasAliadasEnMano(ctx));
  const rival = lecturaRival(ctx);
  const cartasYaJugadas = mano.bazas.flatMap((b) =>
    b.jugadas.map((j) => j.carta)
  );
  const tieneMachoActual = vista.enMano.some((c) =>
    esMachoEfectivo(c, cartasYaJugadas)
  );
  const top = maxJerarquia(vista.enMano);
  const segunda = vista.enMano
    .map((c) => jerarquia(c))
    .sort((a, b) => b - a)[1] ?? 0;
  const bazasGanadas = mano.bazas.filter(
    (b) => b.ganadorEquipo === yo.equipo
  ).length;
  const bazasPerdidas = mano.bazas.filter(
    (b) => b.ganadorEquipo !== null && b.ganadorEquipo !== yo.equipo
  ).length;
  const distancia = estado.puntos[yo.equipo] - estado.puntos[1 - yo.equipo];

  const primeraBazaAbierta =
    mano.bazas.length === 1 &&
    mano.bazas[0].jugadas.length < estado.jugadores.length;
  if (primeraBazaAbierta && cantoLegal === "cantar_truco") {
    const miEnvido = calcularEnvido(vista.originales);
    const manoMonstruosa =
      fuerzaConEquipo >= 78 &&
      (tieneMachoActual || top >= 13) &&
      segunda >= 9;
    const marcadorPideGritar =
      distancia < -10 &&
      fuerzaConEquipo >= 62 &&
      miEnvido < 24 &&
      azarContextual(ctx, "truco-primera-urgente") < p.riesgo * 0.22;
    if (!manoMonstruosa && !marcadorPideGritar) return null;
  }

  // Threshold base. Al subir a retruco / vale 4 estamos arriesgando más
  // puntos así que somos más exigentes con la fuerza requerida.
  let umbral = 39 - p.agresion * 17 - bazasGanadas * 12;
  umbral -= ventajaPorCartasVistas(ctx);
  umbral -= respaldoAliado >= 12 ? 8 : respaldoAliado >= 10 ? 4 : 0;
  umbral -= presionDeMarcador(ctx) * 0.5;
  if (rival.fuertesVistas >= 2) umbral -= 4;
  if (rival.maxOculta >= 13 && respaldoAliado < 10 && fuerza < 45) umbral += 4;
  if (cantoLegal === "cantar_retruco") umbral += 8;
  if (cantoLegal === "cantar_vale4") umbral += 14;
  if (distancia < -7) umbral -= 8; // vengo perdiendo, juego más fuerte
  if (distancia > 10) umbral += 4; // gano cómodo, ahorro
  if (bazasPerdidas >= 1 && bazasGanadas === 0) umbral += 6; // perdí 1ra, cuidado

  // Si tengo macho efectivo en mano, bajamos mucho el umbral — la baza
  // está prácticamente asegurada y subir es lo correcto. Esto cubre el
  // caso del 1 de basto cuando ya cayó el 1 de espada (y similares).
  if (tieneMachoActual) umbral -= 20;

  if (fuerzaConEquipo >= umbral) return { tipo: cantoLegal, jugadorId };

  // Bluff: cantar para asustar. Es más creíble si ya ganamos una baza,
  // si quedan pocas altas ocultas, o si venimos abajo y necesitamos
  // mover el avispero.
  const puedoBluff =
    cantoLegal === "cantar_truco" &&
    !primeraBazaAbierta &&
    (bazasGanadas >= 1 ||
      distancia < -6 ||
      respaldoAliado >= 8 ||
      estaCercaDeCierre(estado, yo.equipo));
  if (puedoBluff && fuerzaConEquipo < umbral) {
    const pocasAltasOcultas = contarDesconocidasFuertes(vista) <= 4;
    const prob =
      p.bluff * (pocasAltasOcultas ? 0.58 : 0.42) +
      (respaldoAliado >= 10 ? 0.1 : 0) +
      Math.max(0, presionDeMarcador(ctx)) * 0.014;
    if (azarContextual(ctx, "bluff-truco") < prob) {
      return { tipo: cantoLegal, jugadorId };
    }
  }
  return null;
}

// ============================================================
// Selección de carta a tirar
// ============================================================

function elegirCarta(ctx: ContextoCanto): Accion {
  const { estado, jugadorId, legales, vista, yo, personalidad: p } = ctx;
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
  const rivalesPorJugar = Math.max(0, cartasRestantesRivales(estado, yo));
  const muchasAltasOcultas = contarDesconocidasFuertes(vista) >= 7;
  const quedanMachosOcultos = maximaDesconocida(vista) >= 13;
  const idsQueJugaron = new Set(baza.jugadas.map((j) => j.jugadorId));
  const aliadasPendientes = compañerosDe(estado, yo)
    .filter((j) => !idsQueJugaron.has(j.id))
    .flatMap((j) => mano.cartasPorJugador[j.id] || []);
  const mejorAliadaPendiente = maxJerarquia(aliadasPendientes);
  const respaldoAliadoTotal = maxJerarquia(cartasAliadasEnMano(ctx));

  // Mejor carta del rival y del compañero ya tiradas en esta baza.
  let mejorRivalEnBaza = -1;
  let mejorAliadoEnBaza = -1;
  for (const j of baza.jugadas) {
    const jug = estado.jugadores.find((p) => p.id === j.jugadorId)!;
    const v = jerarquia(j.carta);
    if (jug.equipo === yo.equipo) {
      if (jug.id !== jugadorId && v > mejorAliadoEnBaza) mejorAliadoEnBaza = v;
    } else {
      if (v > mejorRivalEnBaza) mejorRivalEnBaza = v;
    }
  }
  // Si mi compañero ya está ganando la baza, no necesito gastar — tiro la
  // más chica (sacrificio) y reservo cartas para las próximas bazas.
  const aliadoYaGanando =
    mejorAliadoEnBaza >= 0 && mejorAliadoEnBaza > mejorRivalEnBaza;
  if (aliadoYaGanando) {
    return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
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
      const aliadoPuedeMatar = mejorAliadaPendiente > mejorRivalEnBaza;
      const bazaEsDeVidaOMuerte =
        (numBaza === 2 && bazasPerdidas >= 1) ||
        (numBaza === 3 && bazasGanadas <= bazasPerdidas);
      if (aliadoPuedeMatar && !bazaEsDeVidaOMuerte) {
        return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
      }
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
      if (
        p.bluff > 0.6 &&
        azarContextual(ctx, "sobreactuar-carta") < p.bluff * 0.12
      ) {
        const top = ordenadas[ordenadas.length - 1];
        return { tipo: "jugar_carta", jugadorId, cartaId: top.id };
      }
      // Si todavía quedan varias cartas rivales y el mazo oculto está
      // cargado de altas, no quemamos el ancho para matar un medio: gana
      // con la mínima que alcance. Si la mínima ganadora es frágil pero
      // quedan machos ocultos, aceptamos igual: guardar top suele valer más.
      return { tipo: "jugar_carta", jugadorId, cartaId: ganadora.id };
    }
    // No puedo ganar la baza. Si tampoco puedo empatarla y perder
    // esta baza me hace perder la mano SÍ O SÍ, me voy al mazo en
    // vez de tirar una carta inútil. PERO sólo si NO tengo compañero
    // humano — sino el humano podría tener cartas para defender la
    // mano y al irme al mazo le robo la oportunidad. El bot no puede
    // ver las cartas del compañero, así que tira la chica y deja
    // que el humano decida con su jugada. (Si quisieramos consultar,
    // se podría agregar un tipo "al_mazo" a deberiaConsultar.)
    const puedoEmpatar = ordenadas.some(
      (c) => jerarquia(c) === mejorRivalEnBaza
    );
    const perderiaLaMano =
      (numBaza === 2 && bazasPerdidas >= 1) ||
      (numBaza === 3 &&
        bazasPerdidas >= bazasGanadas &&
        bazasPerdidas > 0);
    const tengoCompañeroHumano = estado.jugadores.some(
      (j) => j.equipo === yo.equipo && j.id !== jugadorId && !j.esBot
    );
    if (
      !puedoEmpatar &&
      perderiaLaMano &&
      !tengoCompañeroHumano &&
      legales.includes("ir_al_mazo")
    ) {
      return { tipo: "ir_al_mazo", jugadorId };
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
      if (respaldoAliadoTotal >= 12 && ordenadas.length >= 3) {
        return {
          tipo: "jugar_carta",
          jugadorId,
          cartaId: ordenadas[0].id
        };
      }
      if (muchasAltasOcultas && ordenadas.length >= 3 && p.cautela > 0.45) {
        return {
          tipo: "jugar_carta",
          jugadorId,
          cartaId: ordenadas[0].id
        };
      }
      if (p.agresion > 0.6) {
        // Bot agresivo lidera con la segunda mejor si tiene doble respaldo;
        // si no, muestra la mejor para comprar iniciativa.
        const top = jerarquia(ordenadas[ordenadas.length - 1]);
        const segunda = jerarquia(
          ordenadas[ordenadas.length - 2] || ordenadas[0]
        );
        const idx = top >= 12 && segunda >= 9 ? 1 : 0;
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
    // Pie en primera: si quedan muchas altas rivales, no regalamos carta
    // media; si el panorama está despejado, podemos mostrar una media para
    // vender fuerza sin gastar la mejor.
    if (!quedanMachosOcultos && rivalesPorJugar <= 4 && p.bluff > 0.65) {
      const idxMedio = Math.floor(ordenadas.length / 2);
      return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[idxMedio].id };
    }
    if (respaldoAliadoTotal >= 11 && ordenadas.length > 1) {
      return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
    }
    return { tipo: "jugar_carta", jugadorId, cartaId: ordenadas[0].id };
  }

  // Segunda o tercera baza, primero en tirar.
  if (numBaza === 2) {
    if (bazasGanadas >= 1) {
      // Gané la 1ra: si el compañero tiene respaldo, bajo chica para
      // tentar al rival; si no, juego media y guardo la mejor para 3ra.
      if (respaldoAliadoTotal >= 10) {
        return {
          tipo: "jugar_carta",
          jugadorId,
          cartaId: ordenadas[0].id
        };
      }
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

  // Sin opciones legales en este momento. Solo nos vamos al mazo si
  // realmente es una opción legal (es nuestro turno) — sino el
  // fallback "siempre ir_al_mazo" hacía que un bot mal-dispachado
  // (ej. compañero del que cantó truco, fuera de turno) cerrara la
  // mano sin sentido. Devolvemos jugar_carta vacío como sentinela —
  // el server lo rechaza silenciosamente, sin tocar el estado.
  if (
    legales.includes("ir_al_mazo") &&
    estado.manoActual?.turnoJugadorId === jugadorId
  ) {
    return { tipo: "ir_al_mazo", jugadorId };
  }
  return { tipo: "jugar_carta", jugadorId, cartaId: "" };
}
