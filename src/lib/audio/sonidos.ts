"use client";
// Catálogo de sonidos del juego. Si hay clips de audio reales en
// /public/audio/<canto>/<n>.mp3 los carga con Howler. Si no existen
// (o fallan), cae a Web Speech con la voz personalizada por jugador.

import { Howl } from "howler";
import { silenciarVoz } from "./voz";

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

// Cache de Howls por canto. Cada canto puede tener varias variaciones
// (01.mp3, 02.mp3, 03.mp3, ...) — el sistema intenta cargar hasta MAX
// y al reproducir elige una al azar.
const MAX_VARIACIONES = 5;
const cacheHowlsCanto: Record<string, Howl[]> = {};
const cacheHowlsLoaded: Record<string, boolean> = {};

/** Carga las variaciones existentes de un canto. Idempotente. */
function cargarHowls(canto: CategoriaCanto): Howl[] {
  if (cacheHowlsLoaded[canto]) return cacheHowlsCanto[canto] || [];
  cacheHowlsLoaded[canto] = true;
  const howls: Howl[] = [];
  for (let i = 1; i <= MAX_VARIACIONES; i++) {
    const n = String(i).padStart(2, "0");
    const src = `/audio/${canto}/${n}.mp3`;
    const h = new Howl({
      src: [src],
      volume: 0.95,
      preload: true,
      onloaderror: () => {
        // Si falla, lo removemos del array.
        const idx = cacheHowlsCanto[canto]?.indexOf(h);
        if (idx !== undefined && idx >= 0) cacheHowlsCanto[canto].splice(idx, 1);
      }
    });
    howls.push(h);
  }
  cacheHowlsCanto[canto] = howls;
  return howls;
}

interface OpcionesCanto {
  jugadorId: string;
  texto?: string;
  intensidad?: number;
}

/** Reproduce un canto eligiendo una variación al azar entre los clips
 * cargados. Si ninguno cargó (no hay archivos), queda silencioso y el
 * banner visual de UltimoCanto cumple la función. */
export function reproducirCanto(canto: CategoriaCanto, _opts: OpcionesCanto) {
  const howls = cargarHowls(canto);
  // Filtramos las que efectivamente cargaron (state="loaded")
  const listas = howls.filter((h) => h.state() === "loaded");
  if (listas.length === 0) {
    // Aún no hay ninguna lista — intentamos con la primera por si está
    // en proceso; play() esperará a onload.
    if (howls.length > 0) {
      try {
        howls[0].play();
      } catch {
        /* silencio */
      }
    }
    return;
  }
  const elegida = listas[Math.floor(Math.random() * listas.length)];
  try {
    elegida.stop();
    elegida.play();
  } catch {
    /* silencio */
  }
}

// Reacciones: se mantienen como no-ops por ahora. Cuando haya clips reales
// en /audio/laugh/, /audio/angry/, etc., se cablean acá.
export function reaccionGanaMano(_jugadorId: string) { /* TODO: clip de risa */ }
export function reaccionPierdeMano(_jugadorId: string) { /* TODO: clip de queja */ }
export function reaccionGanaPartida(_jugadorId: string) { /* TODO: clip celebración */ }
export function reaccionPierdePartida(_jugadorId: string) { /* TODO: clip derrota */ }

export function silenciarTodo() {
  silenciarVoz();
  Object.values(cacheHowlsCanto).forEach((howls) =>
    howls.forEach((h) => h.stop())
  );
}

export type { CategoriaCanto };
export { identificarCanto };
