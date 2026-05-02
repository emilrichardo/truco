// Motor del juego: aplica acciones, calcula bazas, resuelve envido y truco.
import { nanoid } from "nanoid";
import {
  calcularEnvido,
  crearMazo,
  esMachoEfectivo,
  jerarquia,
  mezclar,
  nombreCarta,
  tieneFlor,
  valorFlor
} from "./cartas";
import type {
  Accion,
  Baza,
  Carta,
  CantoEnvidoActivo,
  CantoTrucoActivo,
  Equipo,
  EstadoJuego,
  Jugador,
  Mano,
  ResolucionEnvido
} from "./types";
import { fraseAleatoria, fraseCanonica } from "./frases";
import type { CategoriaFrase } from "./frases";

const ENVIDO_VALORES = {
  envido: { quiero: 2, no_quiero: 1 },
  real_envido: { quiero: 3, no_quiero: 1 },
  falta_envido: { quiero: 0, no_quiero: 1 } // se calcula dinámicamente
};

const TRUCO_VALORES = {
  truco: { quiero: 2, no_quiero: 1 },
  retruco: { quiero: 3, no_quiero: 2 },
  vale4: { quiero: 4, no_quiero: 3 }
};

// ============== Helpers ==============

export function jugadoresEnEquipo(estado: EstadoJuego, eq: Equipo): Jugador[] {
  return estado.jugadores.filter((j) => j.equipo === eq);
}

export function siguienteAsiento(estado: EstadoJuego, asiento: number): number {
  return (asiento + 1) % estado.jugadores.length;
}

export function jugadorPorId(estado: EstadoJuego, id: string): Jugador | undefined {
  return estado.jugadores.find((j) => j.id === id);
}

function jugadorPorAsiento(estado: EstadoJuego, asiento: number): Jugador {
  return estado.jugadores.find((j) => j.asiento === asiento)!;
}

function equipoContrario(eq: Equipo): Equipo {
  return eq === 0 ? 1 : 0;
}

/** Suma puntos a un equipo capando en `puntosObjetivo` — la partida
 *  se gana al llegar al objetivo, no tiene sentido mostrar 21/18 ni
 *  arrastrar excedente. Centralizado acá para no replicar el cap en
 *  cada lugar que otorga puntos (envido, truco, mazo, flor, etc.). */
function darPuntos(estado: EstadoJuego, eq: Equipo, n: number) {
  if (n <= 0) return;
  estado.puntos[eq] = Math.min(
    estado.puntos[eq] + n,
    estado.puntosObjetivo
  );
}

function anuncio(
  estado: EstadoJuego,
  jugadorId: string,
  texto: string,
  evento: import("./types").CategoriaEvento = "sistema"
) {
  const ts = Date.now();
  estado.anuncios.push({ id: nanoid(6), jugadorId, texto, ts });
  if (estado.anuncios.length > 12) estado.anuncios.shift();
  // Espejamos en el chat como historial permanente del juego.
  estado.chat.push({ id: nanoid(6), jugadorId, texto, ts, evento });
  if (estado.chat.length > 200) estado.chat.shift();
}

// ============== Repartir / Iniciar ==============

export function crearEstadoInicial(opts: {
  salaId: string;
  jugadores: Jugador[];
  modo: "1v1" | "2v2";
  puntosObjetivo?: 18 | 30;
  conFlor?: boolean;
}): EstadoJuego {
  return {
    salaId: opts.salaId,
    jugadores: opts.jugadores,
    modo: opts.modo,
    conFlor: opts.conFlor ?? false,
    puntosObjetivo: opts.puntosObjetivo ?? 30,
    puntos: [0, 0],
    manoActual: null,
    historialManos: [],
    ganadorPartida: null,
    primerManoJugadorId: null,
    chat: [],
    anuncios: [],
    iniciada: false,
    version: 0
  };
}

export function iniciarPartida(estado: EstadoJuego): EstadoJuego {
  if (estado.iniciada) return estado;
  estado.iniciada = true;
  // Mano inicial: el primer jugador (asiento 0).
  const primerMano = jugadorPorAsiento(estado, 0);
  estado.primerManoJugadorId = primerMano.id;
  repartirNuevaMano(estado, primerMano.id);
  return estado;
}

function repartirNuevaMano(estado: EstadoJuego, manoJugadorId: string) {
  const manoNum = (estado.historialManos.length || 0) + 1;
  const manoJugador = jugadorPorId(estado, manoJugadorId)!;
  const mazo = mezclar(crearMazo());
  const cartasPorJugador: Record<string, Carta[]> = {};
  for (const j of estado.jugadores) cartasPorJugador[j.id] = [];

  // Reparte 3 cartas a cada uno, comenzando por el siguiente al mano.
  // Convención: el mano recibe primero las suyas en orden.
  let idx = 0;
  const orden: Jugador[] = ordenDesde(estado, manoJugador.asiento);
  for (let ronda = 0; ronda < 3; ronda++) {
    for (const j of orden) {
      cartasPorJugador[j.id].push(mazo[idx++]);
    }
  }

  const mano: Mano = {
    numero: manoNum,
    manoEquipo: manoJugador.equipo,
    manoJugadorId: manoJugador.id,
    turnoJugadorId: manoJugador.id,
    cartasPorJugador,
    bazas: [{ jugadas: [], ganadorEquipo: null, pardada: false }],
    trucoEstado: "ninguno",
    envidoEstado: "ninguno",
    envidoCantoActivo: null,
    trucoCantoActivo: null,
    envidoResuelto: false,
    envidoResolucion: null,
    florResuelta: false,
    florResolucion: null,
    florCantores: [],
    equipoConTruco: null,
    valorMano: 1,
    irAlMazoEquipo: null,
    fase: "jugando",
    ganadorMano: null,
    puntosOtorgados: []
  };
  estado.manoActual = mano;
  estado.version++;
}

function ordenDesde(estado: EstadoJuego, asientoInicio: number): Jugador[] {
  const n = estado.jugadores.length;
  const out: Jugador[] = [];
  for (let i = 0; i < n; i++) {
    out.push(jugadorPorAsiento(estado, (asientoInicio + i) % n));
  }
  return out;
}

// ============== Aplicar acción ==============

export interface ResultadoAccion {
  ok: boolean;
  error?: string;
  estado: EstadoJuego;
}

