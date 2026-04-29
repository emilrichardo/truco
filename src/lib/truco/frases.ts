// Frases del truco — versión limpia y básica.
//
// Decisiones:
//  - Sin malas palabras ni modismos. Conversaciones cordiales y claras.
//  - 4-5 variantes por categoría para variedad sin caer en slang.
//  - SIN reacciones de fin de mano / fin de partida — eran ráfagas de
//    voces simultáneas que ensuciaban la mesa. El banner ResultadoMano
//    ya marca el cierre visualmente.
//
// El motor consume FRASES con `fraseAleatoria(cat)`. El script
// scripts/generar-voces.ts también lo lee para sintetizar los MP3.

export type CategoriaFrase =
  | "envido"
  | "envido_envido"
  | "real_envido"
  | "falta_envido"
  | "flor"
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
    "Envido.",
    "Te canto envido.",
    "Envido, amigo.",
    "Te voy con envido.",
    "Va envido."
  ],
  envido_envido: [
    "Envido envido.",
    "Te canto envido envido.",
    "Envido envido, amigo.",
    "Voy con envido envido."
  ],
  real_envido: [
    "Real envido.",
    "Te canto real envido.",
    "Real envido, amigo.",
    "Voy con real envido."
  ],
  falta_envido: [
    "Falta envido.",
    "Te canto falta envido.",
    "Falta envido, amigo.",
    "Vamos con falta envido."
  ],
  flor: [
    "¡Flor!",
    "Te canto flor.",
    "Flor, amigo.",
    "Tengo flor.",
    "Va flor."
  ],
  truco: [
    "Truco.",
    "Te canto truco.",
    "Truco, amigo.",
    "Va truco.",
    "Te voy con truco."
  ],
  retruco: [
    "Quiero retruco.",
    "Retruco.",
    "Te retruco.",
    "Va retruco."
  ],
  vale_cuatro: [
    "Vale cuatro.",
    "Quiero vale cuatro.",
    "Va vale cuatro."
  ],
  quiero: [
    "Quiero.",
    "Sí, quiero.",
    "Quiero, amigo.",
    "Dale, quiero."
  ],
  no_quiero: [
    "No quiero.",
    "No, gracias.",
    "No quiero, amigo.",
    "Paso."
  ],
  ir_al_mazo: [
    "Me voy al mazo.",
    "Al mazo.",
    "Mazo.",
    "Voy al mazo."
  ],
  son_buenas: [
    "Son buenas.",
    "Son buenas, amigo.",
    "Son buenas para vos.",
    "Las tuyas son buenas."
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, amigo.",
    "Acá son mejores.",
    "Tengo mejores."
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
