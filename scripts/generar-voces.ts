// Genera clips MP3 de cantos del truco con ElevenLabs.
//
// Estructura: por cada VOZ se generan TODOS los cantos con N variaciones.
//   public/audio/voces/<voz>/<canto>/<n>.mp3
// Así cada jugador tiene una voz consistente (asignada por hash del id)
// pero con varias maneras de decir cada cosa para que no aburra.
//
// Frases adaptadas al habla del Norte Argentino (NOA / gaucho):
// "che", "pué", "primito", "nomás", "ay", "carajo".
//
// Settings tuneados para "cantadito" santiagueño:
// stability bajísimo (0.15) + style alto (0.85) = expresivo, modulado.
//
// Uso:
//   ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts
//
// COSTO: ~1100 chars por corrida completa (5 voces × 10 cantos × 2 variantes).
// Free tier ElevenLabs = 10k chars/mes.

import fs from "node:fs";
import path from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error(
    "✗ Falta ELEVENLABS_API_KEY.\n" +
      "  ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts"
  );
  process.exit(1);
}

// Voces premade gratuitas. Cada una se va a usar para TODOS los cantos.
// Distintas por timbre para que jugadores distintos suenen distintos.
interface Voz {
  slug: string;
  id: string;
  nombre: string;
  // Override de pitch del modelo (de momento no aplica, ElevenLabs maneja
  // su propio rango). Se documenta para referencia futura.
}

const VOCES: Voz[] = [
  { slug: "antoni",  id: "ErXwobaYiN019PkySvjV", nombre: "Antoni"  }, // calmo
  { slug: "adam",    id: "pNInz6obpgDQGcFmaJgB", nombre: "Adam"    }, // grave
  { slug: "arnold",  id: "VR6AewLTigWG4xSOukaG", nombre: "Arnold"  }, // narrador
  { slug: "charlie", id: "IKne3meq5aSn9XLyUdCD", nombre: "Charlie" }, // grave
  { slug: "daniel",  id: "onwK4e9ZLuTAKqWW03F9", nombre: "Daniel"  }  // narrador
];

// Frases por canto. Para cada canto definimos N variaciones; cada voz
// genera TODAS las variaciones, así un mismo jugador puede decir "Truco!"
// con tono distinto cada vez sin cambiar de voz.
const CANTOS: Record<string, string[]> = {
  envido: ["¡Envido che!", "¡Envidoooo nomás!"],
  envido_envido: ["¡Envido envido!", "¡Otro envido pué!"],
  real_envido: ["¡Real envido!", "¡Real envido che!"],
  falta_envido: ["¡Falta envido!", "¡Falta envido nomás!"],
  truco: ["¡Truco che!", "¡Truco, primito!"],
  retruco: ["¡Quiero retruco!", "¡Retruquito che!"],
  vale_cuatro: ["¡Vale cuatro!", "¡Vale cuatro, primito!"],
  quiero: ["¡Quiero!", "¡Quiero pué, vamo!"],
  no_quiero: ["¡Ni en pedo!", "¡No quiero che, pué!"],
  ir_al_mazo: ["Me voy al mazo, che.", "Mazo nomás, primito."]
};

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

// Settings extremos para máxima expresividad / modulación tipo cantadito:
// - stability 0.15: deja que la voz module fuerte (sing-songy)
// - style 0.85: empuje emocional alto
const VOICE_SETTINGS: VoiceSettings = {
  stability: 0.15,
  similarity_boost: 0.7,
  style: 0.85,
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
  const baseDir = path.join(process.cwd(), "public", "audio", "voces");
  fs.mkdirSync(baseDir, { recursive: true });

  let generados = 0;
  let salteados = 0;
  let errores = 0;

  for (const voz of VOCES) {
    const dirVoz = path.join(baseDir, voz.slug);
    fs.mkdirSync(dirVoz, { recursive: true });

    for (const [canto, frases] of Object.entries(CANTOS)) {
      const dirCanto = path.join(dirVoz, canto);
      fs.mkdirSync(dirCanto, { recursive: true });

      for (let i = 0; i < frases.length; i++) {
        const frase = frases[i];
        const archivo = String(i + 1).padStart(2, "0") + ".mp3";
        const ruta = path.join(dirCanto, archivo);

        if (fs.existsSync(ruta)) {
          salteados++;
          continue;
        }

        console.log(
          `  → ${voz.slug}/${canto}/${archivo}: "${frase}"`
        );
        try {
          const audio = await generarTTS(frase, voz.id);
          fs.writeFileSync(ruta, audio);
          generados++;
        } catch (e) {
          console.error(
            `  ✗ ${voz.slug}/${canto}/${archivo}: ${e instanceof Error ? e.message : e}`
          );
          errores++;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  console.log("");
  console.log(
    `Listo. generados=${generados} salteados=${salteados} errores=${errores}`
  );
  console.log(`Archivos en: ${baseDir}`);
}

run().catch((e) => {
  console.error("✗ falla general:", e);
  process.exit(1);
});