export function aplicarAccion(estado: EstadoJuego, accion: Accion): ResultadoAccion {
  if (estado.ganadorPartida !== null) {
    return { ok: false, error: "La partida ya terminó.", estado };
  }
  if (!estado.manoActual) {
    return { ok: false, error: "No hay mano activa.", estado };
  }
  // `iniciar_prox_mano` no necesita jugador asociado — la dispara el cliente
  // automáticamente tras el delay del resumen.
  if (accion.tipo === "iniciar_prox_mano") {
    return iniciarProxMano(estado);
  }
  const mano = estado.manoActual;
  const jugador = jugadorPorId(estado, accion.jugadorId);
  if (!jugador) return { ok: false, error: "Jugador inválido.", estado };

  switch (accion.tipo) {
    case "jugar_carta":
      return jugarCarta(estado, jugador, accion.cartaId!, !!accion.cartaTapada);
    case "cantar_envido":
    case "cantar_real_envido":
    case "cantar_falta_envido":
      return cantarEnvido(estado, jugador, accion.tipo);
    case "cantar_flor":
      return cantarFlor(estado, jugador);
    case "cantar_truco":
    case "cantar_retruco":
    case "cantar_vale4":
      return cantarTruco(estado, jugador, accion.tipo);
    case "responder_quiero":
      return responder(estado, jugador, true);
    case "responder_no_quiero":
      return responder(estado, jugador, false);
    case "ir_al_mazo":
    case "mazo":
      return irAlMazo(estado, jugador);
    default:
      return { ok: false, error: "Acción desconocida.", estado };
  }
}

// ============== Jugar carta ==============

function jugarCarta(
  estado: EstadoJuego,
  jugador: Jugador,
  cartaId: string,
  tapada: boolean
): ResultadoAccion {
  const mano = estado.manoActual!;
  if (mano.envidoCantoActivo)
    return { ok: false, error: "Hay un envido pendiente, primero responde.", estado };
  if (mano.trucoCantoActivo)
    return { ok: false, error: "Hay un canto de truco pendiente.", estado };
  if (mano.turnoJugadorId !== jugador.id)
    return { ok: false, error: "No es tu turno.", estado };

  const cartas = mano.cartasPorJugador[jugador.id];
  const idx = cartas.findIndex((c) => c.id === cartaId);
  if (idx < 0) return { ok: false, error: "Esa carta no la tenés.", estado };
  const [carta] = cartas.splice(idx, 1);

  const baza = mano.bazas[mano.bazas.length - 1];
  baza.jugadas.push(
    tapada
      ? { jugadorId: jugador.id, carta, tapada: true }
      : { jugadorId: jugador.id, carta }
  );
  anuncio(
    estado,
    jugador.id,
    tapada ? "Tira tapada" : `Tira ${nombreCarta(carta)}`,
    "carta"
  );

  // Atajo: si la carta tirada es "macho efectivo" — no queda en juego
  // ninguna carta más alta — y su equipo ya ganó una baza anterior,
  // esta baza está definida. Cerramos la mano de una en vez de seguir
  // pidiendo cartas a los demás. Aplica al ancho de espada siempre, al
  // ancho de basto si ya cayó el de espada, al 7 de espada si cayeron
  // los anchos, etc. Una carta tapada nunca es macho — vale lo mínimo.
  const bazaIdx = mano.bazas.length - 1;
  const cartasYaJugadas = mano.bazas.flatMap((b) =>
    b.jugadas.map((j) => j.carta)
  );
  if (!tapada && bazaIdx >= 1 && esMachoEfectivo(carta, cartasYaJugadas)) {
    const bazasGanadasAntes = mano.bazas
      .slice(0, bazaIdx)
      .filter((b) => b.ganadorEquipo === jugador.equipo).length;
    if (bazasGanadasAntes >= 1) {
      baza.ganadorEquipo = jugador.equipo;
      baza.pardada = false;
      cerrarMano(estado, jugador.equipo, "Truco");
      estado.version++;
      return { ok: true, estado };
    }
  }

  // Si todos los jugadores tiraron en esta baza, resolverla.
  if (baza.jugadas.length === estado.jugadores.length) {
    resolverBaza(estado, baza);
    if (mano.fase !== "terminada") {
      // Próxima baza o final de mano
      if (mano.bazas.length < 3 && !mano.ganadorMano) {
        mano.bazas.push({ jugadas: [], ganadorEquipo: null, pardada: false });
        // Regla del truco: "el que mata es mano". Abre la próxima baza
        // el jugador que ganó la anterior; si fue parda, abre el mismo
        // que la abrió.
        mano.turnoJugadorId = siguienteJugadorDespuesDeBaza(estado, baza);
      }
    }
  } else {
    // Pasa el turno al siguiente.
    mano.turnoJugadorId = jugadorPorAsiento(
      estado,
      siguienteAsiento(estado, jugador.asiento)
    ).id;
  }

  estado.version++;
  return { ok: true, estado };
}

/** Valor de una jugada en la baza. Una carta tapada vale -1 (siempre
 *  pierde frente a cualquier carta cara arriba; entre dos tapadas
 *  empata). El resto vale su jerarquía normal. */
function valorEnBaza(j: { carta: Carta; tapada?: boolean }): number {
  return j.tapada ? -1 : jerarquia(j.carta);
}

function siguienteJugadorDespuesDeBaza(estado: EstadoJuego, baza: Baza): string {
  // "El que mata es mano": si la baza tuvo ganador, abre la próxima el
  // jugador del equipo ganador que tiró la carta más alta. Si fue parda,
  // abre el mismo que abrió esta baza (si la parda anterior también fue
  // parda, esto se resuelve por recursión: el opener se mantiene).
  if (baza.ganadorEquipo !== null && !baza.pardada) {
    let mejor: { jugadorId: string; valor: number } | null = null;
    for (const j of baza.jugadas) {
      const jug = jugadorPorId(estado, j.jugadorId)!;
      if (jug.equipo !== baza.ganadorEquipo) continue;
      const v = valorEnBaza(j);
      if (!mejor || v > mejor.valor) {
        mejor = { jugadorId: j.jugadorId, valor: v };
      }
    }
    if (mejor) return mejor.jugadorId;
  }
  return baza.jugadas[0].jugadorId;
}

