// Genera clips MP3 de cantos del truco con ElevenLabs.
//
// Estructura: por cada VOZ se generan TODOS los cantos con N variaciones.
//   public/audio/voces/<voz>/<canto>/<n>.mp3
// Así cada jugador tiene una voz consistente (asignada por hash del id)
// pero con varias maneras de decir cada cosa para que no aburra.
//
// Frases adaptadas al habla del Norte Argentino (NOA / gaucho).
// Cada canto tiene 5 niveles de intensidad para que la IA module según
// confianza/bluff:
//   1) tranquilo / callandito
//   2) confiado / nomás
//   3) desafiante / che
//   4) fuerte / primito
//   5) a todo pulmón / changooo, carajooo
//
// Settings tuneados para "cantadito" santiagueño:
// stability bajísimo (0.15) + style alto (0.85) = expresivo, modulado.
//
// Uso:
//   ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts
//
// Para generar solo una voz (útil si querés partir la cuota mensual):
//   SOLO_VOZ=antoni ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts
//
// Para regenerar clips que ya existen (cuando cambiaron los textos):
//   FORCE=1 ELEVENLABS_API_KEY=sk_xxx npx tsx scripts/generar-voces.ts
//
// Para regenerar SOLO ciertos cantos (ahorra cuota):
//   SOLO_CANTOS=quiero,no_quiero,ir_al_mazo FORCE=1 ELEVENLABS_API_KEY=sk_xxx ...
//
// COSTO: ~15-20k chars por corrida completa
//   (5 voces × 12 cantos × 5 variantes + 22 puntos = ~310 clips).
// Free tier ElevenLabs = 10k chars/mes — corré por voz para repartir.
// El script saltea archivos existentes (salvo FORCE=1), así podés reanudar.

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

