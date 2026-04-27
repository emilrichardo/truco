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

/** Sonido de carta golpeando la mesa: noise burst + thump grave. */
export function sonidoCarta() {
  const c = ctx();
  if (!c) return;
  // En iOS / Chrome a veces el contexto está suspendido hasta una
  // interacción del usuario; intentamos resumirlo de forma silenciosa.
  if (c.state === "suspended") c.resume().catch(() => {});

  const t0 = c.currentTime;

  // 1) Click / palmazo: ruido blanco filtrado, 50ms con decay rápido.
  const noiseLen = Math.floor(c.sampleRate * 0.06);
  const noiseBuf = c.createBuffer(1, noiseLen, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (noiseLen * 0.18));
  }
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;

  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 2200 + Math.random() * 600;
  filt.Q.value = 0.6;

  const gN = c.createGain();
  gN.gain.value = 0.22 + Math.random() * 0.05;
  noise.connect(filt).connect(gN).connect(c.destination);
  noise.start(t0);

  // 2) Thump grave: oscilador sinusoidal con sweep descendente.
  const osc = c.createOscillator();
  osc.type = "sine";
  const f0 = 110 + Math.random() * 30;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.12);

  const gO = c.createGain();
  gO.gain.setValueAtTime(0.0001, t0);
  gO.gain.exponentialRampToValueAtTime(0.45, t0 + 0.005);
  gO.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);

  osc.connect(gO).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.22);
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