function resolverBaza(estado: EstadoJuego, baza: Baza) {
  // Comparamos la mejor jugada de cada equipo (las tapadas valen -1).
  const mejorPorEquipo = new Map<Equipo, number>();
  for (const j of baza.jugadas) {
    const jug = jugadorPorId(estado, j.jugadorId)!;
    const v = valorEnBaza(j);
    const actual = mejorPorEquipo.get(jug.equipo);
    if (actual === undefined || v > actual) mejorPorEquipo.set(jug.equipo, v);
  }
  const v0 = mejorPorEquipo.get(0) ?? -1;
  const v1 = mejorPorEquipo.get(1) ?? -1;
  if (v0 > v1) baza.ganadorEquipo = 0;
  else if (v1 > v0) baza.ganadorEquipo = 1;
  else {
    baza.pardada = true;
    baza.ganadorEquipo = null;
  }

  evaluarFinDeMano(estado);
}

/**
 * Evalúa si la mano terminó: dos bazas ganadas por el mismo equipo, o pardas resueltas
 * por el equipo "mano" / regla del que gana la primera tras parda.
 */
function evaluarFinDeMano(estado: EstadoJuego) {
  const mano = estado.manoActual!;
  const bazas = mano.bazas;
  let ganador: Equipo | null = null;

  // Reglas estándar del truco:
  //  - 1ra X, 2da X         → gana X
  //  - 1ra X, 2da parda     → gana X (no se juega 3ra)
  //  - 1ra parda, 2da X     → gana X (no se juega 3ra)
  //  - 1ra X, 2da Y         → 1-1, va a la 3ra
  //  - 1ra parda, 2da parda → va a la 3ra
  //  - 3ra decidida         → gana esa
  //  - 3ra parda con 1-1    → gana el de la 1ra
  //  - 3ra parda con parda-X → gana X
  //  - Las tres pardas      → gana el equipo que es mano
  if (bazas.length >= 2) {
    const b1 = bazas[0];
    const b2 = bazas[1];

    if (!b1.pardada && !b2.pardada) {
      if (b1.ganadorEquipo === b2.ganadorEquipo) ganador = b1.ganadorEquipo;
      // si distintos → 1-1, seguimos a la 3ra
    } else if (!b1.pardada && b2.pardada) {
      ganador = b1.ganadorEquipo;
    } else if (b1.pardada && !b2.pardada) {
      ganador = b2.ganadorEquipo;
    }
    // ambas pardas → seguimos a la 3ra
  }

  if (ganador === null && bazas.length === 3) {
    const b1 = bazas[0];
    const b2 = bazas[1];
    const b3 = bazas[2];

    if (!b3.pardada) {
      ganador = b3.ganadorEquipo;
    } else if (!b1.pardada) {
      // 1-1 (o X-parda imposible aquí porque hubiera cerrado antes) → gana 1ra.
      ganador = b1.ganadorEquipo;
    } else if (!b2.pardada) {
      ganador = b2.ganadorEquipo;
    } else {
      ganador = mano.manoEquipo;
    }
  }

  if (ganador !== null) {
    cerrarMano(estado, ganador, "Truco");
  }
}

function cerrarMano(estado: EstadoJuego, equipoGanador: Equipo, motivo: string) {
  const mano = estado.manoActual!;
  mano.fase = "terminada";
  mano.ganadorMano = equipoGanador;
  // Si nadie cantó truco, vale 1; si lo cantó alguien y se aceptó, mano.valorMano refleja el valor.
  // Si el envido no se cantó, no se otorga punto de envido.
  // Si el envido se aceptó, ya fue otorgado en esa instancia.
  const puntosTruco = mano.valorMano;
  darPuntos(estado, equipoGanador, puntosTruco);
  mano.puntosOtorgados.push({
    equipo: equipoGanador,
    puntos: puntosTruco,
    motivo: `${motivo} (+${puntosTruco})`
  });
  anuncio(
    estado,
    "",
    `Equipo ${equipoGanador + 1} se lleva la mano (+${puntosTruco} pts).`,
    "mano"
  );

  // SIN reacciones simultáneas — antes emitíamos gane_mano/perdio_mano
  // para todos los jugadores y se escuchaba un coro caótico al cierre
  // de cada mano. Ahora el banner ResultadoMano marca el cierre y la
  // mesa queda en silencio hasta el próximo canto.
  chequearFinPartida(estado);
  estado.version++;
}

/**
 * Pasa de la mano "terminada" actual al reparto de la siguiente. Sólo válido
 * si la mano terminó y la partida sigue en juego. El cliente la dispara tras
 * el delay del resumen de mano.
 */
export function iniciarProxMano(estado: EstadoJuego): ResultadoAccion {
  if (estado.ganadorPartida !== null) {
    return { ok: false, error: "La partida ya terminó.", estado };
  }
  const mano = estado.manoActual;
  if (!mano || mano.fase !== "terminada") {
    return { ok: false, error: "La mano todavía no terminó.", estado };
  }
  estado.historialManos.push(mano);
  const proxAsiento = siguienteAsiento(
    estado,
    jugadorPorId(estado, mano.manoJugadorId)!.asiento
  );
  repartirNuevaMano(estado, jugadorPorAsiento(estado, proxAsiento).id);
  return { ok: true, estado };
}

function chequearFinPartida(estado: EstadoJuego): boolean {
  const objetivo = estado.puntosObjetivo;
  if (estado.puntos[0] >= objetivo && estado.puntos[0] > estado.puntos[1]) {
    estado.ganadorPartida = 0;
    return true;
  }
  if (estado.puntos[1] >= objetivo && estado.puntos[1] > estado.puntos[0]) {
    estado.ganadorPartida = 1;
    return true;
  }
  return false;
}

// ============== Ir al mazo ==============

function irAlMazo(estado: EstadoJuego, jugador: Jugador): ResultadoAccion {
  const mano = estado.manoActual!;
  // Solo se va al mazo en tu turno. Sino un bot mal-dispachado (o un
  // jugador haciendo trampa) podría cerrar la mano accidentalmente
  // mientras el rival está respondiendo a un canto. Esto matchea la
  // regla en accionesLegales — ir_al_mazo solo se ofrece en turno.
  if (mano.turnoJugadorId !== jugador.id) {
    return { ok: false, error: "Solo te podés ir al mazo en tu turno.", estado };
  }
  // Si hay envido pendiente y se va al mazo, perdés envido (1) + truco (valor actual).
  const eq = jugador.equipo;
  const otro = equipoContrario(eq);
  anuncio(estado, jugador.id, fraseAleatoria("ir_al_mazo"), "respuesta");
  if (mano.envidoCantoActivo) {
    darPuntos(estado, otro, 1);
    mano.puntosOtorgados.push({
      equipo: otro,
      puntos: 1,
      motivo: "Envido no querido (mazo)"
    });
  }
  cerrarMano(estado, otro, "Se fue al mazo");
  return { ok: true, estado };
}

