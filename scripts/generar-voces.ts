// Genera clips MP3 de cantos del truco con ElevenLabs.
// Apuntando a un sonido santiagueño masculino: frases con giros del NOA
// (Santiago del Estero) y voice_settings que dan un "cantadito" expresivo.
//
// Uso:
//   ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts
//
// El script es idempotente: si el clip ya existe en disco, lo saltea.
// Para regenerar uno, borralo (rm public/audio/envido/01.mp3) y volvé a correr.
//
// COSTO: tier gratis ElevenLabs = 10.000 chars/mes. Una corrida completa
// usa ~700 chars. Tenés más que suficiente.
//
// PARA UN ACENTO MÁS FIEL A SANTIAGO DEL ESTERO:
// 1. Andá a https://elevenlabs.io/app/voice-library
// 2. Buscá "argentino", "argentina", "noa", "criollo"
// 3. Agregá las voces a tu cuenta (botón "+" en cada una)
// 4. Copiá los voice IDs y pegalos abajo en VOCES, reemplazando los actuales
// 5. Borrá la carpeta public/audio/ y volvé a correr el script

import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error(
    "✗ Falta ELEVENLABS_API_KEY. Setealo así:\n" +
      "  ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts\n" +
      "Conseguí una clave gratis en https://elevenlabs.io/app/settings/api-keys"
  );
  process.exit(1);
}

// Voces premade gratuitas (no library voices) del catálogo de ElevenLabs.
// Si querés un acento más fiel a Santiago del Estero, agregá voces de
// https://elevenlabs.io/app/voice-library filtradas por argentino +
// masculino y reemplazá los IDs (requiere plan pago).
const VOCES = [
  { id: "ErXwobaYiN019PkySvjV", nombre: "Antoni" },     // calmo, cálido
  { id: "pNInz6obpgDQGcFmaJgB", nombre: "Adam" },       // grave, serio
  { id: "VR6AewLTigWG4xSOukaG", nombre: "Arnold" },     // crisp, narrador
  { id: "IKne3meq5aSn9XLyUdCD", nombre: "Charlie" },    // grave
  { id: "onwK4e9ZLuTAKqWW03F9", nombre: "Daniel" }      // narrador
];

// Frases con vocabulario santiagueño masculino: "che", "pue", "primito",
// "opa", "mirá che", "ay carajo". Cada variación tiene su voz asignada
// para que la misma frase suene siempre igual.
interface Variacion {
  frase: string;
  voz: number; // índice en VOCES
}

const CANTOS: Record<string, Variacion[]> = {
  envido: [
    { frase: "¡Envido che!", voz: 0 },
    { frase: "¡Te canto envido, primito!", voz: 1 },
    { frase: "¡Envido, pue!", voz: 2 }
  ],
  envido_envido: [
    { frase: "¡Envido envido che!", voz: 0 },
    { frase: "¡Otro envido, vamo!", voz: 1 }
  ],
  real_envido: [
    { frase: "¡Real envido!", voz: 1 },
    { frase: "¡Real envido, ay!", voz: 0 },
    { frase: "¡Te subo a real, pue!", voz: 3 }
  ],
  falta_envido: [
    { frase: "¡Falta envido!", voz: 1 },
    { frase: "¡Falta envidoooo!", voz: 0 },
    { frase: "¡Falta envido, primo!", voz: 2 }
  ],
  truco: [
    { frase: "¡Truco!", voz: 0 },
    { frase: "¡Trucooo, che!", voz: 1 },
    { frase: "¡Truco, primito!", voz: 2 },
    { frase: "¡Te canto el truco, pue!", voz: 3 }
  ],
  retruco: [
    { frase: "¡Quiero retruco!", voz: 1 },
    { frase: "¡Retruco, ay!", voz: 0 },
    { frase: "¡Retruquito che!", voz: 2 }
  ],
  vale_cuatro: [
    { frase: "¡Vale cuatro!", voz: 1 },
    { frase: "¡Vale cuatrooo, primo!", voz: 0 },
    { frase: "¡Vale 4, pue!", voz: 3 }
  ],
  quiero: [
    { frase: "¡Quiero!", voz: 0 },
    { frase: "¡Quiero, dale!", voz: 2 },
    { frase: "¡Acá estamos, che!", voz: 4 },
    { frase: "¡Quiero pue, vamo!", voz: 1 }
  ],
  no_quiero: [
    { frase: "¡No quiero!", voz: 0 },
    { frase: "¡Ni en pedo!", voz: 2 },
    { frase: "¡No, pue!", voz: 1 },
    { frase: "¡Ni ahí, primito!", voz: 3 },
    { frase: "¡Para qué, che!", voz: 4 }
  ],
  ir_al_mazo: [
    { frase: "Me voy al mazo, che.", voz: 0 },
    { frase: "Mazo, pue.", voz: 1 },
    { frase: "Al mazo, primito.", voz: 2 }
  ]
};

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

// Settings tuneados para "cantadito" santiagueño:
// - stability bajo: deja que la voz module más, tipo canto popular
// - style alto: empuje emocional / expresivo
// - similarity_boost 0.7: respeta el timbre original sin clonarlo de más
const VOICE_SETTINGS: VoiceSettings = {
  stability: 0.3,
  similarity_boost: 0.7,
  style: 0.65,
  use_speaker_boost: true
};

async function generarTTS(text: string, voiceId: string): Promise<Buffer> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY!,
      "content-type": "application/json",
      accept: "audio/mpeg"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: VOICE_SETTINGS
    })
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function run() {
  const baseDir = path.join(process.cwd(), "public", "audio");
  fs.mkdirSync(baseDir, { recursive: true });

  let generados = 0;
  let salteados = 0;
  let errores = 0;

  for (const [canto, variaciones] of Object.entries(CANTOS)) {
    const dir = path.join(baseDir, canto);
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < variaciones.length; i++) {
      const { frase, voz: idxVoz } = variaciones[i];
      const voz = VOCES[idxVoz];
      const archivo = String(i + 1).padStart(2, "0") + ".mp3";
      const ruta = path.join(dir, archivo);

      if (fs.existsSync(ruta)) {
        console.log(`  ✓ ${canto}/${archivo} ya existe (${voz.nombre})`);
        salteados++;
        continue;
      }

      console.log(`  → ${canto}/${archivo} con ${voz.nombre}: "${frase}"`);
      try {
        const audio = await generarTTS(frase, voz.id);
        fs.writeFileSync(ruta, audio);
        generados++;
      } catch (e) {
        console.error(`  ✗ error: ${e instanceof Error ? e.message : e}`);
        errores++;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log("");
  console.log(`Listo. generados=${generados} salteados=${salteados} errores=${errores}`);
  console.log(`Archivos en: ${baseDir}`);
  if (generados > 0) {
    console.log("");
    console.log("Pasos siguientes:");
    console.log("  1. git add public/audio");
    console.log("  2. git commit -m 'feat: clips de voz santiagueña generados'");
    console.log("  3. git push");
    console.log("");
    console.log("Si el acento no convence, leé el header del script:");
    console.log("  → reemplazar VOCES con voice IDs de la Voice Library");
    console.log("    de ElevenLabs filtradas por 'argentino'.");
  }
}

run().catch((e) => {
  console.error("✗ falla general:", e);
  process.exit(1);
});
