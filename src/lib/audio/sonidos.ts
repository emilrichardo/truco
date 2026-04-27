"use client";
// Catálogo de sonidos del juego.
// Estructura: /public/audio/voces/<voz>/<canto>/<n>.mp3
// Cada jugador queda asignado por hash a una de las voces, así Cholo siempre
// suena distinto a Hugui aunque digan el mismo canto. Dentro de la voz hay
// 2-3 variaciones del canto que se eligen al azar para no repetir.

import { Howl } from "howler";
import { silenciarVoz } from "./voz";

type CategoriaCanto =
  | "envido"
  | "envido_envido"
  | "real_envido"
  | "falta_envido"
  | "truco"
  | "retruco"
  | "vale_cuatro"
  | "quiero"
  | "no_quiero"
  | "ir_al_mazo";

const VOCES = ["antoni", "adam", "arnold", "charlie", "daniel"] as const;
type Voz = typeof VOCES[number];
const MAX_VARIACIONES = 5;

// Cache: cacheHowls[voz][canto] = Howl[] con las variaciones cargadas.
const cacheHowls: Record<string, Record<string, Howl[]>> = {};
const cacheLoaded: Record<string, Record<string, boolean>> = {};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function vozParaJugador(jugadorId: string): Voz {
  return VOCES[hashStr(jugadorId) % VOCES.length];
}

/** Carga las variaciones del canto para una voz dada. Idempotente. */
function cargarHowlsVoz(voz: Voz, canto: CategoriaCanto): Howl[] {
  cacheHowls[voz] = cacheHowls[voz] || {};
  cacheLoaded[voz] = cacheLoaded[voz] || {};
  if (cacheLoaded[voz][canto]) return cacheHowls[voz][canto] || [];
  cacheLoaded[voz][canto] = true;

  const howls: Howl[] = [];
  for (let i = 1; i <= MAX_VARIACIONES; i++) {
    const n = String(i).padStart(2, "0");
    const src = `/audio/voces/${voz}/${canto}/${n}.mp3`;
    const h = new Howl({
      src: [src],
      volume: 0.95,
      preload: true,
      onloaderror: () => {
        const arr = cacheHowls[voz][canto];
        if (arr) {
          const idx = arr.indexOf(h);
          if (idx >= 0) arr.splice(idx, 1);
        }
      }
    });
    howls.push(h);
  }
  cacheHowls[voz][canto] = howls;
  return howls;
}

// Map de identificación: detecta el canto a partir del texto del evento.
function identificarCanto(texto: string): CategoriaCanto | null {
  const t = texto.toLowerCase();
  if (t.includes("falta envido")) return "falta_envido";
  if (t.includes("real envido")) return "real_envido";
  if (t.match(/envido.*envido/)) return "envido_envido";
  if (t.includes("envido")) return "envido";
  if (t.includes("vale cuatro") || t.includes("vale 4")) return "vale_cuatro";
  if (t.includes("retruco")) return "retruco";
  if (t.includes("truco")) return "truco";
  if (t.includes("quiero") && !t.includes("no")) return "quiero";
  if (t.includes("no quiero") || t.includes("no_quiero")) return "no_quiero";
  if (t.includes("mazo")) return "ir_al_mazo";
  return null;
}

interface OpcionesCanto {
  jugadorId: string;
  texto?: string;
  intensidad?: number;
}

/** Reproduce un canto con la voz asignada al jugador. Si no hay clips, mute. */
export function reproducirCanto(canto: CategoriaCanto, opts: OpcionesCanto) {
  const voz = vozParaJugador(opts.jugadorId);
  const howls = cargarHowlsVoz(voz, canto);
  const listas = howls.filter((h) => h.state() === "loaded");
  if (listas.length === 0) {
    // Aún cargando: probamos la primera (Howler espera al onload).
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

// Reacciones futuras (cuando haya clips): por ahora no-ops.
export function reaccionGanaMano(_jugadorId: string) { /* TODO clip risa */ }
export function reaccionPierdeMano(_jugadorId: string) { /* TODO clip queja */ }
export function reaccionGanaPartida(_jugadorId: string) { /* TODO clip celebra */ }
export function reaccionPierdePartida(_jugadorId: string) { /* TODO clip derrota */ }

export function silenciarTodo() {
  silenciarVoz();
  for (const voz in cacheHowls) {
    for (const canto in cacheHowls[voz]) {
      cacheHowls[voz][canto].forEach((h) => h.stop());
    }
  }
}

export type { CategoriaCanto };
export { identificarCanto };