// ============== Flor ==============

/** Recolecta las cartas originales de un jugador en la mano actual:
 *  las que tiene en mano + las que ya tiró en bazas. Usado para detectar
 *  flor / calcular envido sin importar cuántas haya jugado. */
function cartasOriginalesDe(estado: EstadoJuego, jugadorId: string): Carta[] {
  const mano = estado.manoActual!;
  const enMano = mano.cartasPorJugador[jugadorId] || [];
  const tiradas: Carta[] = [];
  for (const b of mano.bazas) {
    for (const j of b.jugadas) if (j.jugadorId === jugadorId) tiradas.push(j.carta);
  }
  return [...enMano, ...tiradas];
}

function cantarFlor(estado: EstadoJuego, jugador: Jugador): ResultadoAccion {
  const mano = estado.manoActual!;
  if (!estado.conFlor) {
    return { ok: false, error: "Esta partida es sin flor.", estado };
  }
  if (mano.florResuelta) {
    return { ok: false, error: "La flor ya fue resuelta.", estado };
  }
  if (mano.envidoCantoActivo || mano.envidoResuelto) {
    return { ok: false, error: "Ya hubo envido — la flor era antes.", estado };
  }
  if (mano.bazas.length > 1 || mano.bazas[0].jugadas.length === estado.jugadores.length) {
    return { ok: false, error: "Sólo se canta flor en la primera baza.", estado };
  }
  // El jugador que canta debe TENER flor.
  const cartasOrig = cartasOriginalesDe(estado, jugador.id);
  if (!tieneFlor(cartasOrig)) {
    return { ok: false, error: "No tenés flor.", estado };
  }
  // Verificación: el jugador no debe haber tirado carta todavía. Cantar
  // flor después de jugar es fuera de tiempo.
  const yaJugo = mano.bazas[0].jugadas.some((j) => j.jugadorId === jugador.id);
  if (yaJugo) {
    return { ok: false, error: "Ya tiraste carta — flor extemporánea.", estado };
  }

  // Sin contraflor: cada jugador con flor canta y suma +3 a su equipo
  // de manera independiente. NO comparamos tantos — eso sólo aplica con
  // contraflor (no implementado todavía). Si tu compañero también tiene
  // flor, la canta cuando le toque y suma otros +3.
  mano.florCantores.push(jugador.id);
  anuncio(estado, jugador.id, fraseAleatoria("flor"), "canto");
  const puntos = 3;
  darPuntos(estado, jugador.equipo, puntos);
  mano.puntosOtorgados.push({
    equipo: jugador.equipo,
    puntos,
    motivo: `Flor (+${puntos})`
  });
  anuncio(
    estado,
    "",
    `Equipo ${jugador.equipo + 1} +${puntos} pts (flor)`,
    "puntos"
  );

  // ¿Quedan más jugadores con flor sin cantar todavía? Si sí, dejamos
  // la flor abierta para que canten cuando les toque su turno. Si no,
  // marcamos resuelta — el envido queda anulado para esta mano.
  const otrosConFlorPendientes = estado.jugadores.some(
    (j) =>
      j.id !== jugador.id &&
      !mano.florCantores.includes(j.id) &&
      tieneFlor(cartasOriginalesDe(estado, j.id))
  );
  if (!otrosConFlorPendientes) {
    mano.florResuelta = true;
    mano.florResolucion = {
      ganadorEquipo: jugador.equipo,
      puntos,
      detalle: `Flor cantada por ${mano.florCantores.length} jugador(es).`,
      cantos: mano.florCantores.map((id) => ({
        jugadorId: id,
        puntos: valorFlor(cartasOriginalesDe(estado, id))
      }))
    };
  }
  if (chequearFinPartida(estado)) {
    return { ok: true, estado };
  }
  estado.version++;
  return { ok: true, estado };
}

// ============== Envido ==============

function cantarEnvido(
  estado: EstadoJuego,
  jugador: Jugador,
  tipo: "cantar_envido" | "cantar_real_envido" | "cantar_falta_envido"
): ResultadoAccion {
  const mano = estado.manoActual!;
  // Si ya alguien cantó flor en esta mano, el envido queda anulado —
  // los puntos de la flor ya fueron repartidos. (Se puede "negar la
  // flor" no cantándola y cantando envido en su lugar; eso vive en
  // accionesLegales que ofrece ambas opciones al jugador con flor.)
  if (estado.conFlor && mano.florCantores.length > 0) {
    return { ok: false, error: "Hubo flor — no se canta envido.", estado };
  }
  // Solo se puede cantar envido durante la primera baza (ninguna baza terminada aún)
  // y antes de que el jugador "mano" haya jugado su segunda carta.
  if (mano.bazas[0].jugadas.length === estado.jugadores.length || mano.bazas.length > 1) {
    return { ok: false, error: "Ya no se puede cantar envido.", estado };
  }
  if (mano.envidoResuelto) {
    return { ok: false, error: "El envido ya fue resuelto.", estado };
  }
  if (mano.trucoEstado !== "ninguno" && !mano.trucoCantoActivo) {
    return { ok: false, error: "Ya se cantó truco antes que envido.", estado };
  }
  // Si MI equipo ya tiene un canto pendiente esperando respuesta del
  // rival, rechazamos. Sino el spam-click del botón anunciaba "¡Envido!"
  // múltiples veces y el audio se acumulaba.
  if (
    mano.envidoCantoActivo &&
    mano.envidoCantoActivo.equipoQueCanto === jugador.equipo
  ) {
    return { ok: false, error: "Ya cantaste envido; esperá la respuesta.", estado };
  }

  const nivelNuevo = tipo === "cantar_envido" ? "envido" : tipo === "cantar_real_envido" ? "real_envido" : "falta_envido";
  let cadena = mano.envidoCantoActivo ? mano.envidoCantoActivo.cadena.slice() : [];

  // Validación de orden: envido(s) → real_envido → falta_envido.
  //  - Hasta 2 envidos seguidos.
  //  - Real envido sólo escala desde envido (1 o 2). No se puede cantar
  //    real envido después de real envido — ya está en ese nivel, sólo
  //    puede subir a falta envido.
  //  - Falta envido siempre puede cerrar la cadena.
  if (cadena.length === 0) {
    cadena.push(nivelNuevo);
  } else {
    const ultimo = cadena[cadena.length - 1];
    if (nivelNuevo === "envido" && ultimo === "envido" && cadena.filter((c) => c === "envido").length < 2) {
      cadena.push("envido");
    } else if (nivelNuevo === "real_envido" && ultimo === "envido") {
      cadena.push("real_envido");
    } else if (nivelNuevo === "falta_envido" && ultimo !== "falta_envido") {
      cadena.push("falta_envido");
    } else {
      return { ok: false, error: "Canto inválido en este momento.", estado };
    }
  }

  mano.envidoCantoActivo = {
    cadena,
    equipoQueCanto: jugador.equipo,
    equipoQueDebeResponder: equipoContrario(jugador.equipo)
  };
  mano.envidoEstado = nivelNuevo as any;
  // Le pasamos el "turno de responder" al rival más cercano en sentido
  // anti-horario — así la ronda no se invierte cuando canta el segundo
  // jugador de un equipo en 2v2.
  mano.turnoJugadorId = siguienteJugadorDeEquipo(
    estado,
    jugador.asiento,
    equipoContrario(jugador.equipo)
  );
  anuncio(estado, jugador.id, fraseDeCanto(nivelNuevo, cadena), "canto");
  estado.version++;
  return { ok: true, estado };
}

