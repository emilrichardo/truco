"use client";
// Recorta silencios al principio y al final de un Blob de audio. La
// idea: decodificamos el audio (webm/opus o lo que el navegador haya
// grabado), barremos los samples buscando el primero/último que supera
// un umbral de amplitud, y reencodeamos como WAV PCM 16-bit mono.
//
// Mantenemos un padding de ~60ms en cada extremo para no cortar la
// consonante inicial / final. Si toda la grabación es silencio,
// devolvemos el blob original sin tocar.
//
// El WAV resultante es más pesado que el webm (no hay compresión),
// pero como ya recortamos los silencios, en la práctica entra en el
// límite del chat (150KB). Para 2s a 22050Hz mono 16-bit: ~88KB.

const UMBRAL_AMPLITUD = 0.018; // valores absolutos por sample (0..1)
const PADDING_SEG = 0.06; // 60ms a cada lado
const SAMPLE_RATE_OUT = 22050; // 22.05kHz: alcanza para voz, baja peso vs 48kHz

export async function recortarSilencios(blob: Blob): Promise<Blob> {
  if (typeof window === "undefined") return blob;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return blob;

  let ctx: AudioContext | null = null;
  try {
    const buf = await blob.arrayBuffer();
    ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const sr = decoded.sampleRate;
    // Mezclamos a mono para detectar silencio sobre 1 sola pista.
    const mono = mezclarAMono(decoded);
    const idxIni = primerNoSilencio(mono, UMBRAL_AMPLITUD);
    const idxFin = ultimoNoSilencio(mono, UMBRAL_AMPLITUD);
    if (idxIni < 0 || idxFin < 0 || idxFin <= idxIni) {
      // Todo silencio o muy bajo: dejamos el blob original (mejor algo
      // que nada — el usuario puede regrabar).
      return blob;
    }
    const padding = Math.round(sr * PADDING_SEG);
    const ini = Math.max(0, idxIni - padding);
    const fin = Math.min(mono.length, idxFin + padding);
    const recortado = mono.slice(ini, fin);
    // Gate suave: muteamos las regiones que estuvieron por debajo del
    // umbral durante > 80ms — limpia el "fondo de ambiente" entre las
    // sílabas sin masticar la voz. Se aplica con fade in/out de 12ms
    // para evitar clics audibles al activar/desactivar el gate.
    aplicarGate(recortado, sr, UMBRAL_AMPLITUD * 0.7, 0.08, 0.012);
    // Normalización suave: subimos el pico al 0.9 para que no quede
    // muy bajo después del gate. Capamos con un factor para no
    // amplificar el ruido si la grabación está muy callada.
    normalizar(recortado, 0.9, 4);
    // Resampleamos a 22050 si grabamos en algo más alto (típicamente 48kHz).
    const final =
      sr > SAMPLE_RATE_OUT
        ? resamplearLineal(recortado, sr, SAMPLE_RATE_OUT)
        : recortado;
    const srOut = sr > SAMPLE_RATE_OUT ? SAMPLE_RATE_OUT : sr;
    return floatAWavBlob(final, srOut);
  } catch {
    return blob;
  } finally {
    if (ctx) await ctx.close().catch(() => undefined);
  }
}

function mezclarAMono(buffer: AudioBuffer): Float32Array {
  const nch = buffer.numberOfChannels;
  if (nch === 1) return buffer.getChannelData(0).slice();
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < nch; c++) {
    const ch = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += ch[i];
  }
  for (let i = 0; i < len; i++) out[i] /= nch;
  return out;
}

function primerNoSilencio(data: Float32Array, umbral: number): number {
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > umbral) return i;
  }
  return -1;
}

function ultimoNoSilencio(data: Float32Array, umbral: number): number {
  for (let i = data.length - 1; i >= 0; i--) {
    if (Math.abs(data[i]) > umbral) return i;
  }
  return -1;
}

