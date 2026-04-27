"use client";
// Síntesis de voz para los cantos del truco usando Web Speech API.
// Asigna a cada jugador un timbre estable (voz + pitch + rate) basado en
// hash de su id, así "Hugui" siempre suena más grave que "Cholo", por ejemplo.
// Cuando un jugador tenga clips reales subidos en Storage, se usarán esos
// (ver lib/audio/sonidos.ts → reproducirCantoConClip).

const PRIORIDAD_LANG = ["es-AR", "es-MX", "es-CL", "es-CO", "es-VE", "es-US", "es-ES", "es"];

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
  // Ordenamos por prioridad de variante latinoamericana.
  const score = (v: SpeechSynthesisVoice) => {
    const i = PRIORIDAD_LANG.findIndex((p) => v.lang.toLowerCase().startsWith(p.toLowerCase()));
    return i === -1 ? 99 : i;
  };
  return todas
    .filter((v) => v.lang.toLowerCase().startsWith("es"))
    .sort((a, b) => score(a) - score(b));
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
  // Variación tonal por jugador para que se distingan: pitch 0.85-1.25, rate 0.92-1.18
  const pitch = 0.85 + ((h >> 3) % 40) / 100;
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