function cantoTexto(nivel: string): string {
  // Texto canónico (variante 1) para motivos en breakdowns y logs.
  // Para anuncios al chat, usar fraseDeCanto que pica una variante random.
  return fraseCanonica(nivelACategoria(nivel));
}

function nivelACategoria(nivel: string): CategoriaFrase {
  // El motor usa "vale4" internamente, las frases usan "vale_cuatro".
  if (nivel === "vale4") return "vale_cuatro";
  return nivel as CategoriaFrase;
}

/** Texto cantado al chat — pica una variante random según el nivel.
 *  Para envido, si la cadena tiene dos envidos seguidos, usa la categoría
 *  envido_envido (que tiene frases dedicadas). */
function fraseDeCanto(
  nivel: string,
  cadena?: ("envido" | "real_envido" | "falta_envido")[]
): string {
  if (
    nivel === "envido" &&
    cadena &&
    cadena.filter((c) => c === "envido").length >= 2
  ) {
    return fraseAleatoria("envido_envido");
  }
  return fraseAleatoria(nivelACategoria(nivel));
}

function primerJugadorDeEquipo(estado: EstadoJuego, eq: Equipo): string {
  // Toma el primer jugador del equipo en orden de asiento.
  return jugadoresEnEquipo(estado, eq).sort((a, b) => a.asiento - b.asiento)[0].id;
}

/**
 * Devuelve el siguiente jugador del equipo `eq` en orden anti-horario
 * partiendo del asiento `desdeAsiento`. Usado al pasar el turno tras un
 * canto: la ronda nunca debe retroceder, siempre avanza al rival más
 * cercano en sentido anti-horario.
 */
function siguienteJugadorDeEquipo(
  estado: EstadoJuego,
  desdeAsiento: number,
  eq: Equipo
): string {
  const n = estado.jugadores.length;
  for (let i = 1; i <= n; i++) {
    const a = (desdeAsiento + i) % n;
    const j = jugadorPorAsiento(estado, a);
    if (j.equipo === eq) return j.id;
  }
  return primerJugadorDeEquipo(estado, eq);
}

// ============== Truco ==============

function cantarTruco(
  estado: EstadoJuego,
  jugador: Jugador,
  tipo: "cantar_truco" | "cantar_retruco" | "cantar_vale4"
): ResultadoAccion {
  const mano = estado.manoActual!;
  if (mano.envidoCantoActivo) return { ok: false, error: "Resolvé el envido primero.", estado };

  const subir = tipo === "cantar_truco" ? "truco" : tipo === "cantar_retruco" ? "retruco" : "vale4";

  // Validar progresión. Hay dos contextos posibles para retruco / vale 4:
  //   A) Sub-canto después de QUERER el nivel anterior — el equipo que
  //      tiene "el quiero" sube. Aplica el chequeo clásico: trucoEstado y
  //      equipoConTruco.
  //   B) Respuesta a un canto pendiente — el rival cantó truco y vos
  //      respondés con retruco (acepta + sube en una). En ese caso
  //      trucoEstado todavía está "ninguno" y trucoCantoActivo apunta al
  //      canto del rival; aceptamos implícitamente y subimos.
  const cantoPendiente = mano.trucoCantoActivo;
  const respondiendoAlRival =
    !!cantoPendiente && cantoPendiente.equipoQueDebeResponder === jugador.equipo;

  // El truco se puede cantar en cualquier momento (igual que el envido en
  // baza 1) — no hace falta esperar el turno propio. La validación de
  // que sea el equipo que corresponde la hacen los if's de progresión.

  // Si MI equipo ya tiene un canto pendiente esperando respuesta del
  // rival, rechazamos. Sino el usuario podía spam-clickar Truco y cada
  // click anunciaba "¡Truco!" otra vez (y el audio se acumulaba 5
  // veces). Cada equipo solo puede tener UN canto activo a la vez.
  if (
    cantoPendiente &&
    cantoPendiente.equipoQueCanto === jugador.equipo
  ) {
    return { ok: false, error: "Ya cantaste; esperá la respuesta.", estado };
  }

  if (subir === "truco" && mano.trucoEstado !== "ninguno") {
    return { ok: false, error: "Ya se cantó truco.", estado };
  }

  if (subir === "retruco") {
    if (respondiendoAlRival && cantoPendiente!.nivel === "truco") {
      // B: rival cantó truco, yo respondo con retruco. Acepto su truco
      // (vale 2 ya bloqueado para mí si rechazan retruco) y subo.
      mano.trucoEstado = "truco";
      mano.valorMano = 2;
      mano.equipoConTruco = jugador.equipo;
    } else if (mano.trucoEstado !== "truco") {
      return { ok: false, error: "Solo se canta retruco después de truco.", estado };
    } else if (mano.equipoConTruco === jugador.equipo) {
      return { ok: false, error: "No podés subir tu propio truco.", estado };
    }
  }
  if (subir === "vale4") {
    if (respondiendoAlRival && cantoPendiente!.nivel === "retruco") {
      // B: rival cantó retruco, respondo con vale 4 (acepta + sube).
      mano.trucoEstado = "retruco";
      mano.valorMano = 3;
      mano.equipoConTruco = jugador.equipo;
    } else if (mano.trucoEstado !== "retruco") {
      return { ok: false, error: "Solo se canta vale 4 después de retruco.", estado };
    } else if (mano.equipoConTruco === jugador.equipo) {
      return { ok: false, error: "No podés subir tu propio retruco.", estado };
    }
  }

  mano.trucoCantoActivo = {
    nivel: subir as any,
    equipoQueCanto: jugador.equipo,
    equipoQueDebeResponder: equipoContrario(jugador.equipo)
  };
  // Le pasamos el turno de responder al rival más cercano en sentido
  // anti-horario, para no invertir la ronda en 2v2 cuando el canto sale
  // del segundo jugador del equipo.
  mano.turnoJugadorId = siguienteJugadorDeEquipo(
    estado,
    jugador.asiento,
    equipoContrario(jugador.equipo)
  );
  anuncio(estado, jugador.id, fraseDeCanto(subir), "canto");
  estado.version++;
  return { ok: true, estado };
}

