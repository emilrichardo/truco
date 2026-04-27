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

/** Sonido de carta seca cayendo en mesa de madera: tac corto, sin sustain.
 *  Único modelo: ruido percusivo filtrado por una banda media (la mesa
 *  responde brevemente) + microbody muy decaído. Total ~35ms. */
export function sonidoCarta() {
  const c = ctx();
  if (!c) return;
  // En iOS / Chrome a veces el contexto está suspendido hasta una
  // interacción del usuario; intentamos resumirlo de forma silenciosa.
  if (c.state === "suspended") c.resume().catch(() => {});

  const t0 = c.currentTime;

  // 1) Tac percusivo: ruido blanco muy corto (~6ms) filtrado por una banda
  //    media (~700-1500Hz, el "thud" seco de la madera al recibir el papel).
  //    Decay exponencial agresivo para que no resuene.
  const noiseLen = Math.floor(c.sampleRate * 0.022);
  const noiseBuf = c.createBuffer(1, noiseLen, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) {
    // Decay exponencial fuerte: el grueso del energía cae en los primeros 5ms.
    const env = Math.exp(-i / (c.sampleRate * 0.005));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const noise = c.createBufferSource();
  noise.buffer = noiseBuf;

  // Bandpass medio: la madera filtra los agudos del impacto, pasa "tac" seco.
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900 + Math.random() * 400;
  bp.Q.value = 1.4;

  // Lowpass adicional para sacar el "shhhh" alto del ruido y dejar sólo
  // la parte gruesa del impacto.
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;

  const gN = c.createGain();
  gN.gain.value = 0.18;
  noise.connect(bp).connect(lp).connect(gN).connect(c.destination);
  noise.start(t0);

  // 2) Microbody: sine grave a ~180Hz, decay ULTRA rápido (~22ms) para
  //    insinuar la masa de la carta sin agregar tono sostenido.
  const body = c.createOscillator();
  body.type = "sine";
  body.frequency.value = 170 + Math.random() * 30;
  const gB = c.createGain();
  gB.gain.setValueAtTime(0.0001, t0);
  gB.gain.exponentialRampToValueAtTime(0.09, t0 + 0.003);
  gB.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.025);
  body.connect(gB).connect(c.destination);
  body.start(t0);
  body.stop(t0 + 0.04);
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
