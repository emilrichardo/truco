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
  | "son_mejores";

// Voces disponibles: argentinas (locale=es-AR) generadas via ElevenLabs.
// La asignación es por PERSONAJE (slug del primo) — así "Lucas" suena
// siempre con la misma voz, partida tras partida y aún después de un
// shuffle de asientos (revancha o "sortear compañeros"). Antes la voz
// se ataba al asiento, lo que hacía que el mismo primo cambiara de voz
// si se movía de silla.
//
// Trade-off: con 11 personajes y 4 voces puede haber colisión dentro
// de una misma partida (dos primos con la misma voz). Es preferible a
// que un mismo primo cambie de voz a media sesión.
const VOCES = ["lalo", "juan", "manuel", "agustin"] as const;
type Voz = (typeof VOCES)[number];

function totalVariantes(canto: CategoriaCanto): number {
  return FRASES[canto]?.length ?? 1;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Mapa jugadorId → personaje slug. Se mantiene al día en useAudioJuego.
// Sirve para asignar la voz por PERSONAJE en lugar de por id (que cambia
// entre sesiones) o asiento (que cambia entre partidas tras shuffle).
const personajePorJugador = new Map<string, string>();

export function setAsientosJugadores(
  jugadores: { id: string; asiento: number; personaje?: string }[]
) {
  personajePorJugador.clear();
  for (const j of jugadores) {
    if (j.personaje) personajePorJugador.set(j.id, j.personaje);
  }
}

function vozDeJugador(jugadorId: string): Voz {
  const personaje = personajePorJugador.get(jugadorId);
  if (personaje) return VOCES[hashStr(personaje) % VOCES.length];
  // Fallback al hash del id si todavía no se cargó el personaje
  // (no debería pasar en partida normal).
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

/** Encola un dataUrl (audio personalizado del jugador) en la misma
 *  cola FIFO que los cantos. Sin esto, el audio personal se reproducía
 *  directo (new Audio) y se superponía con la voz default del siguiente
 *  canto cuando ambos llegaban en ráfaga. */
export function encolarDataUrl(dataUrl: string) {
  encolar(() => {
    if (muteado) {
      avanzar();
      return;
    }
    if (typeof Audio === "undefined") {
      avanzar();
      return;
    }
    let avancado = false;
    const seguirCola = () => {
      if (avancado) return;
      avancado = true;
      avanzar();
    };
    try {
      const audio = new Audio(dataUrl);
      audio.volume = 0.95;
      audio.onended = seguirCola;
      audio.onerror = seguirCola;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(seguirCola);
    } catch {
      seguirCola();
    }
  });
}

function reproducirArchivo(src: string) {
  // Precargamos el clip apenas se encola — así para cuando le toque el
  // turno en la cola FIFO, el <audio> ya está cargado y arranca instantáneo.
  // Antes el primer play de cada clip tenía latencia de red+decode y se
  // notaba especialmente en la cadena Quiero → Tengo X → Tengo Y del envido.
  const precarga = cargarHowl(src);
  if (precarga.state() === "unloaded") precarga.load();
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
      : 1 + Math.floor(Math.random() * totalVariantes(canto));
  const archivo = String(idx).padStart(2, "0") + ".mp3";
  const src = `/audio/voces/${voz}/${canto}/${archivo}`;
  console.debug("[truco] canto", { canto, voz, src, jugadorId: opts.jugadorId });
  reproducirArchivo(src);
}

/** Reproduce una reacción (gane_mano / perdio_mano / etc.) en paralelo —
 *  bypassa la cola FIFO de cantos.
 *
 *  Timing: cada reacción se agenda con un delay incremental sobre la
 *  anterior (~500ms entre cada arranque). Si llegan 4 reacciones juntas
 *  al cierre de una mano 2v2, suenan en cadena: una arranca, ~500ms
 *  después la siguiente (que se solapa con la primera todavía sonando),
 *  etc. Así se siente como una mesa real conversando, no como un coro
 *  unisono. Después de un período de silencio (>1.5s sin reacciones),
 *  se resetea el contador y la próxima reacción arranca de inmediato. */
// Bumpeado a 800ms para que reacciones cortas (~0.8-1s cada una) no se
// solapen casi nada. Se siente como conversación de mesa con turnos.
const ESPACIADO_REACCIONES_MS = 800;
const RESETEO_REACCIONES_MS = 2500;
let proximaReaccionT = 0;

export function reproducirReaccion(
  canto: CategoriaCanto,
  opts: OpcionesCanto & { variante?: number }
) {
  if (muteado) return;
  const voz = vozDeJugador(opts.jugadorId);
  const idx =
    opts.variante && opts.variante >= 1
      ? opts.variante
      : 1 + Math.floor(Math.random() * totalVariantes(canto));
  const archivo = String(idx).padStart(2, "0") + ".mp3";
  const src = `/audio/voces/${voz}/${canto}/${archivo}`;

  const ahora = Date.now();
  // Si pasaron >1.5s desde la última reacción, arrancamos de cero — ya
  // pasó el "ráfaga" y la próxima cadena empieza fresca.
  if (ahora - proximaReaccionT > RESETEO_REACCIONES_MS) {
    proximaReaccionT = ahora;
  }
  const arrancarA = Math.max(ahora, proximaReaccionT);
  // Pequeño jitter (±100ms) para que no sean exactos.
  const jitter = Math.floor(Math.random() * 200) - 100;
  const delay = Math.max(0, arrancarA - ahora + jitter);
  proximaReaccionT = arrancarA + ESPACIADO_REACCIONES_MS;

  setTimeout(() => {
    if (muteado) return;
    const h = cargarHowl(src);
    h.play();
  }, delay);
}

// Antes había una lista de reacciones (gane_mano / perdio_mano / etc.) que
// se reproducían en paralelo al cierre de cada mano. Las saqué — ensuciaban
// la mesa con un coro de voces simultáneas. Si vuelven, este helper se
// puede ampliar.
export function esReaccion(_canto: CategoriaCanto): boolean {
  return false;
}

/** Canta el "tanto" (puntaje del envido) con la voz del jugador.
 *  Hay clips para 0-7 y 20-33; los del rango 8-19 no se generaron y
 *  rebotan en 404. Para no romper el orden de la cola (y que después
 *  no suene "Las tuyas son buenas" antes que la declaración), para
 *  ese rango caemos en el TTS del navegador como sustituto. */
export function reproducirPuntosEnvido(jugadorId: string, puntos: number) {
  const voz = vozDeJugador(jugadorId);
  if (puntos >= 8 && puntos <= 19) {
    encolarTTS(`Tengo ${puntos}.`);
    return;
  }
  const archivo = String(puntos).padStart(2, "0") + ".mp3";
  reproducirArchivo(`/audio/voces/${voz}/envido_puntos/${archivo}`);
}

/** Encola un texto vía Web Speech API en el mismo FIFO que los cantos.
 *  Si el navegador no soporta TTS o el speak falla, esperamos 900ms
 *  como pausa equivalente para no atropellar el siguiente clip. */
function encolarTTS(texto: string) {
  encolar(() => {
    if (muteado) {
      avanzar();
      return;
    }
    let avancado = false;
    const seguir = () => {
      if (avancado) return;
      avancado = true;
      avanzar();
    };
    const fallback = window.setTimeout(seguir, 1400);
    const tieneTTS =
      typeof window !== "undefined" && "speechSynthesis" in window;
    if (!tieneTTS) {
      // Mantenemos el timeout — seguir() ya está armado.
      return;
    }
    try {
      const utt = new SpeechSynthesisUtterance(texto);
      utt.lang = "es-AR";
      utt.rate = 1.05;
      utt.pitch = 1;
      utt.volume = 0.95;
      utt.onend = () => {
        window.clearTimeout(fallback);
        seguir();
      };
      utt.onerror = () => {
        window.clearTimeout(fallback);
        seguir();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    } catch {
      window.clearTimeout(fallback);
      seguir();
    }
  });
}

/** Detecta una declaración de tanto en un texto del chat. El motor emite
 *  "Tengo 33." cuando alguien declara su tanto del envido — esta función
 *  parsea el número para mapearlo al clip envido_puntos/<NN>.mp3. */
export function identificarTanto(texto: string): number | null {
  const m = texto.match(/^\s*Tengo\s+(\d+)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 0 && n <= 33) return n;
  return null;
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

/** Precarga TODOS los clips de las voces que efectivamente van a jugar
 *  esta partida. La cantidad por categoría sale de FRASES (cada frase
 *  tiene su clip), así no pedimos archivos que no existen. */
export function precargarVoces(jugadorIds: string[]) {
  if (typeof window === "undefined") return;
  const vocesUsadas = new Set(jugadorIds.map(vozDeJugador));
  const cantos: CategoriaCanto[] = [
    "envido", "envido_envido", "real_envido", "falta_envido",
    "truco", "retruco", "vale_cuatro",
    "quiero", "no_quiero", "ir_al_mazo",
    "son_buenas", "son_mejores"
  ];
  for (const voz of vocesUsadas) {
    for (const canto of cantos) {
      const total = FRASES[canto]?.length ?? 0;
      for (let i = 1; i <= total; i++) {
        const url = `/audio/voces/${voz}/${canto}/${String(i).padStart(2, "0")}.mp3`;
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