// ============== Responder a un canto (envido o truco) ==============

function responder(
  estado: EstadoJuego,
  jugador: Jugador,
  quiere: boolean
): ResultadoAccion {
  const mano = estado.manoActual!;
  if (mano.envidoCantoActivo) {
    if (jugador.equipo !== mano.envidoCantoActivo.equipoQueDebeResponder) {
      return { ok: false, error: "Tu equipo no debe responder al envido.", estado };
    }
    return resolverEnvido(estado, jugador, quiere);
  }
  if (mano.trucoCantoActivo) {
    if (jugador.equipo !== mano.trucoCantoActivo.equipoQueDebeResponder) {
      return { ok: false, error: "Tu equipo no debe responder al truco.", estado };
    }
    return resolverTrucoRespuesta(estado, jugador, quiere);
  }
  return { ok: false, error: "No hay nada que responder.", estado };
}

function resolverEnvido(
  estado: EstadoJuego,
  jugador: Jugador,
  quiere: boolean
): ResultadoAccion {
  const mano = estado.manoActual!;
  const cadena = mano.envidoCantoActivo!.cadena;
  const cantoTop = cadena[cadena.length - 1];

  if (!quiere) {
    // El que dijo "no quiero" pierde tantos puntos como vale el canto anterior aceptado
    // (o 1 punto si solo había envido simple). Reglas argentinas:
    // - Si la cadena es [envido] → +1 al equipo que cantó.
    // - Si es [envido, envido] → +1 (al rechazar el 2do, gana 1 por el 2do canto, suma +1 al primero también).
    // Convención simplificada: cuando se rechaza, el equipo que cantó al final gana
    // los puntos del nivel inmediatamente anterior aceptado (o 1 si no hay anterior).
    let puntosOtorgados = 1;
    if (cadena.length >= 2) {
      // suma 1 por cada canto excepto el último.
      puntosOtorgados = 0;
      for (let i = 0; i < cadena.length - 1; i++) {
        const c = cadena[i];
        puntosOtorgados += c === "envido" ? 2 : c === "real_envido" ? 3 : 1;
      }
      if (puntosOtorgados === 0) puntosOtorgados = 1;
    }
    const eqGanador = mano.envidoCantoActivo!.equipoQueCanto;
    darPuntos(estado, eqGanador, puntosOtorgados);
    mano.puntosOtorgados.push({
      equipo: eqGanador,
      puntos: puntosOtorgados,
      motivo: `Envido no querido (+${puntosOtorgados})`
    });
    anuncio(estado, jugador.id, fraseAleatoria("no_quiero"), "respuesta");
    anuncio(
      estado,
      "",
      `Equipo ${eqGanador + 1} +${puntosOtorgados} (envido no querido)`,
      "puntos"
    );
    mano.envidoResuelto = true;
    mano.envidoEstado = "ninguno";
    mano.envidoCantoActivo = null;
    mano.envidoResolucion = {
      ganadorEquipo: eqGanador,
      puntos: puntosOtorgados,
      detalle: `Envido no querido. Equipo ${eqGanador + 1} +${puntosOtorgados}.`
    };
    // Devuelvo el turno al "mano" o a quien le tocaba jugar carta.
    devolverTurnoAJugar(estado);
    if (chequearFinPartida(estado)) {
      return { ok: true, estado };
    }
    estado.version++;
    return { ok: true, estado };
  }

  // QUIERO: calcular envidos y otorgar puntos al ganador.
  let puntosTotal = 0;
  for (const c of cadena) {
    puntosTotal += c === "envido" ? 2 : c === "real_envido" ? 3 : 0;
  }
  let esFalta = false;
  if (cadena.includes("falta_envido")) esFalta = true;

  // Recolectamos los envidos por equipo (mejor de cada equipo, "mano" gana empates).
  const mejorPorEquipo = mejorEnvidoPorEquipo(estado);
  const eq0 = mejorPorEquipo[0];
  const eq1 = mejorPorEquipo[1];

  let eqGanador: Equipo;
  let detalle = "";
  if (eq0.puntos > eq1.puntos) eqGanador = 0;
  else if (eq1.puntos > eq0.puntos) eqGanador = 1;
  else eqGanador = mano.manoEquipo; // empate gana el mano

  detalle = `Equipo 1: ${eq0.puntos} — Equipo 2: ${eq1.puntos}. Gana el equipo ${eqGanador + 1}.`;

  let puntosOtorgados = puntosTotal;
  if (esFalta) {
    // Falta envido: gana lo que le falta al adversario para ganar la partida.
    // Se otorgan al ganador puntos = puntosObjetivo - puntos del que va ganando.
    const lider = estado.puntos[0] >= estado.puntos[1] ? 0 : 1;
    const faltan = estado.puntosObjetivo - estado.puntos[lider];
    puntosOtorgados = faltan; // puntos del falta envido
    // Si había envido/real_envido aceptados antes del falta envido, esos también suman.
    // Convención: si la cadena empieza con envido o real_envido aceptado y luego se canta falta,
    // pero aquí todo se aceptó al final con falta_envido, simplificamos: al aceptar falta envido
    // gana SOLO los puntos del falta envido (suma de previos no aplica al "querer" final).
  }

  darPuntos(estado, eqGanador, puntosOtorgados);
  mano.envidoResuelto = true;
  mano.envidoResolucion = { ganadorEquipo: eqGanador, puntos: puntosOtorgados, detalle };
  mano.puntosOtorgados.push({
    equipo: eqGanador,
    puntos: puntosOtorgados,
    motivo: `Envido querido (+${puntosOtorgados})`
  });
  anuncio(estado, jugador.id, fraseAleatoria("quiero"), "respuesta");
  // Cada equipo canta su tanto en orden: el "mano" primero, después el
  // otro. La capa de audio detecta el número y reproduce el clip de
  // envido_puntos correspondiente con la voz del jugador.
  declararTantos(estado, eq0, eq1);
  anuncio(estado, "", detalle, "puntos");
  anuncio(
    estado,
    "",
    `Equipo ${eqGanador + 1} +${puntosOtorgados} pts`,
    "puntos"
  );
  mano.envidoEstado = "ninguno";
  mano.envidoCantoActivo = null;
  devolverTurnoAJugar(estado);
  if (chequearFinPartida(estado)) {
    return { ok: true, estado };
  }
  estado.version++;
  return { ok: true, estado };
}

