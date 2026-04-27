"use client";
// Efectos de sonido sintetizados con Web Audio API. Ventaja: no dependen
// de archivos externos, instantáneos, suenan distinto cada vez.

let _ctx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (_ctx) return _ctx;
  const AC = (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  if (!AC) return null;
  _ctx = new AC();
  return _ctx;
}

/** Sonido de carta deslizándose sobre la mesa: papel rozando el paño,
 *  suave, sin thump grave. Ruido filtrado con sweep descendente y envolvente
 *  larga (~180ms) que simula el barrido de la carta hasta detenerse. */
export function sonidoCarta() {
  const c = ctx();
  if (!c) return;
  // En iOS / Chrome a veces el contexto está suspendido hasta una
  // interacción del usuario; intentamos resumirlo de forma silenciosa.
  if (c.state === "suspended") c.resume().catch(() => {});

  const t0 = c.currentTime;
  const dur = 0.18;

  // Ruido base de papel: ruido blanco con pequeñas modulaciones para que
  // suene a "fricción de fibra" en vez de plano.
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // Ruido con leve "grano" de papel: white noise + low-rate flutter.
    const ph = i / c.sampleRate;
    const flutter = 0.85 + 0.15 * Math.sin(ph * 130 + Math.random() * 0.5);
    d[i] = (Math.random() * 2 - 1) * flutter;
  }
  const noise = c.createBufferSource();
  noise.buffer = buf;

  // Bandpass alto que enfatiza el "shhh" del papel y sweep descendente para
  // dar la sensación de que la carta arranca rápido y desacelera.
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(4200 + Math.random() * 600, t0);
  bp.frequency.exponentialRampToValueAtTime(1600, t0 + dur);

  // Highpass para sacar bajos: que no haya thump.
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 900;

  // Envolvente: ataque ~12ms, sostenido suave, salida exponencial.
  const g = c.createGain();
  const peak = 0.07 + Math.random() * 0.02;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(peak, t0 + 0.012);
  g.gain.linearRampToValueAtTime(peak * 0.55, t0 + 0.07);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

  noise.connect(bp).connect(hp).connect(g).connect(c.destination);
  noise.start(t0);
  noise.stop(t0 + dur + 0.02);
}

/** Tintineo corto para puntos / fósforos sumando. */
export function sonidoPuntos() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;
  const notas = [880, 1320];
  notas.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const g = c.createGain();
    const start = t0 + i * 0.06;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(0.16, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
    osc.connect(g).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.3);
  });
}

/** Sonido grave / sordo cuando el rival se va al mazo. */
export function sonidoMazo() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(220, t0);
  osc.frequency.exponentialRampToValueAtTime(60, t0 + 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.45);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.5);
}

/** Inicializa/desbloquea el AudioContext en una interacción del usuario. */
export function despertarAudio() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
}
