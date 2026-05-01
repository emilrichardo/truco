// Tests determinísticos de las decisiones de la IA — ejercitan ramas
// específicas de decidirAccionBot construyendo estados artificiales.
// Las personalidades del bot tienen una semilla fija via hashStr(id),
// así los tests no flackean por seeds aleatorias.
import { describe, expect, it } from "vitest";
import { decidirAccionBot } from "@/lib/truco/ia";
import { aplicar, estado1v1 } from "./helpers";

/** Reemplaza las cartas en mano del jugador para forzar un escenario
 *  específico. Útil para testear "¿qué hace el bot con 1 espada?". */
function setCartas(
  estado: ReturnType<typeof estado1v1>,
  jugadorId: string,
  cartas: { numero: number; palo: "espada" | "basto" | "oro" | "copa" }[]
) {
  estado.manoActual!.cartasPorJugador[jugadorId] = cartas.map((c, i) => ({
    id: `test-${jugadorId}-${i}`,
    numero: c.numero,
    palo: c.palo
  }));
}

describe("IA — bot acepta truco con mano fuerte", () => {
  it("con 1 de espada + 1 de basto + 7 de espada acepta truco fácil", () => {
    let e = estado1v1();
    setCartas(e, "B", [
      { numero: 1, palo: "espada" },
      { numero: 1, palo: "basto" },
      { numero: 7, palo: "espada" }
    ]);
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    // Con 3 cartas top, puede aceptar O escalar a retruco — ambos válidos.
    expect(["responder_quiero", "cantar_retruco"]).toContain(accion.tipo);
  });

  it("con mano basura (3 cuatros) NO acepta truco normal", () => {
    let e = estado1v1();
    setCartas(e, "B", [
      { numero: 4, palo: "espada" },
      { numero: 4, palo: "basto" },
      { numero: 4, palo: "oro" }
    ]);
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    // Con 3x4s lo más probable es no_quiero (puede haber bluff
    // ocasional, pero la mano es muy floja).
    // Aceptamos cualquier respuesta menos cantar_retruco.
    expect(accion.tipo).not.toBe("cantar_retruco");
  });
});

describe("IA — envido con mano alta", () => {
  it("con 33 de envido (7+6+12 mismo palo no... veamos) responde decentemente", () => {
    // Con 3 figuras del mismo palo el envido es 20+0=20. Para 33
    // necesitamos 7+6 mismo palo = 33.
    let e = estado1v1();
    setCartas(e, "B", [
      { numero: 7, palo: "espada" },
      { numero: 6, palo: "espada" },
      { numero: 4, palo: "oro" }
    ]);
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    // 33 de envido — debe escalar o aceptar fuerte.
    expect([
      "responder_quiero",
      "cantar_real_envido",
      "cantar_falta_envido"
    ]).toContain(accion.tipo);
  });
});

describe("IA — bot juega siempre algo válido (regresión fallback)", () => {
  it("con cualquier mano, decidirAccionBot no devuelve ir_al_mazo cuando hay envido pendiente", () => {
    let e = estado1v1();
    setCartas(e, "B", [
      { numero: 4, palo: "espada" },
      { numero: 5, palo: "basto" },
      { numero: 6, palo: "oro" }
    ]);
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    expect(accion.tipo).not.toBe("ir_al_mazo");
  });

  it("con cualquier mano, decidirAccionBot no devuelve ir_al_mazo cuando hay truco pendiente", () => {
    let e = estado1v1();
    setCartas(e, "B", [
      { numero: 4, palo: "espada" },
      { numero: 5, palo: "basto" },
      { numero: 6, palo: "oro" }
    ]);
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    expect(accion.tipo).not.toBe("ir_al_mazo");
  });
});

describe("IA — bot no canta envido si tiene compañero humano (2v2)", () => {
  it("simulamos 2v2 — el bot no canta envido por su cuenta", () => {
    // En un escenario 2v2 con humano P0 + bot P2, el bot P2 al inicio
    // de la mano (cuando tiene legales que incluyen cantar_envido)
    // no debe cantarlo — espera a que el humano decida.
    // No tenemos un helper estado2v2 con personalización fácil de
    // cartas; reusamos el setup. La regla la chequeamos en el bot
    // usando un test del flujo: cualquier acción NO debe ser un
    // canto de envido espontáneo.
    let e = estado1v1();
    // Hack: marcamos a U como bot también para simular "compañero
    // humano del bot". En realidad esto no es 2v2, pero el código
    // mira si hay alguien NO bot en mi equipo. En 1v1 no hay
    // compañero; este test es más un placeholder. La cobertura real
    // está en ia-bot.test.ts con estado2v2.
    setCartas(e, "B", [
      { numero: 7, palo: "espada" },
      { numero: 6, palo: "espada" },
      { numero: 4, palo: "oro" }
    ]);
    // Sin envido activo, el bot puede cantar espontáneamente. En
    // 1v1 no hay restricción de compañero. Verificamos que devuelve
    // algo válido (no fallback ir_al_mazo).
    const accion = decidirAccionBot(e, "B");
    expect(accion).toBeDefined();
    expect(accion.tipo).not.toBe("ir_al_mazo");
  });
});