/** Noise gate suave. Identifica regiones donde la amplitud quedó por
 *  debajo del umbral durante > minSilencioSeg, y las baja a 0 con fade
 *  in/out para evitar pops. Limpia el "ambiente" entre sílabas sin
 *  romper la voz. Operación in-place sobre el Float32Array. */
function aplicarGate(
  data: Float32Array,
  sr: number,
  umbral: number,
  minSilencioSeg: number,
  fadeSeg: number
): void {
  const minSilencioSamples = Math.round(sr * minSilencioSeg);
  const fadeSamples = Math.max(1, Math.round(sr * fadeSeg));
  // Detectamos rachas de silencio: índices [inicio, fin] donde |x| < umbral
  // de forma consecutiva por al menos minSilencioSamples.
  let i = 0;
  while (i < data.length) {
    if (Math.abs(data[i]) < umbral) {
      let j = i;
      while (j < data.length && Math.abs(data[j]) < umbral) j++;
      const len = j - i;
      if (len >= minSilencioSamples) {
        // Muteamos el centro y aplicamos fade en los bordes.
        const fadeIni = Math.min(fadeSamples, Math.floor(len / 2));
        for (let k = 0; k < fadeIni; k++) {
          const t = k / fadeIni;
          data[i + k] *= 1 - t;
        }
        for (let k = i + fadeIni; k < j - fadeIni; k++) data[k] = 0;
        for (let k = 0; k < fadeIni; k++) {
          const t = k / fadeIni;
          data[j - fadeIni + k] *= t;
        }
      }
      i = j;
    } else {
      i++;
    }
  }
}

/** Normaliza al pico target sin amplificar más que `factorMax` veces.
 *  Evita que una grabación muy bajita levante demasiado el ruido. */
function normalizar(
  data: Float32Array,
  pico: number,
  factorMax: number
): void {
  let max = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > max) max = a;
  }
  if (max === 0) return;
  const factor = Math.min(pico / max, factorMax);
  if (factor === 1) return;
  for (let i = 0; i < data.length; i++) data[i] *= factor;
}

/** Resampleo linear simple (suficiente para voz). Si la calidad fuera
 *  crítica usaríamos un sinc filter, pero para el chat alcanza. */
function resamplearLineal(
  data: Float32Array,
  srIn: number,
  srOut: number
): Float32Array {
  if (srIn === srOut) return data;
  const ratio = srIn / srOut;
  const newLen = Math.round(data.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, data.length - 1);
    const t = srcIdx - i0;
    out[i] = data[i0] * (1 - t) + data[i1] * t;
  }
  return out;
}

/** Encode WAV PCM 16-bit mono. Header de 44 bytes + samples. */
function floatAWavBlob(data: Float32Array, sampleRate: number): Blob {
  const nch = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const byteRate = sampleRate * nch * bytesPerSample;
  const blockAlign = nch * bytesPerSample;
  const dataLen = data.length * bytesPerSample;
  const ab = new ArrayBuffer(44 + dataLen);
  const v = new DataView(ab);
  let off = 0;
  // RIFF header
  escribir(v, off, "RIFF");
  off += 4;
  v.setUint32(off, 36 + dataLen, true);
  off += 4;
  escribir(v, off, "WAVE");
  off += 4;
  // fmt chunk
  escribir(v, off, "fmt ");
  off += 4;
  v.setUint32(off, 16, true); // chunk size
  off += 4;
  v.setUint16(off, 1, true); // PCM
  off += 2;
  v.setUint16(off, nch, true);
  off += 2;
  v.setUint32(off, sampleRate, true);
  off += 4;
  v.setUint32(off, byteRate, true);
  off += 4;
  v.setUint16(off, blockAlign, true);
  off += 2;
  v.setUint16(off, bitsPerSample, true);
  off += 2;
  // data chunk
  escribir(v, off, "data");
  off += 4;
  v.setUint32(off, dataLen, true);
  off += 4;
  // PCM samples
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

function escribir(v: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
}
