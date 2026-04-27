"use client";
// Síntesis de voz para los cantos del truco usando Web Speech API.
// Asigna a cada jugador un timbre estable (voz + pitch + rate) basado en
// hash de su id, así "Hugui" siempre suena más grave que "Cholo", por ejemplo.
// Cuando un jugador tenga clips reales subidos en Storage, se usarán esos
// (ver lib/audio/sonidos.ts → reproducirCantoConClip).

const PRIORIDAD_LANG = ["es-AR", "es-MX", "es-CL", "es-CO", "es-VE", "es-US", "es-ES", "es"];

// Heurística inversa: rechazamos voces femeninas conocidas, aceptamos el
// resto. Web Speech no expone género como propiedad estándar.
const NOMBRES_FEMENINOS = [
  // macOS / iOS / Windows
  "paulina", "helena", "sabina", "monica", "mónica", "marisol", "ines",
  "inés", "laura", "elena", "maria", "maría", "lucia", "lucía", "sofia",
  "sofía", "mariana", "camila", "esperanza", "carmen", "isabel", "rosa",
  "lupe", "alejandra", "patricia", "dolores", "gabriela", "valentina",
  "natalia", "veronica", "verónica", "andrea", "marta", "raquel",
  "pilar", "rocio", "rocío", "soledad", "consuelo", "celia", "luciana",
  "hortensia", "elsa", "mia",
  // Google identifiers
  "es-us-news-f", "es-us-news-g", "es-us-standard-a", "es-es-standard-a",
  "es-mx-standard-a", "es-mx-news-a"
];

const NOMBRES_MASCULINOS = [
  "diego", "jorge", "juan", "carlos", "francisco", "pablo", "javier",
  "miguel", "ricardo", "luis", "andres", "fernando", "pedro", "raul",
  "roberto", "hector", "mario", "alberto", "enrique", "victor",
  "tomas", "tomás", "santiago", "felipe", "alejandro", "mateo"
];

function esVozFemenina(v: SpeechSynthesisVoice): boolean {
  const nombre = v.name.toLowerCase();
  if (/\bfemale\b|\bmujer\b|\bfemenina\b/.test(nombre)) return true;
  if (NOMBRES_FEMENINOS.some((n) => nombre.includes(n))) return true;
  // Convención Google TTS: variantes -A / -C / -E suelen ser femeninas.
  if (/standard-[ace]|wavenet-[ace]|news-[afg]/i.test(v.name)) return true;
  return false;
}

function esVozMasculina(v: SpeechSynthesisVoice): boolean {
  const nombre = v.name.toLowerCase();
  if (/\bmale\b|\bhombre\b|\bmasculin/.test(nombre)) return true;
  if (NOMBRES_MASCULINOS.some((n) => nombre.includes(n))) return true;
  if (/standard-[bdf]|wavenet-[bdf]|news-[c-eh-z]/i.test(v.name)) return true;
  return false;
}

let cacheVoces: SpeechSynthesisVoice[] | null = null;

function asegurarVocesCargadas(): SpeechSynthesisVoice[] {
  if (cacheVoces && cacheVoces.length) return cacheVoces;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  cacheVoces = window.speechSynthesis.getVoices();
  return cacheVoces;
}

// Chrome carga las voces async; lo dispara en el primer mount del hook.
export function precargarVoces() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const cargar = () => {
    cacheVoces = window.speechSynthesis.getVoices();
  };
  cargar();
  window.speechSynthesis.onvoiceschanged = cargar;
}

let primerDisparoHecho = false;
/** En iOS Safari, speak() requiere ocurrir durante un gesto del usuario.
 *  Esto dispara una utterance vacía en el primer click para "desbloquear". */
export function desbloquearVoz() {
  if (primerDisparoHecho) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    primerDisparoHecho = true;
  } catch {
    // ignorar
  }
}

let logueado = false;

interface VocesClasificadas {
  masculinas: SpeechSynthesisVoice[];
  neutras: SpeechSynthesisVoice[]; // ni claramente masculinas ni femeninas
  cualquiera: SpeechSynthesisVoice[]; // todas las españolas, último fallback
}

