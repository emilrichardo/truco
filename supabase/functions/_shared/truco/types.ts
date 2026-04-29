// Tipos del juego de Truco Argentino.

export type Palo = "espada" | "basto" | "oro" | "copa";
export type Numero = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export interface Carta {
  palo: Palo;
  numero: Numero;
  /** Identificador único basado en palo+numero. */
  id: string;
}

export type Equipo = 0 | 1;

export interface Jugador {
  id: string;
  nombre: string;
  /** Slug del personaje (ej. "marcos"), referencia a /jugadores/<slug>.png */
  personaje: string;
  equipo: Equipo;
  /** Posición sentado en la mesa, 0..N-1, en orden anti-horario. */
  asiento: number;
  conectado: boolean;
  esBot: boolean;
}

/** Una baza es una vuelta de cartas en una mano. */
export interface Baza {
  jugadas: { jugadorId: string; carta: Carta }[];
  ganadorEquipo: Equipo | null; // null si parda o aún no terminada
  pardada: boolean;
}

export type EstadoTruco = "ninguno" | "truco" | "retruco" | "vale4";
export type EstadoEnvido = "ninguno" | "envido" | "real_envido" | "falta_envido";

export interface CantoEnvidoActivo {
  /** Lista acumulada en orden de canto: ej ["envido","real_envido"] */
  cadena: ("envido" | "real_envido" | "falta_envido")[];
  /** Equipo que cantó al último (a quien hay que responderle). */
  equipoQueCanto: Equipo;
  /** Equipo al que le toca responder. */
  equipoQueDebeResponder: Equipo;
}

export interface CantoTrucoActivo {
  nivel: EstadoTruco;
  equipoQueCanto: Equipo;
  equipoQueDebeResponder: Equipo;
}

export type FaseMano =
  | "repartiendo"
  | "envido_pendiente"
  | "truco_pendiente"
  | "jugando"
  | "terminada";

export interface ResolucionEnvido {
  ganadorEquipo: Equipo;
  puntos: number;
  detalle: string;
}

export interface ResolucionFlor {
  ganadorEquipo: Equipo;
  puntos: number;
  detalle: string;
  /** Quiénes cantaron flor en esta mano y con qué puntaje (20 + suma 2 cartas). */
  cantos: { jugadorId: string; puntos: number }[];
}

export interface Mano {
  numero: number;
  manoEquipo: Equipo;
  /** ID del jugador que es "mano" en esta mano (primero en jugar y desempate). */
  manoJugadorId: string;
  /** ID del jugador a quien le toca jugar/cantar ahora. */
  turnoJugadorId: string;
  cartasPorJugador: Record<string, Carta[]>;
  bazas: Baza[];
  trucoEstado: EstadoTruco;
  envidoEstado: EstadoEnvido;
  envidoCantoActivo: CantoEnvidoActivo | null;
  trucoCantoActivo: CantoTrucoActivo | null;
  envidoResuelto: boolean;
  envidoResolucion: ResolucionEnvido | null;
  /** Sólo si la partida se juega `conFlor`. Marca si ya se resolvió la
   *  flor en esta mano. Una vez resuelta no se puede cantar envido. */
  florResuelta: boolean;
  florResolucion: ResolucionFlor | null;
  /** Jugadores que cantaron flor en orden (para mostrar las frases en chat). */
  florCantores: string[];
  /** Equipo que tiene "el truco" (puede subir el canto). null si nadie cantó truco aún. */
  equipoConTruco: Equipo | null;
  /** Puntos en juego por la mano (cuánto vale ganar). */
  valorMano: number;
  /** Si alguien se fue al mazo (perdió la mano). */
  irAlMazoEquipo: Equipo | null;
  fase: FaseMano;
  ganadorMano: Equipo | null;
  puntosOtorgados: { equipo: Equipo; puntos: number; motivo: string }[];
}

export type CategoriaEvento =
  | "carta" // tiró una carta
  | "canto" // cantó envido / truco / etc
  | "respuesta" // quiero / no quiero
  | "puntos" // se otorgaron puntos
  | "mano" // termina/empieza mano
  | "sistema"; // info general

export interface MensajeChat {
  id: string;
  jugadorId: string;
  /** Si está presente, el mensaje se muestra solo al emisor y destinatario. */
  destinatarioId?: string;
  texto: string;
  reaccion?: string;
  /** URL pública del sticker (ej. "/brand/stickers/fernet.png"). */
  sticker?: string;
  /** Marca visual para mensajes de seña entre compañeros. */
  directo?: boolean;
  ts: number;
  /** Si está presente, es un evento del juego (no un mensaje humano). */
  evento?: CategoriaEvento;
}

export type AccionTipo =
  | "jugar_carta"
  | "cantar_envido"
  | "cantar_real_envido"
  | "cantar_falta_envido"
  | "cantar_flor"
  | "responder_quiero"
  | "responder_no_quiero"
  | "cantar_truco"
  | "cantar_retruco"
  | "cantar_vale4"
  | "ir_al_mazo"
  | "mazo"
  // Despacha el reparto de la mano siguiente cuando la actual quedó en
  // fase "terminada". El cliente lo manda tras el delay del resumen.
  | "iniciar_prox_mano";

export interface Accion {
  tipo: AccionTipo;
  jugadorId: string;
  cartaId?: string;
}

export interface EstadoJuego {
  salaId: string;
  jugadores: Jugador[];
  /** 2v2 o 1v1: cantidad de equipos siempre 2. Tamaños 1, 2 o 4 jugadores. */
  modo: "1v1" | "2v2";
  /** ¿Se juega con flor? (3 cartas mismo palo = +3 pts). Default: false. */
  conFlor: boolean;
  puntosObjetivo: 18 | 30;
  puntos: [number, number];
  manoActual: Mano | null;
  historialManos: Mano[];
  ganadorPartida: Equipo | null;
  /** Quién comenzó la partida como mano. Va rotando. */
  primerManoJugadorId: string | null;
  chat: MensajeChat[];
  /** Anuncios efímeros (cantos, quieros, etc.) para mostrar en el tapete. */
  anuncios: { id: string; jugadorId: string; texto: string; ts: number }[];
  iniciada: boolean;
  /** Para identificar el cliente que envió un mensaje, sin auth. */
  version: number;
}
