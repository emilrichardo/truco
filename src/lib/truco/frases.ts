// Frases para cantos y respuestas, en habla URBANA del norte argentino.
// Cada categoría tiene 5 variantes (cantos) o 7-8 (reacciones), de menor
// a mayor intensidad. El motor pica una al azar al emitir el evento.
//
// Estas mismas frases las consume scripts/generar-voces.ts para
// sintetizar MP3 con ElevenLabs — audio y chat siempre en sync.
//
// Estilo: norteño urbano (Salta / Tucumán / Santiago capital), no del
// monte profundo. Sin quichuismos heavy ("ckari" fuera, "achalay" sólo
// como interjección breve). Vocativos: loco, primito, hermano,
// hermanazo, primo, paisano, che. Groserías argentinas con buen gusto:
// ura (puta), conchudo, culiao, qué lo parió, a la pucha, mierda,
// carajo. Apóstrofo para caída de "s" sólo en gritos. "Pué" y "nomá'"
// como muletillas norteñas pero sin abusar.

export type CategoriaFrase =
  | "envido"
  | "envido_envido"
  | "real_envido"
  | "falta_envido"
  | "truco"
  | "retruco"
  | "vale_cuatro"
  | "quiero"
  | "no_quiero"
  | "ir_al_mazo"
  | "son_buenas"
  | "son_mejores"
  // Reacciones a fin de mano / partida (con carcajadas y groserías NOA).
  | "gane_mano"
  | "perdio_mano"
  | "gane_partida"
  | "perdio_partida";

// NOTA TTS: ElevenLabs (multilingual_v2) lee mejor con orto-grafía sobria.
// Si abusamos de all-caps o triples vocales (TRUUUCOOO), rompe fonemas o
// pronuncia raro. Por eso:
//   - Title case + ¡! para enfatizar (la modulación viene de voice_settings).
//   - Máximo DOS repeticiones de vocal para sugerir cantito ("trucoo").
//   - Apóstrofo en final de palabra para caída de "s" santiagueña.
export const FRASES: Record<CategoriaFrase, string[]> = {
  // Frases CORTAS y espontáneas. ElevenLabs con speed 1.18 las dice en
  // <2.5 segundos cada una, así no se montan con la siguiente jugada.
  envido: [
    "Envido.",
    "Envido pué.",
    "¡Envido, loco!",
    "¡Envidoo, primito!",
    "¡Envidoo, conchudo!"
  ],
  envido_envido: [
    "Envido envido.",
    "Envido envido pué.",
    "¡Envido envido, loco!",
    "¡Envido envidoo, primito!",
    "¡Envido envidoo, ura!"
  ],
  real_envido: [
    "Real envido.",
    "Real envido pué.",
    "¡Real envido, loco!",
    "¡Real envidoo, primito!",
    "¡Real envidoo, culiao!"
  ],
  falta_envido: [
    "Falta envido.",
    "Falta envido pué.",
    "¡Falta envido, loco!",
    "¡Falta envidoo, primito!",
    "¡Falta envidoo, qué lo parió!"
  ],
  truco: [
    "Truco.",
    "Truco pué.",
    "¡Truco, loco!",
    "¡Trucoo, primito!",
    "¡Trucoo, ura!"
  ],
  retruco: [
    "Quiero retruco.",
    "Retruco pué.",
    "¡Retruco, loco!",
    "¡Retrucoo, primito!",
    "¡Quiero retrucoo, conchudo!"
  ],
  vale_cuatro: [
    "Vale cuatro.",
    "Vale cuatro pué.",
    "¡Vale cuatro, loco!",
    "¡Vale cuatroo, primito!",
    "¡Vale cuatroo, qué lo parió!"
  ],

  quiero: [
    "Quiero.",
    "Quiero, loco.",
    "¡Quieroo, primito!",
    "¡Quieroo, hermanazo!",
    "¡Quieroo, culiao!"
  ],
  no_quiero: [
    "No quiero.",
    "No quiero, loco.",
    "No quieroo, primito.",
    "¡No quiero, paisano!",
    "¡No quiero, ura!"
  ],
  ir_al_mazo: [
    "Al mazo.",
    "Al mazo nomá'.",
    "Me voy al mazo, loco.",
    "¡Al mazo, hermanazo!",
    "¡Al mazo, qué lo parió!"
  ],
  son_buenas: [
    "Son buenas.",
    "Son buenas, loco.",
    "Son buenas, primito.",
    "Son buena' che.",
    "¡Son buenas, hermano!"
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, loco.",
    "¡Son mejores, primito!",
    "¡Son mejores, hermanazo!",
    "¡Son mejore', culiao!"
  ],

  // Reacciones — cortas, espontáneas. Suenan en paralelo cuando termina
  // una mano: el ganador chicanea, el perdedor putea, los compañeros
  // celebran o se enojan. Por eso variedades más amplias.
  gane_mano: [
    "¡Esa!",
    "¡Ahí está!",
    "¡Tomá pa' vó!",
    "¡Ja, la pucha!",
    "¡Toma!",
    "¡Tomá, conchudo!",
    "¡Ja, ja, ja!",
    "¡Uy, qué linda!"
  ],
  perdio_mano: [
    "Uy.",
    "Atatay.",
    "Uhh.",
    "¡Qué lo parió!",
    "¡A la pucha, ura!",
    "¡Mierda, culiao!",
    "¡Pero la concha!",
    "Atatay con esto."
  ],
  gane_partida: [
    "¡Listo el pollo!",
    "¡La mesa es mía!",
    "¡A pagar el fernet!",
    "¡Ja, ja, qué lo parió!",
    "¡A la pucha, conchudo!",
    "¡Ganamos, hermanazo!",
    "¡Tomá, perdedor!"
  ],
  perdio_partida: [
    "Bueno...",
    "Tuviste suerte.",
    "Ahora pagás vó'.",
    "¡Mierda, qué lo parió!",
    "¡A la pucha, culiao!",
    "¡La concha del mazo!",
    "Atatay, perdimos."
  ]
};

/** Devuelve una variante al azar de la categoría. */
export function fraseAleatoria(cat: CategoriaFrase): string {
  const arr = FRASES[cat];
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Texto canónico (variante 1) — útil para motivos en logs / breakdowns
 *  donde no queremos randomness. */
export function fraseCanonica(cat: CategoriaFrase): string {
  return FRASES[cat][0];
}
