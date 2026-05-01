// Tests del dispatch del bot — qué bot tiene que actuar en cada
// situación. Cubre los bugs reportados:
//  - Pie canta real_envido y nadie responde (quienActuaSiBot debería
//    devolver el bot rival).
//  - Bot no responde a truco / envido en 1v1.
import { describe, expect, it } from "vitest";
import { quienActuaSiBot } from "@/lib/salaLocal";
import { aplicar, estado1v1, estado2v2 } from "./helpers";

describe("quienActuaSiBot — respuesta a envido", () => {
  it("1v1: usuario canta envido → quienActuaSiBot devuelve el bot", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    const actor = quienActuaSiBot(e);
    expect(actor?.id).toBe("B");
  });

  it("1v1: usuario canta real_envido → quienActuaSiBot devuelve el bot (regresión)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    const actor = quienActuaSiBot(e);
    expect(actor?.id).toBe("B");
  });

  it("1v1: usuario canta falta_envido → bot tiene que responder", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_falta_envido", jugadorId: "U" });
    const actor = quienActuaSiBot(e);
    expect(actor?.id).toBe("B");
  });

  it("1v1: usuario canta truco → bot tiene que responder", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const actor = quienActuaSiBot(e);
    expect(actor?.id).toBe("B");
  });
});

describe("quienActuaSiBot — 2v2 con compañero humano del responder", () => {
  it("2v2 con humano P1 en equipo del responder → no se despacha bot", () => {
    // P0 (humano) + P2 (bot) vs P1 (humano) + P3 (bot).
    let e = estado2v2(["human", "human", "bot", "bot"]);
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "P0" });
    // Equipo respondedor (1) tiene humano (P1) → no despachar bot.
    const actor = quienActuaSiBot(e);
    expect(actor).toBeUndefined();
  });

  it("2v2 con todo bots en equipo del responder → despacha el bot", () => {
    // P0 (humano) + P2 (bot) vs P1 (bot) + P3 (bot).
    let e = estado2v2(["human", "bot", "bot", "bot"]);
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "P0" });
    const actor = quienActuaSiBot(e);
    expect(actor).toBeDefined();
    expect(actor?.esBot).toBe(true);
    expect(actor?.equipo).toBe(1);
  });
});

describe("quienActuaSiBot — turno normal", () => {
  it("sin canto activo: devuelve el bot si es su turno", () => {
    const e = estado1v1();
    // Turno inicial es del mano (asiento 0 = U). No es turno del bot.
    const actor = quienActuaSiBot(e);
    expect(actor).toBeUndefined();
  });

  it("sin canto activo: devuelve undefined si es turno del humano", () => {
    const e = estado1v1();
    const actor = quienActuaSiBot(e);
    expect(actor).toBeUndefined();
  });
});
