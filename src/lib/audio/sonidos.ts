"use client";
// Reproducción de cantos del truco con clips MP3 generados con ElevenLabs.
//
// Estructura de archivos en /public:
//   /audio/voces/<voz>/<canto>/<NN>.mp3        (5 variantes: 01..05)
//   /audio/voces/<voz>/envido_puntos/<NN>.mp3  (00..07, 20..33)
//
// Asignación de voz: cada jugador recibe una voz estable basada en hash de
// su id, así "Lucas" suena siempre con la misma voz pero distinta a "Richi".
// Cola: los clips no se superponen — si llega un canto mientras suena el
// anterior, se encola y arranca cuando termina el primero.

import { Howl } from "howler";
import { FRASES } from "@/lib/truco/frases";

export type CategoriaCanto =
  | "envido"
  | "envido_envido"
  | "real_envido"
  | "falta_envido"
  | "truco"
  | "retruco"
  | "vale_cuatro"
  | "quiero"
  | "no_quiero"
  | "ir_al_mazo"
  | "son_buenas"
  | "son_mejores"
  | "gane_mano"
  | "perdio_mano"
  | "gane_partida"
  | "perdio_partida";

// Voces disponibles: argentinas (locale=es-AR) generadas via ElevenLabs.
// Cada jugador recibe una voz estable por hash(jugadorId) — Lucas siempre
// suena igual entre partidas, pero distinto a Richi.
const VOCES = ["lalo", "juan", "manuel", "agustin", "niraj"] as const;
type Voz = (typeof VOCES)[number];
const VARIANTES_POR_CANTO = 5;

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function vozDeJugador(jugadorId: string): Voz {
  return VOCES[hashStr(jugadorId) % VOCES.length];
}

interface OpcionesCanto {
  jugadorId: string;
}

// Cache de instancias Howl para no recrearlas cada reproducción.
const cacheHowl = new Map<string, Howl>();

function cargarHowl(src: string): Howl {
  let h = cacheHowl.get(src);
  if (h) return h;
  // html5: true → usa <audio> en vez del Web Audio API. No requiere
  // desbloquear AudioContext y soporta archivos largos sin bloquear el
  // audio bus. Para cantos del truco la latencia extra es imperceptible.
  h = new Howl({
    src: [src],
    preload: false,
    volume: 0.95,
    html5: true
  });
  cacheHowl.set(src, h);
  return h;
}

// Cola FIFO de clips para que no se pisen — un canto a la vez.
type Tarea = () => void;
const cola: Tarea[] = [];
let reproduciendo = false;
let muteado = false;

function avanzar() {
  if (cola.length === 0) {
    reproduciendo = false;
    return;
  }
  reproduciendo = true;
  const siguiente = cola.shift()!;
  siguiente();
}

function encolar(t: Tarea) {
  cola.push(t);
  if (!reproduciendo) avanzar();
}

function reproducirArchivo(src: string) {
  encolar(() => {
    if (muteado) {
      avanzar();
      return;
    }
    const h = cargarHowl(src);
    const onEnd = () => {
      h.off("end", onEnd);
      h.off("loaderror", onErr);
      h.off("playerror", onErr);
      avanzar();
    };
    const onErr = (_id: number, err: unknown) => {
      // Si falla, no traba la cola — y dejamos rastro en consola para
      // poder diagnosticar (404 / autoplay policy / archivo corrupto).
      console.warn("[truco] error reproduciendo voz", src, err);
      h.off("end", onEnd);
      h.off("loaderror", onErr);
      h.off("playerror", onErr);
      avanzar();
    };
    h.once("end", onEnd);
    h.once("loaderror", onErr);
    h.once("playerror", onErr);
    h.play();
  });
}

export function reproducirCanto(
  canto: CategoriaCanto,
  opts: OpcionesCanto & { variante?: number }
) {
  const voz = vozDeJugador(opts.jugadorId);
  // Si nos pasaron `variante` específica (porque el motor matcheó la frase
  // textual del chat con el array de FRASES), usamos esa. Si no, picamos
  // al azar — así igual funciona si el texto se modifica externamente.
  const idx =
    opts.variante && opts.variante >= 1
      ? opts.variante
      : 1 + Math.floor(Math.random() * VARIANTES_POR_CANTO);
  const archivo = String(idx).padStart(2, "0") + ".mp3";
  const src = `/audio/voces/${voz}/${canto}/${archivo}`;
  console.debug("[truco] canto", { canto, voz, src, jugadorId: opts.jugadorId });
  reproducirArchivo(src);
}

/** Reproduce una reacción (gane_mano / perdio_mano / etc.) en paralelo —
 *  bypassa la cola de cantos. Cuando termina una mano, varios jugadores
 *  reaccionan a la vez (ganador chicanea, perdedor putea, compañeros
 *  celebran o se enojan). El stagger random hace que no salten todas
 *  exactamente al mismo milisegundo — se siente como una mesa real. */
export function reproducirReaccion(
  canto: CategoriaCanto,
  opts: OpcionesCanto & { variante?: number }
) {
  if (muteado) return;
  const voz = vozDeJugador(opts.jugadorId);
  const idx =
    opts.variante && opts.variante >= 1
      ? opts.variante
      : 1 + Math.floor(Math.random() * VARIANTES_POR_CANTO);
  const archivo = String(idx).padStart(2, "0") + ".mp3";
  const src = `/audio/voces/${voz}/${canto}/${archivo}`;
  // Stagger 0..400ms para que las 2-4 reacciones simultáneas no salten
  // alineadas y se oigan como una conversación natural.
  const delay = Math.floor(Math.random() * 400);
  setTimeout(() => {
    if (muteado) return;
    const h = cargarHowl(src);
    h.play();
  }, delay);
}

