"use client";
// Síntesis de voz para los cantos del truco usando Web Speech API.
// Asigna a cada jugador un timbre estable (voz + pitch + rate) basado en
// hash de su id, así "Hugui" siempre suena más grave que "Cholo", por ejemplo.
// Cuando un jugador tenga clips reales subidos en Storage, se usarán esos
// (ver lib/audio/sonidos.ts → reproducirCantoConClip).

const PRIORIDAD_LANG = ["es-AR", "es-MX", "es-CL", "es-CO", "es-VE", "es-US", "es-ES", "es"];

// Heurística para filtrar a voces masculinas. Web Speech no expone género
// como propiedad estándar, así que detectamos por nombre.
const NOMBRES_MASCULINOS = [
  // macOS / iOS
  "diego", "jorge", "juan", "carlos", "francisco", "pablo", "javier",
  "miguel", "ricardo", "luis", "andres", "fernando", "pedro", "raul",
  "roberto", "hector", "mario", "alberto", "enrique", "victor",
  // Windows / Microsoft
  "pablo", "raul", "jorge",
  // Google
  "es-us-standard-b", "es-es-standard-b", "es-mx-standard-b"
];

const NOMBRES_FEMENINOS = [
  "paulina", "helena", "sabina", "monica", "marisol", "ines", "laura",
  "elena", "maria", "lucia", "sofia", "mariana", "camila", "esperanza",
  "carmen", "isabel", "rosa", "lupe", "alejandra", "patricia", "dolores",
  "gabriela", "valentina", "ana", "eva", "natalia", "veronica", "andrea",
  "marta", "raquel"
];

function esVozMasculina(v: SpeechSynthesisVoice): boolean {
  const nombre = v.name.toLowerCase();
  // Rechazo explícito por keywords claros
  if (/\bfemale\b|\bmujer\b|\bfemenina\b/.test(nombre)) return false;
  if (NOMBRES_FEMENINOS.some((n) => nombre.includes(n))) return false;
  // Aceptación explícita
  if (/\bmale\b|\bhombre\b|\bmasculin/.test(nombre)) return true;
  if (NOMBRES_MASCULINOS.some((n) => nombre.includes(n))) return true;
  // Convención Google TTS: Standard-B y Wavenet-B suelen ser masculinas;
  // Standard-A / Wavenet-A femeninas.
  if (/standard-[bdf]|wavenet-[bdf]/i.test(v.name)) return true;
  if (/standard-[ace]|wavenet-[ace]/i.test(v.name)) return false;
  // Por defecto: descartar (preferimos quedarnos sin voz que con una voz
  // femenina si no podemos decidir).
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

function vocesEspanolas(): SpeechSynthesisVoice[] {
  const todas = asegurarVocesCargadas();
  if (todas.length === 0) return [];
  const score = (v: SpeechSynthesisVoice) => {
    const i = PRIORIDAD_LANG.findIndex((p) => v.lang.toLowerCase().startsWith(p.toLowerCase()));
    return i === -1 ? 99 : i;
  };
  const espanolas = todas
    .filter((v) => v.lang.toLowerCase().startsWith("es"))
    .sort((a, b) => score(a) - score(b));

  // Preferimos masculinas. Si en el sistema no hay ninguna identificable
  // como masculina, devolvemos todas (mejor que ninguna).
  const masculinas = espanolas.filter(esVozMasculina);
  return masculinas.length > 0 ? masculinas : espanolas;
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
  const espanolas = vocesEspanolas();
  if (espanolas.length === 0) return { voice: null, pitch: 1, rate: 1 };
  const h = hashStr(jugadorId);
  const voice = espanolas[h % espanolas.length];
  // Pitch en rango masculino: 0.72-1.04. Rate 0.92-1.18 (igual).
  const pitch = 0.72 + ((h >> 3) % 32) / 100;
  const rate = 0.92 + ((h >> 7) % 26) / 100;
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
