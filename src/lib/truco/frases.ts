// Frases para cantos y respuestas, en estilo NOA santiagueño.
// Cada categoría tiene 5 variantes ordenadas por intensidad
// (callandito → bravísimo). El motor pica una variante al azar al emitir
// el evento, así el chat no se repite.
//
// Sin audio: ya no se sintetizan voces ni se reproducen MP3. Las frases
// salen sólo como texto en el chat.

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

export const FRASES: Record<CategoriaFrase, string[]> = {
  envido: [
    "Envido, amigo... despacito nomá'.",
    "Envido pué, a ver qué tené'.",
    "¡Envido che, mostrá las cartas!",
    "¡Envidooo, primito!",
    "¡ENVIDOOOO! ¡A ver si tené' agallas, changooo!"
  ],
  envido_envido: [
    "Envido envido, callandito...",
    "Envido envido nomá', pué.",
    "¡Envido envido che, no me achico!",
    "¡Envido envidooo, primito!",
    "¡ENVIDO ENVIDOOOO! ¡Vamo a ver quién canta má' fuerte, changooo!"
  ],
  real_envido: [
    "Real envido, callandito...",
    "Real envido pué, despacito.",
    "¡Real envido che!",
    "¡Reaaal envidooo, primito!",
    "¡REEEAL ENVIDOOOO! ¡Achalay la mano que tengo, hermanooo, no te va a alcanzar ni rezando!"
  ],
  falta_envido: [
    "Falta envido, despacito che.",
    "Falta envido nomá', pué.",
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
  son_buenas: [
    "Son buenas.",
    "Son buenas, amigo. Bien jugado.",
    "Son buenas, ckari... esta vez.",
    "Son buena' che, te las llevá'.",
    "¡Son buenaaa', hermanooo, te la llevá' vó'!"
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, amigo.",
    "¡Son mejores, ckari!",
    "¡Son mejores, hermano! Treinta y tres.",
    "¡Son mejoreeesss, changooo! ¡Treinta y tres con la del cuatro de espada, achalay la mano!"
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
