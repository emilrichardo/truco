"use client";
// Catálogo de sonidos del juego. Si hay clips de audio reales en
// /public/audio/<canto>/<n>.mp3 los carga con Howler. Si no existen
// (o fallan), cae a Web Speech con la voz personalizada por jugador.

import { Howl } from "howler";
import { hablar, silenciarVoz } from "./voz";

type CategoriaCanto =
  | "envido"
  | "real_envido"
  | "falta_envido"
  | "truco"
  | "retruco"
  | "vale_cuatro"
  | "quiero"
  | "no_quiero"
  | "ir_al_mazo";

// Frases con personalidad / variación. Se elige una al azar cada vez.
const FRASES: Record<CategoriaCanto, string[]> = {
  envido: ["¡Envido!", "¡Envidoooo!", "¡Te canto envido!", "¡Envido, primo!"],
  real_envido: ["¡Real envido!", "¡Real envido, primo!", "¡Real!"],
  falta_envido: ["¡Falta envido!", "¡Falta envidoooo!", "¡Falta envido, capo!"],
  truco: ["¡Truco!", "¡Trucooo!", "¡Truco, primo!", "¡Te canto el truco!"],
  retruco: ["¡Quiero retruco!", "¡Retruco!", "¡Retruquito!"],
  vale_cuatro: ["¡Vale cuatro!", "¡Vale cuatrooo!", "¡Vale 4, primo!"],
  quiero: ["¡Quiero!", "¡Quiero claro!", "¡Quiero, dale!", "¡Acá estamos!"],
  no_quiero: ["¡No quiero!", "¡Ni en pedo!", "¡No!", "¡Ni ahí!", "¡Para qué!"],
  ir_al_mazo: ["Mazo", "Me voy al mazo", "Al mazo che"]
};

// Frases de reacción cuando termina una mano.
const FRASES_GANE_MANO = [
  "¡Eso!",
  "¡Ja!",
  "¡Tomá!",
  "¡Cómo te clavé!",
  "¡Ahí está!"
];
const FRASES_PIERDE_MANO = [
  "¡Uy!",
  "¡Aaay no!",
  "¡Mirá vos!",
  "¡Otra!",
  "Bueno…"
];
const FRASES_GANE_PARTIDA = [
  "¡Listo el pollo!",
  "¡La mesa es mía!",
  "¡A pagar el fernet!",
  "¡Ganamooos!"
];
const FRASES_PIERDE_PARTIDA = [
  "Ah no, otra mano",
  "Tuviste suerte",
  "Para la próxima",
  "Estaba lavada"
];

function elegir<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Map de identificación: detecta el canto a partir del texto del evento.
function identificarCanto(texto: string): CategoriaCanto | null {
  const t = texto.toLowerCase();
  if (t.includes("falta envido")) return "falta_envido";
  if (t.includes("real envido")) return "real_envido";
  if (t.includes("envido")) return "envido";
  if (t.includes("vale cuatro") || t.includes("vale 4")) return "vale_cuatro";
  if (t.includes("retruco")) return "retruco";
  if (t.includes("truco")) return "truco";
  if (t.includes("quiero") && !t.includes("no")) return "quiero";
  if (t.includes("no quiero") || t.includes("no_quiero")) return "no_quiero";
  if (t.includes("mazo")) return "ir_al_mazo";
  return null;
}

// Cache de Howl para no recrear instancias.
const cacheHowl: Record<string, Howl | null> = {};

/** Si existe un clip en /audio/<canto>/01.mp3 lo carga; si no, devuelve null. */
function cargarHowl(canto: CategoriaCanto): Howl | null {
  if (cacheHowl[canto] !== undefined) return cacheHowl[canto];
  const sources = [
    `/audio/${canto}/01.mp3`,
    `/audio/${canto}/02.mp3`,
    `/audio/${canto}/03.mp3`
  ];
  // Howler intenta cargar en orden; si todos fallan, onloaderror se dispara.
  let cargado = false;
  const h = new Howl({
    src: sources,
    volume: 0.95,
    preload: true,
    onload: () => {
      cargado = true;
    },
    onloaderror: () => {
      cacheHowl[canto] = null;
    }
  });
  // Pequeño hack: si después de un tick no cargó, tratamos como inexistente.
  setTimeout(() => {
    if (!cargado) cacheHowl[canto] = null;
  }, 1500);
  cacheHowl[canto] = h;
  return h;
}

interface OpcionesCanto {
  jugadorId: string;
  /** Frase base si no hay clip. */
  texto?: string;
  intensidad?: number;
}

/** Reproduce un canto: intenta clip MP3, cae a TTS con personalidad. */
export function reproducirCanto(canto: CategoriaCanto, opts: OpcionesCanto) {
  const h = cargarHowl(canto);
  if (h && cacheHowl[canto] !== null) {
    try {
      h.stop();
      h.play();
      return;
    } catch {
      // sigue al fallback
    }
  }
  const frase = elegir(FRASES[canto]);
  // No interrumpimos: las voces hacen cola. Así si yo canto envido y el
  // bot responde 700ms después, primero termina mi "¡Envido!" y luego
  // suena el "¡No quiero!" del bot. Si interrumpíamos, mi voz se cortaba.
  hablar(frase, opts.jugadorId, {
    intensidad: opts.intensidad ?? 1.05,
    interrumpir: false
  });
}

export function reaccionGanaMano(jugadorId: string) {
  hablar(elegir(FRASES_GANE_MANO), jugadorId, { intensidad: 1.15 });
}

export function reaccionPierdeMano(jugadorId: string) {
  hablar(elegir(FRASES_PIERDE_MANO), jugadorId, { intensidad: 0.95 });
}

export function reaccionGanaPartida(jugadorId: string) {
  hablar(elegir(FRASES_GANE_PARTIDA), jugadorId, { intensidad: 1.2 });
}

export function reaccionPierdePartida(jugadorId: string) {
  hablar(elegir(FRASES_PIERDE_PARTIDA), jugadorId, { intensidad: 0.85 });
}

export function silenciarTodo() {
  silenciarVoz();
  Object.values(cacheHowl).forEach((h) => h?.stop());
}

export type { CategoriaCanto };
export { identificarCanto };