const REACCIONES = new Set<CategoriaCanto>([
  "gane_mano",
  "perdio_mano",
  "gane_partida",
  "perdio_partida"
]);

export function esReaccion(canto: CategoriaCanto): boolean {
  return REACCIONES.has(canto);
}

/** Canta el "tanto" (puntaje del envido) con la voz del jugador. */
export function reproducirPuntosEnvido(jugadorId: string, puntos: number) {
  const voz = vozDeJugador(jugadorId);
  const archivo = String(puntos).padStart(2, "0") + ".mp3";
  reproducirArchivo(`/audio/voces/${voz}/envido_puntos/${archivo}`);
}

export interface CantoIdentificado {
  canto: CategoriaCanto;
  /** Índice 1..5 que matchea el archivo `0N.mp3` y la posición en
   *  `FRASES[canto]`. -1 si no pudimos resolver el variante exacto y
   *  caemos en pickeo random. */
  variante: number;
}

/** Detecta el canto a partir del texto del evento. Primero intenta match
 *  exacto contra las frases canónicas de `FRASES` para devolver el variante
 *  exacto que tocó el motor — así el clip de voz dice EXACTAMENTE lo que
 *  aparece en el chat. Si no matchea (texto modificado, frase nueva sin
 *  audio), cae a un match por palabra clave con variante = -1. */
export function identificarCanto(texto: string): CantoIdentificado | null {
  // 1) Match exacto contra FRASES canónicas. El motor emite
  //    `fraseAleatoria(cat)` que devuelve un string de FRASES[cat] tal cual.
  for (const cat in FRASES) {
    const arr = FRASES[cat as keyof typeof FRASES];
    const idx = arr.indexOf(texto);
    if (idx !== -1) {
      return { canto: cat as CategoriaCanto, variante: idx + 1 };
    }
  }

  // 2) Fallback por palabras clave — colapsa repeticiones para que
  //    "truuuco"/"envidoooo" matcheen sus categorías. Variante random.
  const t = texto.toLowerCase().replace(/(.)\1{2,}/g, "$1");
  let canto: CategoriaCanto | null = null;
  if (t.includes("son buena")) canto = "son_buenas";
  else if (t.includes("son mejor")) canto = "son_mejores";
  else if (t.includes("falta envido")) canto = "falta_envido";
  else if (t.includes("real envido")) canto = "real_envido";
  else if (/envido[^a-z]+envido/.test(t)) canto = "envido_envido";
  else if (t.includes("envido")) canto = "envido";
  else if (t.includes("vale cuatro") || t.includes("vale 4")) canto = "vale_cuatro";
  else if (t.includes("retruco")) canto = "retruco";
  else if (t.includes("truco")) canto = "truco";
  else if (t.includes("no quiero")) canto = "no_quiero";
  else if (t.includes("quiero")) canto = "quiero";
  else if (t.includes("mazo")) canto = "ir_al_mazo";
  if (!canto) return null;
  return { canto, variante: -1 };
}

/** Precarga clips críticos en el cache HTTP del browser para que la
 *  primera reproducción no tenga delay de red. Pasa los IDs de los
 *  jugadores en juego: precargamos sólo las voces que efectivamente
 *  van a sonar. */
export function precargarVoces(jugadorIds: string[]) {
  if (typeof window === "undefined") return;
  const vocesUsadas = new Set(jugadorIds.map(vozDeJugador));
  // Cantos más comunes — los menos comunes (envido_envido, son_buenas)
  // no los precargamos para no saturar los conexión slots del browser.
  const cantosComunes: CategoriaCanto[] = [
    "truco", "retruco", "vale_cuatro",
    "envido", "real_envido", "falta_envido",
    "quiero", "no_quiero", "ir_al_mazo",
    "gane_mano", "perdio_mano"
  ];
  for (const voz of vocesUsadas) {
    for (const canto of cantosComunes) {
      // Variantes 1..3 (las más probables de salir).
      for (let i = 1; i <= 3; i++) {
        const url = `/audio/voces/${voz}/${canto}/${String(i).padStart(2, "0")}.mp3`;
        // fetch warm cache; si falla, lazy-load lo cubre después.
        fetch(url, { cache: "force-cache" }).catch(() => {});
      }
    }
  }
}

export function precargarTodosLosClips() {
  /* compatibilidad — usar precargarVoces() con los jugadorIds */
}

export function silenciarTodo() {
  muteado = true;
  // Detener cualquier reproducción en curso y vaciar cola.
  cola.length = 0;
  cacheHowl.forEach((h) => h.stop());
}

export function activarSonido() {
  muteado = false;
}

/** Corta la reproducción actual y vacía la cola SIN mutear. Se usa cuando
 *  arranca una mano nueva para que las reacciones / cantos rezagados de
 *  la mano anterior no se monten con el nuevo reparto. */
export function cortarReproduccion() {
  cola.length = 0;
  cacheHowl.forEach((h) => h.stop());
  reproduciendo = false;
}

// Reacciones al cierre de mano / partida — sin clip propio por ahora.
export function reaccionGanaMano(_jugadorId: string) { /* sin clip */ }
export function reaccionPierdeMano(_jugadorId: string) { /* sin clip */ }
export function reaccionGanaPartida(_jugadorId: string) { /* sin clip */ }
export function reaccionPierdePartida(_jugadorId: string) { /* sin clip */ }
