// Frases para cantos y respuestas, en habla santiagueña / NOA.
// Cada categoría tiene 5 variantes ordenadas por intensidad
// (callandito → bravísimo). El motor pica una variante al azar al emitir
// el evento, así el chat no se repite.
//
// Estas mismas frases las consume `scripts/generar-voces.ts` para sintetizar
// los MP3 con ElevenLabs, así audio y texto siempre quedan en sync.
//
// Decisiones de habla santiagueña / quichua santiagueño:
//  - Vocativos típicos: "ckari" (varón, en quichua santiagueño),
//    "primito", "hermanazo", "compay", "changoo" (joven), "paisano".
//  - Quichuismos vivos en NOA: "achalay" (¡qué lindo!), "atatay"
//    (¡qué horror!), "opa" (tonto), "wawa" (bebé).
//  - Diminutivos a destajo: "callandito", "despacito", "primito" — no
//    son sólo afectivos, marcan el ritmo de la frase.
//  - "Pué" (pues) y "nomá'" (nomás) como muletillas suavizadoras.
//  - Caída de "s" final (apostrofada) sólo en los gritos / nivel alto,
//    para que el TTS le dé el quiebre santiagueño. En los tranquilos
//    queda con "s" para que se entienda fino.
//  - Verbos en voseo NOA: "tené'", "vení", "callate", "mostrá".
//  - Construcciones de cantito: "achalay, achalay" (repetición),
//    "atatay con vo'", "vení nomás".

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
    "¡Envido, ckari!",
    "¡Envidoo, primito!",
    "¡Envidoo, conchudo!"
  ],
  envido_envido: [
    "Envido envido.",
    "Envido envido pué.",
    "¡Envido envido, ckari!",
    "¡Envido envidoo, primito!",
    "¡Envido envidoo, ura!"
  ],
  real_envido: [
    "Real envido.",
    "Real envido pué.",
    "¡Real envido, ckari!",
    "¡Real envidoo, primito!",
    "¡Real envidoo, culiao!"
  ],
  falta_envido: [
    "Falta envido.",
    "Falta envido pué.",
    "¡Falta envido, ckari!",
    "¡Falta envidoo, primito!",
    "¡Falta envidoo, qué lo parió!"
  ],
  truco: [
    "Truco.",
    "Truco pué.",
    "¡Truco, ckari!",
    "¡Trucoo, primito!",
    "¡Trucoo, ura!"
  ],
  retruco: [
    "Quiero retruco.",
    "Retruco pué.",
    "¡Retruco, ckari!",
    "¡Retrucoo, primito!",
    "¡Quiero retrucoo, conchudo!"
  ],
  vale_cuatro: [
    "Vale cuatro.",
    "Vale cuatro pué.",
    "¡Vale cuatro, ckari!",
    "¡Vale cuatroo, primito!",
    "¡Vale cuatroo, qué lo parió!"
  ],

  quiero: [
    "Quiero.",
    "Quiero, ckari.",
    "¡Quieroo, primito!",
    "¡Quieroo, hermanazo!",
    "¡Quieroo, culiao!"
  ],
  no_quiero: [
    "No quiero.",
    "No quiero, ckari.",
    "No quieroo, primito.",
    "¡No quiero, paisano!",
    "¡No quiero, ura!"
  ],
  ir_al_mazo: [
    "Al mazo.",
    "Al mazo nomá'.",
    "Me voy al mazo, ckari.",
    "¡Al mazo, hermanazo!",
    "¡Al mazo, qué lo parió!"
  ],
  son_buenas: [
    "Son buenas.",
    "Son buenas, ckari.",
    "Son buenas, primito.",
    "Son buena' che.",
    "¡Son buenas, hermano!"
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, ckari.",
    "¡Son mejores, primito!",
    "¡Son mejores, hermanazo!",
    "¡Son mejore', culiao!"
  ],

  // Reacciones — todas cortísimas, espontáneas, una respiración.
  gane_mano: [
    "¡Esa!",
    "¡Ahí está, ckari!",
    "¡Tomá pa' vó!",
    "¡Ja, la pucha!",
    "¡Tomá, conchudo!"
  ],
  perdio_mano: [
    "Uy.",
    "Atatay.",
    "¡Qué lo parió!",
    "¡A la pucha, ura!",
    "¡Mierda, culiao!"
  ],
  gane_partida: [
    "¡Listo el pollo!",
    "¡La mesa es mía!",
    "¡A pagar el fernet!",
    "¡Ja, qué lo parió!",
    "¡A la pucha, conchudo!"
  ],
  perdio_partida: [
    "Bueno...",
    "Tuviste suerte.",
    "Ahora pagás vó'.",
    "¡Mierda, qué lo parió!",
    "¡A la pucha, culiao!"
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
