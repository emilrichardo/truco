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

/** Sonido de carta apoyándose sobre madera: golpecito sutil, breve.
 *  Click corto de transitorio + cuerpo resonante (~280Hz) decayendo
 *  rápidamente, con un partial alto opcional que da el "tick". */
export function sonidoCarta() {
  const c = ctx();
  if (!c) return;
  // En iOS / Chrome a veces el contexto está suspendido hasta una
  // interacción del usuario; intentamos resumirlo de forma silenciosa.
  if (c.state === "suspended") c.resume().catch(() => {});

  const t0 = c.currentTime;

  // 1) Transitorio: ruido ultra-breve (4ms) bandpass para el "tick" del
  //    contacto carta-madera. Bajo volumen, sólo articulación.
  const tickLen = Math.floor(c.sampleRate * 0.004);
  const tickBuf = c.createBuffer(1, tickLen, c.sampleRate);
  const tickData = tickBuf.getChannelData(0);
  for (let i = 0; i < tickLen; i++) {
    tickData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (tickLen * 0.5));
  }
  const tick = c.createBufferSource();
  tick.buffer = tickBuf;
  const tickFilt = c.createBiquadFilter();
  tickFilt.type = "bandpass";
  tickFilt.frequency.value = 3800 + Math.random() * 600;
  tickFilt.Q.value = 1.2;
  const tickGain = c.createGain();
  tickGain.gain.value = 0.05;
  tick.connect(tickFilt).connect(tickGain).connect(c.destination);
  tick.start(t0);

  // 2) Cuerpo: sine en frecuencia de "madera" (~260-310Hz) con Q sutil,
  //    decay rápido. Esto da el "knock" de la carta apoyándose.
  const f0 = 260 + Math.random() * 50;
  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(f0 * 1.15, t0);
  body.frequency.exponentialRampToValueAtTime(f0, t0 + 0.04);

  const bodyGain = c.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t0);
  bodyGain.gain.exponentialRampToValueAtTime(0.13, t0 + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.075);

  body.connect(bodyGain).connect(c.destination);
  body.start(t0);
  body.stop(t0 + 0.09);

  // 3) Partial alto sutil: triangle ~1100Hz con decay muy corto, da el
  //    matiz "seco" de tablero hueco. Muy bajo volumen.
  const part = c.createOscillator();
  part.type = "triangle";
  part.frequency.value = 1050 + Math.random() * 120;
  const partGain = c.createGain();
  partGain.gain.setValueAtTime(0.0001, t0);
  partGain.gain.exponentialRampToValueAtTime(0.04, t0 + 0.003);
  partGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.05);
  part.connect(partGain).connect(c.destination);
  part.start(t0);
  part.stop(t0 + 0.06);
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