function clasificarVoces(): VocesClasificadas {
  const todas = asegurarVocesCargadas();
  if (todas.length === 0)
    return { masculinas: [], neutras: [], cualquiera: [] };
  const score = (v: SpeechSynthesisVoice) => {
    const i = PRIORIDAD_LANG.findIndex((p) =>
      v.lang.toLowerCase().startsWith(p.toLowerCase())
    );
    return i === -1 ? 99 : i;
  };
  const espanolas = todas
    .filter((v) => v.lang.toLowerCase().startsWith("es"))
    .sort((a, b) => score(a) - score(b));

  const masculinas = espanolas.filter(esVozMasculina);
  const neutras = espanolas.filter((v) => !esVozMasculina(v) && !esVozFemenina(v));

  if (!logueado && typeof console !== "undefined") {
    logueado = true;
    console.info(
      "[truco] voces es-* disponibles:",
      espanolas.map((v) => `${v.name} (${v.lang})`)
    );
    console.info(
      "[truco] masculinas detectadas:",
      masculinas.map((v) => v.name)
    );
    console.info("[truco] neutras (sin género claro):", neutras.map((v) => v.name));
  }

  return { masculinas, neutras, cualquiera: espanolas };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export interface PerfilVoz {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
}

export function perfilVozParaJugador(jugadorId: string): PerfilVoz {
  const { masculinas, neutras, cualquiera } = clasificarVoces();
  // Preferencia: voces masculinas → neutras → cualquiera.
  // Si tenemos que usar neutras o cualquiera, bajamos el pitch más fuerte
  // para enmascarar la "femineidad" de la voz subyacente.
  let pool: SpeechSynthesisVoice[];
  let pitchBase: [number, number]; // [min, span]
  if (masculinas.length > 0) {
    pool = masculinas;
    pitchBase = [0.78, 28]; // 0.78-1.06: rango masculino normal
  } else if (neutras.length > 0) {
    pool = neutras;
    pitchBase = [0.6, 22]; // 0.60-0.82: bajamos para masculinizar
  } else if (cualquiera.length > 0) {
    pool = cualquiera;
    pitchBase = [0.55, 18]; // 0.55-0.73: muy grave para tapar voces femeninas
  } else {
    return { voice: null, pitch: 1, rate: 1 };
  }
  const h = hashStr(jugadorId);
  const voice = pool[h % pool.length];
  const pitch = pitchBase[0] + ((h >> 3) % pitchBase[1]) / 100;
  const rate = 0.92 + ((h >> 7) % 22) / 100; // 0.92-1.14
  return { voice, pitch, rate };
}

interface OpcionesHablar {
  /** 0..1, multiplicador del rate base del personaje */
  intensidad?: number;
  /** Override de pitch absoluto (sino usa el del personaje) */
  pitchOverride?: number;
  /** Cancelar lo que se esté hablando ahora */
  interrumpir?: boolean;
}

/** Habla un texto con la voz/pitch/rate del jugador indicado. */
export function hablar(
  texto: string,
  jugadorId: string,
  opts: OpcionesHablar = {}
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const ss = window.speechSynthesis;
  if (opts.interrumpir) ss.cancel();

  const perfil = perfilVozParaJugador(jugadorId);
  if (!perfil.voice) {
    // Fallback: intentar igual; el browser elegirá una voz por defecto.
  }

  const ut = new SpeechSynthesisUtterance(texto);
  if (perfil.voice) ut.voice = perfil.voice;
  ut.lang = perfil.voice?.lang || "es-AR";
  ut.pitch = opts.pitchOverride ?? perfil.pitch;
  // Intensidad acelera/sube el rate para cantos más agresivos.
  const intensidad = opts.intensidad ?? 1;
  ut.rate = perfil.rate * intensidad;
  ut.volume = 1;
  ss.speak(ut);
}

/** Detiene cualquier voz en curso. */
export function silenciarVoz() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