/** Anuncia el tanto de cada equipo en orden — el "mano" primero, después
 *  el otro. Si el segundo tiene menos, dice "Son buenas". Si tiene más,
 *  declara su número. La capa de audio detecta el "Tengo N." y reproduce
 *  el clip de envido_puntos/<N>.mp3 con la voz del jugador. */
function declararTantos(
  estado: EstadoJuego,
  eq0: { jugadorId: string; puntos: number },
  eq1: { jugadorId: string; puntos: number }
) {
  const mano = estado.manoActual!;
  const eqMano = mano.manoEquipo;
  const declMano = eqMano === 0 ? eq0 : eq1;
  const declOtro = eqMano === 0 ? eq1 : eq0;

  anuncio(estado, declMano.jugadorId, `Tengo ${declMano.puntos}.`, "respuesta");

  if (declOtro.puntos > declMano.puntos) {
    anuncio(
      estado,
      declOtro.jugadorId,
      `Tengo ${declOtro.puntos}.`,
      "respuesta"
    );
  } else {
    anuncio(
      estado,
      declOtro.jugadorId,
      fraseAleatoria("son_buenas"),
      "respuesta"
    );
  }
}

function mejorEnvidoPorEquipo(estado: EstadoJuego) {
  const mano = estado.manoActual!;
  const out: Record<number, { jugadorId: string; puntos: number }> = {};
  for (const j of estado.jugadores) {
    const cartasOriginales = cartasOriginalesDeMano(estado, j.id);
    const e = calcularEnvido(cartasOriginales);
    const eq = j.equipo;
    const actual = out[eq];
    if (!actual) {
      out[eq] = { jugadorId: j.id, puntos: e };
    } else {
      // En empate dentro del mismo equipo gana el más cercano al "mano".
      if (e > actual.puntos) out[eq] = { jugadorId: j.id, puntos: e };
      else if (e === actual.puntos) {
        if (asientoDistanciaAlMano(estado, j.asiento) < asientoDistanciaAlMano(estado, jugadorPorId(estado, actual.jugadorId)!.asiento)) {
          out[eq] = { jugadorId: j.id, puntos: e };
        }
      }
    }
  }
  return out as { 0: { jugadorId: string; puntos: number }; 1: { jugadorId: string; puntos: number } };
}

function asientoDistanciaAlMano(estado: EstadoJuego, asiento: number): number {
  const manoAsiento = jugadorPorId(estado, estado.manoActual!.manoJugadorId)!.asiento;
  return (asiento - manoAsiento + estado.jugadores.length) % estado.jugadores.length;
}

function cartasOriginalesDeMano(estado: EstadoJuego, jugadorId: string): Carta[] {
  // Para envido necesitamos las 3 cartas originales (no las que quedan).
  // Reconstruimos desde el estado: cartas en mano + cartas ya tiradas por el jugador en bazas.
  const mano = estado.manoActual!;
  const enMano = mano.cartasPorJugador[jugadorId] || [];
  const tiradas: Carta[] = [];
  for (const b of mano.bazas) {
    for (const j of b.jugadas) if (j.jugadorId === jugadorId) tiradas.push(j.carta);
  }
  return [...enMano, ...tiradas];
}

function devolverTurnoAJugar(estado: EstadoJuego) {
  const mano = estado.manoActual!;
  const idx = mano.bazas.length - 1;
  const baza = mano.bazas[idx];
  // El turno vuelve al jugador que correspondía antes del canto:
  //  - Si nadie tiró todavía en la baza, vuelve al APERTURADOR de esta
  //    baza (mano de la mano si es la 1ra; el ganador de la baza
  //    anterior si es la 2da o 3ra). Antes apuntaba siempre al mano de
  //    la mano, lo que dejaba al juego trabado cuando un bot cantaba al
  //    abrir baza 2 y luego el rival decía quiero — el turno volvía al
  //    mano de la mano original en vez de al bot que abría.
  //  - Si ya hay cartas, vuelve al siguiente al último que tiró.
  if (baza.jugadas.length === 0) {
    mano.turnoJugadorId =
      idx === 0
        ? mano.manoJugadorId
        : siguienteJugadorDespuesDeBaza(estado, mano.bazas[idx - 1]);
  } else {
    const ultimo = baza.jugadas[baza.jugadas.length - 1];
    const jUlt = jugadorPorId(estado, ultimo.jugadorId)!;
    mano.turnoJugadorId = jugadorPorAsiento(
      estado,
      siguienteAsiento(estado, jUlt.asiento)
    ).id;
  }
}

