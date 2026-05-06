// Frases del truco — versión clara, norteña y jugable.
//
// Decisiones:
//  - Rechazar un envido/truco siempre dice "no quiero", nunca "paso".
//  - Modismos suaves del norte argentino para que el TTS suene más criollo.
//  - 5-7 variantes por categoría para variedad sin ensuciar la mesa.
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
    "Envido, amigo.",
    "Te voy con envido.",
    "Va envido.",
    "Te tiro envido.",
    "Envido, chango."
  ],
  envido_envido: [
    "Envido envido.",
    "Te canto envido envido.",
    "Envido envido, amigo.",
    "Voy con envido envido.",
    "Envido envido, primo.",
    "Te subo envido envido."
  ],
  real_envido: [
    "Real envido.",
    "Te canto real envido.",
    "Real envido, amigo.",
    "Voy con real envido.",
    "Real envido, chango.",
    "Va real envido, primo."
  ],
  falta_envido: [
    "Falta envido.",
    "Te canto falta envido.",
    "Falta envido, amigo.",
    "Vamos con falta envido.",
    "Falta envido, chango.",
    "Te clavo falta envido."
  ],
  truco: [
    "Truco.",
    "Te canto truco.",
    "Truco, amigo.",
    "Va truco.",
    "Te voy con truco.",
    "Truco, chango.",
    "Te apuro con truco."
  ],
  retruco: [
    "Quiero retruco.",
    "Retruco.",
    "Te retruco.",
    "Va retruco.",
    "Retruco, chango.",
    "Te canto retruco."
  ],
  vale_cuatro: [
    "Vale cuatro.",
    "Quiero vale cuatro.",
    "Va vale cuatro.",
    "Vale cuatro, chango.",
    "Te llevo a vale cuatro."
  ],
  quiero: [
    "Quiero.",
    "Sí, quiero.",
    "Quiero, amigo.",
    "Dale, quiero.",
    "Quiero, chango.",
    "Venga, quiero."
  ],
  no_quiero: [
    "No quiero.",
    "No quiero, gracias.",
    "No quiero, chango.",
    "No quiero, primo.",
    "No quiero, está bien.",
    "No quiero, dejalo ahí."
  ],
  ir_al_mazo: [
    "Me voy al mazo.",
    "Al mazo.",
    "Mazo.",
    "Voy al mazo.",
    "Me voy al mazo, chango.",
    "Ya fue, al mazo."
  ],
  son_buenas: [
    "Son buenas.",
    "Son buenas, amigo.",
    "Son buenas para vos.",
    "Las tuyas son buenas.",
    "Son buenas, chango.",
    "Buenas las tuyas."
  ],
  son_mejores: [
    "Son mejores.",
    "Son mejores, amigo.",
    "Acá son mejores.",
    "Tengo mejores.",
    "Son mejores, chango.",
    "Las mías son mejores."
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