const SOLO_VOZ = process.env.SOLO_VOZ?.toLowerCase().trim() || null;
const FORCE = process.env.FORCE === "1" || process.env.FORCE === "true";
const SOLO_CANTOS = (process.env.SOLO_CANTOS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Voces premade gratuitas. Cada una se va a usar para TODOS los cantos.
// Distintas por timbre para que jugadores distintos suenen distintos.
interface Voz {
  slug: string;
  id: string;
  nombre: string;
}

// Por ahora dejamos sólo charlie y daniel — antoni / adam / arnold sonaban
// mal con los settings y los clips se borraron. Para volver a agregarlos,
// poné de nuevo el objeto y borrá el directorio public/audio/voces/<slug>
// para forzar regeneración.
const VOCES: Voz[] = [
  { slug: "charlie", id: "IKne3meq5aSn9XLyUdCD", nombre: "Charlie" }, // grave
  { slug: "daniel",  id: "onwK4e9ZLuTAKqWW03F9", nombre: "Daniel"  }  // narrador
];

// Frases por canto, ordenadas de menor a mayor intensidad.
// La IA elige el índice según su nivel de confianza/bluff:
//   [0] = mano floja, jugada cautelosa
//   [4] = mano cargada o bluff descarado
const CANTOS: Record<string, string[]> = {
  envido: [
    "Envido, amigo... despacito nomás.",
    "Envido pué, a ver qué tené'.",
    "¡Envido che, mostrá las cartas!",
    "¡Envidooo, primito!",
    "¡ENVIDOOOO! ¡A ver si tené' agallas, changooo!"
  ],
  envido_envido: [
    "Envido envido, callandito...",
    "Envido envido nomás, pué.",
    "¡Envido envido che, no me achico!",
    "¡Envido envidooo, primito!",
    "¡ENVIDO ENVIDOOOO! ¡Vamo a ver quién canta má' fuerte, changooo!"
  ],
  real_envido: [
    "Real envido, callandito...",
    "Real envido pué, despacito.",
    "¡Real envido che!",
    "¡Reaaal envidooo, primito!",
    "¡REEEAL ENVIDOOOO! ¡Achalay la mano que tengo, hermanooo, no te va alcanzar ni rezando!"
  ],
  falta_envido: [
    "Falta envido, despacito che.",
    "Falta envido nomás, pué.",
    "¡Falta envido che, te la juego!",
    "¡Faaalta envidooo, primito!",
    "¡FAAALTA ENVIDOOOO! ¡Si querés la partida, vení a buscarla, changooo!"
  ],
  truco: [
    "Truco, callandito che.",
    "Truco pué, vamo viendo.",
    "¡Truco che, no te durmá!",
    "¡Truuucooo, primito!",
    "¡TRUUUCOOO, CARAJOOO! ¡A ver si te aguantá, changooo!"
  ],
  retruco: [
    "Quiero retruco, despacito.",
    "Retruco pué, no me asustá'.",
    "¡Quiero retruco che!",
    "¡Retruuucooo, primito!",
    "¡QUIEROOO RETRUUUCOOO! ¡A ver si te aguantá ahora, changooo!"
  ],
  vale_cuatro: [
    "Vale cuatro, callandito.",
    "Vale cuatro pué, ahí va.",
    "¡Vale cuatro che, todo o nada!",
    "¡Vaaale cuatrooo, primito!",
    "¡VAAALE CUATROOO! ¡Achalay, achalay, hermanooo, esta es la última!"
  ],
  quiero: [
    "Quiero.",
    "Quiero, amigo.",
    "¡Quierooo, ckari! Vení nomá'.",
    "¡QUIEROOO, hermano! ¡Acá te espero, no afloje'!",
    "¡QUIEROOOOO, changooo! ¡Atatay con vo', vení a buscarme si te da la nafta!"
  ],
  no_quiero: [
    "No quiero...",
    "No quiero, amigo. Otra vuelta será.",
    "No quierooo, ckari. Hoy no es mi día.",
    "¡No quiero, paisano! Me guardo pa' mejor ocasión.",
    "¡No quiero nadaaa, hermanooo! Pero ojo, que la próxima te como crudo, changooo."
  ],
  ir_al_mazo: [
    "Me voy al mazo.",
    "Al mazo nomá', amigo.",
    "¡Me voy al mazoo, ckari! Estas cartas son pa' jugar al solitario.",
    "¡Al mazo, hermano! Atatay con el reparto que me tocó.",
    "¡Me voooy al mazoooo, paisanooo! ¡No me dieron ni una sota, changooo, esto es pa' agarrarse a las trompadas con el que mezcló!"
  ],

  // SON BUENAS: el que perdió el envido reconoce que el otro tiene mejor.
  son_buenas: [
    "Son buenas.",
    "Son buenas, amigo. Bien jugado.",
    "Son buenas, ckari... esta vez.",
    "Son buena' che, te las llevá'.",
    "¡Son buenaaa', hermanooo, te la llevá' vó'!"
  ],
  // SON MEJORES: el ganador canta su tanto con orgullo.
  son_mejores: [
    "Son mejores.",
    "Son mejores, amigo.",
    "¡Son mejores, ckari!",
    "¡Son mejores, hermano! Treinta y tres.",
    "¡Son mejoreeesss, changooo! ¡Treinta y tres con la del cuatro de espada, achalay la mano!"
  ],

  // Celebración cuando viene una mano linda (no es un canto formal).
  celebracion: [
    "¡Achalaaay las cartas, ckari!",
    "¡Atatay, hermano, vení a ver esto!",
    "¡La pucha que vino linda la mano, paisano!",
    "¡Vamo' arriba, ckari, que esto se pone bueno!",
    "¡Treinta y tres son, hermano!"
  ],
  // Chicaneo al rival (cuando perdió la mano o se va al mazo).
  chicana: [
    "Andá vé', amigo, andá vé'...",
    "¡Pero qué opa que sos, changooo!",
    "¡Atatay con vo', hermano, no la viste pasar!",
    "¡Lloriqueá nomá', vidita, lloriqueá!",
    "¡Truco le canto al mocito, que viene con cara de na'!"
  ]
};

// Puntos del envido (0 a 33). Se cantan cuando hay un "¡Quiero!" para
// declarar el tanto propio. Una sola variante por número, dicha con cantito.
// Generamos sólo el rango razonable: en truco real los tantos van de 0 a 33.
const PUNTOS_ENVIDO: number[] = [
  0, 1, 2, 3, 4, 5, 6, 7,
  20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33
];

function fraseDePuntos(n: number): string {
  // Variantes cantaditas que decoran el número con muletillas comunes.
  if (n === 0) return "Cero, callandito.";
  if (n <= 7) return `${n} pelado nomás.`;
  if (n === 33) return "¡Treinta y treee', primito!";
  if (n >= 30) return `¡${escribirNumero(n)} che!`;
  return `${escribirNumero(n)}.`;
}

function escribirNumero(n: number): string {
  // Para que el TTS pronuncie con sabor; ElevenLabs maneja números pero
  // suena más natural escrito en letras.
  const tabla: Record<number, string> = {
    0: "cero", 1: "uno", 2: "dos", 3: "tres", 4: "cuatro", 5: "cinco",
    6: "seis", 7: "siete",
    20: "veinte", 21: "veintiuno", 22: "veintidós", 23: "veintitrés",
    24: "veinticuatro", 25: "veinticinco", 26: "veintiséis",
    27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
    30: "treinta", 31: "treinta y uno", 32: "treinta y dos",
    33: "treinta y tres"
  };
  return tabla[n] ?? String(n);
}

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

  const vocesAGenerar = SOLO_VOZ
    ? VOCES.filter((v) => v.slug === SOLO_VOZ)
    : VOCES;
  if (SOLO_VOZ && vocesAGenerar.length === 0) {
    console.error(
      `✗ SOLO_VOZ=${SOLO_VOZ} no coincide con ninguna voz. ` +
        `Disponibles: ${VOCES.map((v) => v.slug).join(", ")}`
    );
    process.exit(1);
  }

  let generados = 0;
  let salteados = 0;
  let errores = 0;
  let chars = 0;

  for (const voz of vocesAGenerar) {
    const dirVoz = path.join(baseDir, voz.slug);
    fs.mkdirSync(dirVoz, { recursive: true });

    for (const [canto, frases] of Object.entries(CANTOS)) {
      // Filtro opcional: si SOLO_CANTOS está seteado, sólo regeneramos esos.
      if (SOLO_CANTOS.length && !SOLO_CANTOS.includes(canto)) continue;
      const dirCanto = path.join(dirVoz, canto);
      fs.mkdirSync(dirCanto, { recursive: true });

      for (let i = 0; i < frases.length; i++) {
        const frase = frases[i];
        const archivo = String(i + 1).padStart(2, "0") + ".mp3";
        const ruta = path.join(dirCanto, archivo);

        if (fs.existsSync(ruta) && !FORCE) {
          salteados++;
          continue;
        }

        console.log(
          `  → ${voz.slug}/${canto}/${archivo}: "${frase}"`
        );
        try {
          const audio = await generarTTS(frase, voz.id);
          fs.writeFileSync(ruta, new Uint8Array(audio));
          generados++;
          chars += frase.length;
        } catch (e) {
          console.error(
            `  ✗ ${voz.slug}/${canto}/${archivo}: ${e instanceof Error ? e.message : e}`
          );
          errores++;
        }
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    // Puntos del envido: un MP3 por número en envido_puntos/<n>.mp3.
    if (SOLO_CANTOS.length && !SOLO_CANTOS.includes("envido_puntos")) continue;
    const dirPuntos = path.join(dirVoz, "envido_puntos");
    fs.mkdirSync(dirPuntos, { recursive: true });
    for (const n of PUNTOS_ENVIDO) {
      const archivo = String(n).padStart(2, "0") + ".mp3";
      const ruta = path.join(dirPuntos, archivo);
      if (fs.existsSync(ruta) && !FORCE) {
        salteados++;
        continue;
      }
      const frase = fraseDePuntos(n);
      console.log(`  → ${voz.slug}/envido_puntos/${archivo}: "${frase}"`);
      try {
        const audio = await generarTTS(frase, voz.id);
        fs.writeFileSync(ruta, new Uint8Array(audio));
        generados++;
        chars += frase.length;
      } catch (e) {
        console.error(
          `  ✗ ${voz.slug}/envido_puntos/${archivo}: ${e instanceof Error ? e.message : e}`
        );
        errores++;
      }
      await new Promise((r) => setTimeout(r, 600));
    }
  }

  console.log("");
  console.log(
    `Listo. generados=${generados} salteados=${salteados} errores=${errores} chars=${chars}`
  );
  console.log(`Archivos en: ${baseDir}`);
}

run().catch((e) => {
  console.error("✗ falla general:", e);
  process.exit(1);
});