function resolverTrucoRespuesta(
  estado: EstadoJuego,
  jugador: Jugador,
  quiere: boolean
): ResultadoAccion {
  const mano = estado.manoActual!;
  const canto = mano.trucoCantoActivo!;
  if (!quiere) {
    // Quien dijo "no quiero" cede el truco, el equipo que cantó gana el valor anterior.
    const valorAnterior =
      canto.nivel === "truco" ? 1 : canto.nivel === "retruco" ? 2 : 3;
    darPuntos(estado, canto.equipoQueCanto, valorAnterior);
    mano.puntosOtorgados.push({
      equipo: canto.equipoQueCanto,
      puntos: valorAnterior,
      motivo: `${cantoTexto(canto.nivel)} no querido (+${valorAnterior})`
    });
    anuncio(estado, jugador.id, fraseAleatoria("no_quiero"), "respuesta");
    // Los puntos del "no quiero" YA son el valor del mano que el cantor
    // gana. Si dejamos valorMano > 0, cerrarMano daría puntos dobles
    // (el +1 del no quiero + el valorMano por defecto).
    mano.valorMano = 0;
    cerrarMano(estado, canto.equipoQueCanto, "Truco no querido");
    mano.trucoCantoActivo = null;
    return { ok: true, estado };
  }
  // Quiero: actualiza valor y nivel, equipo que ganó el canto puede subir.
  mano.trucoEstado = canto.nivel;
  mano.equipoConTruco = canto.equipoQueCanto;
  mano.valorMano =
    canto.nivel === "truco" ? 2 : canto.nivel === "retruco" ? 3 : 4;
  anuncio(estado, jugador.id, fraseAleatoria("quiero"), "respuesta");
  mano.trucoCantoActivo = null;
  devolverTurnoAJugar(estado);
  estado.version++;
  return { ok: true, estado };
}

// ============== Acciones legales (para UI / IA) ==============

export function accionesLegales(estado: EstadoJuego, jugadorId: string): Accion["tipo"][] {
  const mano = estado.manoActual;
  if (!mano || estado.ganadorPartida !== null) return [];
  const j = jugadorPorId(estado, jugadorId);
  if (!j) return [];

  const out: Accion["tipo"][] = [];
  // Responder envido o truco si es su equipo el que debe responder
  if (mano.envidoCantoActivo && j.equipo === mano.envidoCantoActivo.equipoQueDebeResponder) {
    out.push("responder_quiero", "responder_no_quiero");
    const cadena = mano.envidoCantoActivo.cadena;
    const ultimo = cadena[cadena.length - 1];
    // Envido sólo se puede repetir hasta 2 veces, y sólo si el último
    // canto también fue envido.
    if (ultimo === "envido" && cadena.filter((c) => c === "envido").length < 2)
      out.push("cantar_envido");
    // Real envido sólo escala desde envido. Después de real envido el
    // único paso arriba es falta envido.
    if (ultimo === "envido") out.push("cantar_real_envido");
    if (ultimo !== "falta_envido") out.push("cantar_falta_envido");
    return out;
  }
  if (mano.trucoCantoActivo && j.equipo === mano.trucoCantoActivo.equipoQueDebeResponder) {
    out.push("responder_quiero", "responder_no_quiero");
    const n = mano.trucoCantoActivo.nivel;
    if (n === "truco") out.push("cantar_retruco");
    else if (n === "retruco") out.push("cantar_vale4");
    // "El envido está primero": cuando el rival canta truco antes de que se
    // haya jugado/resuelto el envido en la primera baza, el equipo que debe
    // responder puede cortarlo cantando envido. El motor resuelve primero el
    // envido y después se vuelve a contestar al truco.
    if (
      !mano.envidoResuelto &&
      mano.bazas.length === 1 &&
      mano.bazas[0].jugadas.length < estado.jugadores.length
    ) {
      out.push("cantar_envido", "cantar_real_envido", "cantar_falta_envido");
    }
    return out;
  }

  // Flor: si la partida es con flor y el jugador tiene 3 cartas del mismo
  // palo, puede cantarla en baza 1 antes de tirar carta y antes de
  // haberla ya cantado. Cada flor cantada suma +3 al equipo de quien
  // canta — múltiples jugadores con flor pueden cantar. Tener flor NO
  // obliga a cantarla: el jugador puede negar la flor y cantar envido.
  if (estado.conFlor && mano.bazas.length === 1) {
    const cartasOrig = cartasOriginalesDe(estado, j.id);
    const yaJugo = mano.bazas[0].jugadas.some((x) => x.jugadorId === j.id);
    const yaCantoFlor = mano.florCantores.includes(j.id);
    if (tieneFlor(cartasOrig) && !yaJugo && !yaCantoFlor) {
      out.push("cantar_flor");
    }
  }

  // Envido cantable en baza 1 por CUALQUIER jugador (esté en turno o no),
  // siempre que la baza no haya terminado y nadie haya cantado todavía.
  // Esta es la regla de truco argentino — el pie puede cortar la mano
  // antes de que el contrario juegue, sin esperar su turno. Si el truco
  // ya fue aceptado (trucoEstado != "ninguno") el envido se bloquea —
  // la única excepción es "envido está primero" que vive en el bloque
  // de respuesta a un canto pendiente más arriba. Si alguien CANTÓ flor,
  // se cobra esa y el envido queda anulado. Tener flor sin cantarla NO
  // bloquea el envido — el jugador puede "negar la flor" (no cantarla)
  // y elegir el envido en su lugar.
  const envidoCantableEnBaza1 =
    !mano.envidoResuelto &&
    !mano.envidoCantoActivo &&
    mano.florCantores.length === 0 &&
    mano.trucoEstado === "ninguno" &&
    mano.bazas.length === 1 &&
    mano.bazas[0].jugadas.length < estado.jugadores.length;
  if (envidoCantableEnBaza1) {
    out.push("cantar_envido", "cantar_real_envido", "cantar_falta_envido");
  }

  // Si es su turno y no hay cantos pendientes:
  if (mano.turnoJugadorId === j.id) {
    out.push("jugar_carta");
    out.push("ir_al_mazo");
  }
  // Truco / retruco / vale 4: se ofrecen también fuera de turno mientras
  // no haya un envido o truco pendiente. Es la regla que la mayoría
  // espera — querés gritar truco ni bien ves la mano, sin tener que
  // esperar a que termine de jugar el rival. El motor sigue validando.
  // ¡Importante! `!mano.trucoCantoActivo` evita ofrecer "cantar_truco"
  // cuando MI equipo ya cantó y está esperando respuesta del rival;
  // sino el botón seguía habilitado y mandar otra vez sobreescribía
  // el canto pendiente o disparaba el "ya se cantó" del server.
  if (!mano.envidoCantoActivo && !mano.trucoCantoActivo) {
    if (mano.trucoEstado === "ninguno") out.push("cantar_truco");
    else if (mano.trucoEstado === "truco" && mano.equipoConTruco !== j.equipo)
      out.push("cantar_retruco");
    else if (mano.trucoEstado === "retruco" && mano.equipoConTruco !== j.equipo)
      out.push("cantar_vale4");
  }
  return out;
}
