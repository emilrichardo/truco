// Tests de escenarios reales reportados por el usuario en partidas:
//  1. Pie canta real_envido → bot debe responder.
//  2. Después de cantar real_envido, usuario NO puede re-cantar envido.
//  3. Bot mano no canta envido (deja al pie).
//  4. Bot no se va al mazo cuando tiene compañero humano.
//  5. ir_al_mazo solo en turno.
import { describe, expect, it } from "vitest";
import { decidirAccionBot } from "@/lib/truco/ia";
import { accionesLegales, aplicarAccion } from "@/lib/truco/motor";
import { aplicar, estado1v1, estado2v2 } from "./helpers";

describe("escenario: pie canta real_envido", () => {
  it("usuario canta real_envido directo y el bot tiene que responder", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual(["real_envido"]);
    // El bot DEBE poder devolver una acción válida (no null).
    const accion = decidirAccionBot(e, "B");
    const validas = [
      "responder_quiero",
      "responder_no_quiero",
      "cantar_falta_envido"
    ];
    expect(validas).toContain(accion.tipo);
  });

  it("después de real_envido del usuario, el bot puede falta_envido", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    const r = aplicarAccion(e, {
      tipo: "cantar_falta_envido",
      jugadorId: "B"
    });
    expect(r.ok).toBe(true);
  });

  it("después de real_envido del usuario, el bot NO puede re-cantar real_envido", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    const r = aplicarAccion(e, {
      tipo: "cantar_real_envido",
      jugadorId: "B"
    });
    expect(r.ok).toBe(false);
  });

  it("usuario NO puede re-cantar envido después de su real_envido", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    const r = aplicarAccion(e, { tipo: "cantar_envido", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });

  it("legales del usuario NO incluyen cantar_envido tras su real_envido", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    const legales = accionesLegales(e, "U");
    expect(legales).not.toContain("cantar_envido");
    expect(legales).not.toContain("cantar_real_envido");
  });
});

describe("escenario: secuencia envido envido real_envido", () => {
  it("usuario envido → bot envido envido → usuario real_envido (válido)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "B" });
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual([
      "envido",
      "envido"
    ]);
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual([
      "envido",
      "envido",
      "real_envido"
    ]);
  });

  it("bot SIEMPRE responde con acción válida tras secuencia larga", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "B" });
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    expect([
      "responder_quiero",
      "responder_no_quiero",
      "cantar_falta_envido"
    ]).toContain(accion.tipo);
  });
});

describe("escenario: bot mano no canta envido (2v2)", () => {
  it("bot al inicio de la mano (mano de su equipo) no canta envido si tiene compañero humano", () => {
    // 2v2: P0 humano + P2 bot (equipo 0); P1 bot + P3 bot (equipo 1).
    // P0 es mano de la mano (asiento 0). El siguiente jugador es P1
    // (rival), que es bot. P1 podría intentar cantar envido por su
    // cuenta, pero su equipo es 100% bot, así que sí podría.
    // Más interesante: P2 (bot, compañero del humano P0) NO debería
    // cantar envido porque su equipo tiene un humano (P0).
    const e = estado2v2(["human", "bot", "bot", "bot"]);
    const accion = decidirAccionBot(e, "P2");
    expect(["cantar_envido", "cantar_real_envido", "cantar_falta_envido"])
      .not.toContain(accion.tipo);
  });
});

describe("escenario: ir_al_mazo solo en turno (regresión)", () => {
  it("usuario NO puede ir al mazo mientras el bot debe responder", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    // Turno del bot para responder. Usuario intenta mazo → rechazo.
    const r = aplicarAccion(e, { tipo: "ir_al_mazo", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });

  it("legales NO incluye ir_al_mazo cuando no es mi turno", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    const legales = accionesLegales(e, "U");
    expect(legales).not.toContain("ir_al_mazo");
  });
});

describe("escenario: spam de cantos (regresión)", () => {
  it("usuario NO puede spam cantar_truco — segundo intento rechazado", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const r = aplicarAccion(e, { tipo: "cantar_truco", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });

  it("usuario NO puede spam cantar_envido — segundo intento rechazado", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    const r = aplicarAccion(e, { tipo: "cantar_envido", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });
});

describe("escenario: no_quiero da los puntos correctos (regresión)", () => {
  it("no quiero envido → +1 al cantor", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_no_quiero", jugadorId: "B" });
    expect(e.puntos[0]).toBe(1);
    expect(e.puntos[1]).toBe(0);
  });

  it("no quiero truco → +1 al cantor (no doble)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_no_quiero", jugadorId: "B" });
    expect(e.puntos[0]).toBe(1);
    expect(e.puntos[1]).toBe(0);
  });

  it("no quiero retruco → +2 al cantor (truco aceptado + retruco rechazado)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_retruco", jugadorId: "B" });
    // Ahora U debe responder al retruco.
    e = aplicar(e, { tipo: "responder_no_quiero", jugadorId: "U" });
    // El retruco fue rechazado, B (que cantó retruco) gana el valor
    // del truco aceptado: +2.
    expect(e.puntos[1]).toBe(2);
  });
});
