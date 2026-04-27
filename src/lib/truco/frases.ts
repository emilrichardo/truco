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
  | "son_mejores";

// NOTA TTS: ElevenLabs (multilingual_v2) lee mejor con orto-grafía sobria.
// Si abusamos de all-caps o triples vocales (TRUUUCOOO), rompe fonemas o
// pronuncia raro. Por eso:
//   - Title case + ¡! para enfatizar (la modulación viene de voice_settings).
//   - Máximo DOS repeticiones de vocal para sugerir cantito ("trucoo").
//   - Apóstrofo en final de palabra para caída de "s" santiagueña.
export const FRASES: Record<CategoriaFrase, string[]> = {
  envido: [
    "Envido, ckari, callandito nomás.",
    "Envido pué, a ver qué tenés guardao.",
    "¡Envido che, no te me achiqué'!",
    "¡Envidoo, primito! Vení nomá'.",
    "¡Envidoo, changoo! Achalay la mano que tengo, vení a verla si te da el cuero."
  ],
  envido_envido: [
    "Envido envido, callandito...",
    "Envido envido pué, no me asustá'.",
    "¡Envido envido che, vamo' parejo, ckari!",
    "¡Envido envidoo, primito!",
    "¡Envido envidoo, hermanazo! A ver quién canta más fuerte, acá no afloja nadie."
  ],
  real_envido: [
    "Real envido, despacito che...",
    "Real envido pué, ckari, vamo viendo.",
    "¡Real envido che, salí de abajo'l árbol!",
    "¡Real envidoo, primito! Tres puntito' pa' mi rancho.",
    "¡Real envidoo, hermanazo! Achalay esta mano, ni rezándole a la Telesita me la ganá'."
  ],
  falta_envido: [
    "Falta envido, despacito nomá'.",
    "Falta envido pué, te la juego entera.",
    "¡Falta envido che, ahora o nunca, ckari!",
    "¡Falta envidoo, primito! La partida en una.",
    "¡Falta envidoo, changoo! Si querés la partida, vení a buscarla, hermanazo, no te quedés con las ganas."
  ],
  truco: [
    "Truco, callandito che...",
    "Truco pué, vamo' viendo.",
    "¡Truco che, no te durmá', ckari!",
    "¡Trucoo, primito! A ver qué hacé'.",
    "¡Trucoo, carajo! Achalay, achalay, hermanito, vení nomás a buscarla, changoo."
  ],
  retruco: [
    "Quiero retruco, despacito che...",
    "Retruco pué, no me asustá', ckari.",
    "¡Quiero retruco che, salí de la cocina!",
    "¡Retrucoo, primito! Subila si te da, vidita.",
    "¡Quiero retrucoo, changoo! Atatay con vo', a ver si te aguantás ahora, ckari."
  ],
  vale_cuatro: [
    "Vale cuatro, callandito...",
    "Vale cuatro pué, ahí va, ckari.",
    "¡Vale cuatro che, todo o nada, primito!",
    "¡Vale cuatroo, hermanito! A duelo nos vamo'.",
    "¡Vale cuatroo, hermanazo! Achalay, achalay, esta es la última, changoo, agarrate de la silla."
  ],

  quiero: [
    "Quiero.",
    "Quiero, ckari.",
    "¡Quieroo, primito! Vení nomá'.",
    "¡Quieroo, hermanazo! Acá te espero, no afloje'.",
    "¡Quieroo, changoo! Atatay con vo', vení a buscarme si te da la nafta, ckari."
  ],
  no_quiero: [
    "No quiero...",
    "No quiero, ckari. Otra vuelta será.",
    "No quieroo, primito. Hoy no e' mi día, vidita.",
    "¡No quiero, paisano! Me guardo pa' mejor mano.",
    "¡No quiero nada, hermanazo! Pero ojo que la próxima te como crudo, changoo, te lo digo yo."
  ],
  ir_al_mazo: [
    "Me voy al mazo.",
    "Al mazo nomá', ckari.",
    "¡Me voy al mazo, primito! Esta' carta' son pa' jugar al solitario.",
    "¡Al mazo, hermanazo! Atatay con el reparto que me tocó.",
    "¡Me voy al mazo, paisano! No me dieron ni una sota, changoo, esto es pa' agarrarse a las trompada' con el que mezcló."
  ],
  son_buenas: [
    "Son buenas.",
    "Son buenas, ckari. Bien jugao.",
    "Son buenas, primito... esta vez.",
    "Son buena' che, te la' llevá'.",
    "¡Son buenaa', hermanazo, te la' llevá' vó' nomá', achalay esa mano!"
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, ckari.",
    "¡Son mejores, primito!",
    "¡Son mejores, hermanazo! Treinta y tre'.",
    "¡Son mejore', changoo! Treinta y tre' con la del cuatro de espada, achalay la mano, ckari."
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
