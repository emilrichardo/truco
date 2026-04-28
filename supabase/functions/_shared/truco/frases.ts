// Frases del truco — versión limpia y básica.
//
// Decisiones:
//  - Sin malas palabras ni modismos. Conversaciones cordiales y claras.
//  - Cada categoría tiene 2-3 variantes para no sonar repetitivo,
//    pero sin exagerar.
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
    "Envido, amigo."
  ],
  envido_envido: [
    "Envido envido.",
    "Te canto envido envido."
  ],
  real_envido: [
    "Real envido.",
    "Te canto real envido."
  ],
  falta_envido: [
    "Falta envido.",
    "Te canto falta envido."
  ],
  truco: [
    "Truco.",
    "Te canto truco.",
    "Truco, amigo."
  ],
  retruco: [
    "Quiero retruco.",
    "Retruco.",
    "Te retruco."
  ],
  vale_cuatro: [
    "Vale cuatro.",
    "Quiero vale cuatro."
  ],
  quiero: [
    "Quiero.",
    "Sí, quiero."
  ],
  no_quiero: [
    "No quiero.",
    "No, gracias."
  ],
  ir_al_mazo: [
    "Me voy al mazo.",
    "Al mazo."
  ],
  son_buenas: [
    "Son buenas.",
    "Son buenas, amigo."
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, amigo."
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
