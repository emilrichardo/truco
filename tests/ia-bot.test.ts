// Tests del comportamiento de la IA del bot. Cubren:
//  - Bot responde envido cuando se lo cantan (no se queda mudo).
//  - Bot responde truco.
//  - Bot no se va al mazo cuando tiene compañero humano (regresión).
//  - Bot mano de equipo no canta envido (deja al pie).
import { describe, expect, it } from "vitest";
import { decidirAccionBot } from "@/lib/truco/ia";
import type { Carta } from "@/lib/truco/types";
import { aplicar, estado1v1, estado2v2 } from "./helpers";

function setCartas(
  estado: ReturnType<typeof estado2v2>,
  jugadorId: string,
  cartas: { numero: Carta["numero"]; palo: Carta["palo"] }[]
) {
  estado.manoActual!.cartasPorJugador[jugadorId] = cartas.map((c, i) => ({
    id: `ia-${jugadorId}-${i}`,
    numero: c.numero,
    palo: c.palo
  }));
}

describe("IA — respuesta a envido", () => {
  it("bot responde a envido del usuario en 1v1 (NO null, NO ir_al_mazo)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    // El bot tiene que responder.
    const accion = decidirAccionBot(e, "B");
    const tiposEsperados = [
      "responder_quiero",
      "responder_no_quiero",
      "cantar_envido",
      "cantar_real_envido",
      "cantar_falta_envido"
    ];
    expect(tiposEsperados).toContain(accion.tipo);
  });

  it("bot NO devuelve ir_al_mazo cuando hay envido pendiente", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    expect(accion.tipo).not.toBe("ir_al_mazo");
  });
});

describe("IA — respuesta a truco", () => {
  it("bot responde a truco del usuario", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    const tiposEsperados = [
      "responder_quiero",
      "responder_no_quiero",
      "cantar_retruco"
    ];
    expect(tiposEsperados).toContain(accion.tipo);
  });

  it("bot NO devuelve ir_al_mazo cuando hay truco pendiente", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const accion = decidirAccionBot(e, "B");
    expect(accion.tipo).not.toBe("ir_al_mazo");
  });
});

describe("IA — bot no va al mazo con compañero humano (regresión)", () => {
  it("bot compañero NO se va al mazo en baza 3 si tiene compañero humano", () => {
    // Setup: 2v2 con humano P0 + bot P2 vs bot P1 + bot P3.
    let e = estado2v2(["human", "bot", "bot", "bot"]);
    // Forzamos un escenario donde el bot P2 tendría que decidir si
    // ir al mazo: baza 3, score 1-1.
    // Truco motor en este escenario es complejo; verificamos que la
    // IA preferentemente NO devuelva ir_al_mazo cuando tengo
    // compañero humano. Test simplificado: el fallback nunca debería
    // ir al mazo si tengo cartas todavía.
    const accion = decidirAccionBot(e, "P2");
    // En el inicio puede ser jugar_carta o algún canto, pero no mazo.
    expect(accion.tipo).not.toBe("ir_al_mazo");
  });
});

describe("IA — bot mano de equipo NO canta envido por su cuenta", () => {
  it("bot mano de equipo en 2v2 no canta envido si su compañero (pie) puede hacerlo", () => {
    // 2v2: humano P0 + bot P2 (compañero) vs bot P1 + bot P3.
    // El humano no canta automáticamente. Si el bot fuera mano de
    // su equipo y cantara envido por las suyas, le pisa la jugada
    // al humano. La regla en intentarCantarEnvido bloquea esto.
    // Verificamos que el bot no devuelva cantar_envido si tiene
    // compañero humano.
    const e = estado2v2(["human", "bot", "bot", "bot"]);
    // P2 es bot, su compañero es P0 (humano).
    const accion = decidirAccionBot(e, "P2");
    expect(accion.tipo).not.toBe("cantar_envido");
    expect(accion.tipo).not.toBe("cantar_real_envido");
    expect(accion.tipo).not.toBe("cantar_falta_envido");
  });
});

describe("IA — juego de equipo y lectura de mesa", () => {
  it("si el compañero pendiente puede matar, el bot no quema su carta ganadora", () => {
    const e = estado2v2(["human", "bot", "bot", "bot"]);
    const mano = e.manoActual!;
    setCartas(e, "P0", [{ numero: 1, palo: "espada" }]);
    setCartas(e, "P2", [
      { numero: 7, palo: "oro" },
      { numero: 4, palo: "copa" }
    ]);
    mano.turnoJugadorId = "P2";
    mano.bazas[0].jugadas = [
      {
        jugadorId: "P1",
        carta: { id: "p1-tres", numero: 3, palo: "espada" }
      }
    ];

    const accion = decidirAccionBot(e, "P2");
    expect(accion).toMatchObject({
      tipo: "jugar_carta",
      cartaId: "ia-P2-1"
    });
  });

  it("acepta el truco con mano floja propia si el compañero tiene respaldo fuerte", () => {
    let e = estado2v2(["bot", "bot", "bot", "bot"]);
    setCartas(e, "P1", [
      { numero: 4, palo: "espada" },
      { numero: 5, palo: "basto" },
      { numero: 6, palo: "copa" }
    ]);
    setCartas(e, "P3", [
      { numero: 1, palo: "espada" },
      { numero: 7, palo: "oro" },
      { numero: 3, palo: "basto" }
    ]);
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "P0" });

    const accion = decidirAccionBot(e, "P1");
    expect(["responder_quiero", "cantar_retruco"]).toContain(accion.tipo);
  });
});
