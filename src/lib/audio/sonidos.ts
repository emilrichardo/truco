"use client";
// Stub mínimo del sistema de cantos por voz.
//
// Estado actual: las voces (clips MP3 + Web Speech) fueron eliminadas. El
// motor emite frases random como texto en el chat (ver lib/truco/frases.ts)
// y eso es lo único que el jugador ve. Acá quedan sólo no-ops para que el
// código que llamaba a estas funciones siga compilando sin reproducir nada.

type CategoriaCanto =
  | "envido"
  | "envido_envido"
  | "real_envido"
  | "falta_envido"
  | "truco"
  | "retruco"
  | "vale_cuatro"
  | "quiero"
  | "no_quiero"
  | "ir_al_mazo";

interface OpcionesCanto {
  jugadorId: string;
  texto?: string;
  intensidad?: number;
}

export function reproducirCanto(_canto: CategoriaCanto, _opts: OpcionesCanto) {
  /* sin voz: el chat ya muestra el texto del canto */
}

export function precargarTodosLosClips() {
  /* sin voz */
}

// Map de identificación: detecta el canto a partir del texto del evento.
// Lo dejamos exportado por si algún consumidor lo usa para otra cosa
// (ej: routear a un futuro sistema de voz).
export function identificarCanto(texto: string): CategoriaCanto | null {
  const t = texto.toLowerCase();
  if (t.includes("falta envido")) return "falta_envido";
  if (t.includes("real envido")) return "real_envido";
  if (t.match(/envido.*envido/)) return "envido_envido";
  if (t.includes("envido")) return "envido";
  if (t.includes("vale cuatro") || t.includes("vale 4")) return "vale_cuatro";
  if (t.includes("retruco")) return "retruco";
  if (t.includes("truco")) return "truco";
  if (t.includes("no quiero") || t.includes("no_quiero")) return "no_quiero";
  if (t.includes("quiero")) return "quiero";
  if (t.includes("mazo")) return "ir_al_mazo";
  return null;
}

// Reacciones al cierre de mano / partida — quedan como no-ops por ahora.
export function reaccionGanaMano(_jugadorId: string) { /* no-op */ }
export function reaccionPierdeMano(_jugadorId: string) { /* no-op */ }
export function reaccionGanaPartida(_jugadorId: string) { /* no-op */ }
export function reaccionPierdePartida(_jugadorId: string) { /* no-op */ }

export function silenciarTodo() {
  /* sin voz; la música ambiental tiene su propio control */
}

export type { CategoriaCanto };
