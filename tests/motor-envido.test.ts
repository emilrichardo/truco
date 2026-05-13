// Tests del flujo de envido en el motor.
// Reproducen los bugs reportados:
//  - Envido cantado y bot no responde.
//  - Después de envido envido no se puede escalar a real_envido.
//  - Doble cantar_envido no debería ser válido (mismo equipo).
import { describe, expect, it } from "vitest";
import { accionesLegales, aplicarAccion } from "@/lib/truco/motor";
import type { Carta } from "@/lib/truco/types";
import { aplicar, estado1v1, estado2v2 } from "./helpers";

function carta(palo: Carta["palo"], numero: Carta["numero"]): Carta {
  return { palo, numero, id: `${palo}-${numero}` };
}

describe("envido — flujo básico", () => {
  it("usuario canta envido → setea envidoCantoActivo y le pasa el turno al bot", () => {
    const e0 = estado1v1();
    const e1 = aplicar(e0, { tipo: "cantar_envido", jugadorId: "U" });
    expect(e1.manoActual?.envidoCantoActivo).not.toBeNull();
    expect(e1.manoActual?.envidoCantoActivo?.equipoQueCanto).toBe(0);
    expect(e1.manoActual?.envidoCantoActivo?.equipoQueDebeResponder).toBe(1);
    expect(e1.manoActual?.envidoCantoActivo?.cadena).toEqual(["envido"]);
    expect(e1.manoActual?.turnoJugadorId).toBe("B");
  });

  it("bot puede aceptar envido → puntos otorgados y envidoResuelto=true", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_quiero", jugadorId: "B" });
    expect(e.manoActual?.envidoResuelto).toBe(true);
    expect(e.manoActual?.envidoCantoActivo).toBeNull();
    // Alguno de los dos equipos suma puntos.
    expect(e.puntos[0] + e.puntos[1]).toBeGreaterThan(0);
  });

  it("bot puede rechazar envido → +1 al cantor, mano cerrada", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_no_quiero", jugadorId: "B" });
    expect(e.puntos[0]).toBe(1);
    expect(e.manoActual?.envidoResuelto).toBe(true);
  });

  it("bot puede escalar a real_envido tras envido del usuario", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "B" });
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual([
      "envido",
      "real_envido"
    ]);
    expect(e.manoActual?.envidoCantoActivo?.equipoQueDebeResponder).toBe(0);
  });

  it("usuario puede escalar a real_envido tras envido del bot", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "B" });
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "U" });
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual([
      "envido",
      "real_envido"
    ]);
  });

  it("después de envido envido se puede escalar a real_envido (regresión)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "B" }); // envido envido
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual([
      "envido",
      "envido"
    ]);
    // El usuario AHORA debería poder escalar a real_envido.
    const legales = accionesLegales(e, "U");
    expect(legales).toContain("cantar_real_envido");
    expect(legales).toContain("cantar_falta_envido");
    expect(legales).toContain("responder_quiero");
    expect(legales).toContain("responder_no_quiero");
  });

  it("después de real_envido NO se puede cantar envido ni real_envido (regresión)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_real_envido", jugadorId: "B" });
    const legales = accionesLegales(e, "U");
    expect(legales).not.toContain("cantar_envido");
    expect(legales).not.toContain("cantar_real_envido");
    expect(legales).toContain("cantar_falta_envido");
  });

  it("si me cantan truco antes, puedo cortar con envido en un solo toque", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "B" });

    const legales = accionesLegales(e, "U");
    expect(legales).toContain("cantar_envido");

    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    expect(e.manoActual?.envidoCantoActivo?.cadena).toEqual(["envido"]);
    expect(e.manoActual?.trucoCantoActivo?.nivel).toBe("truco");
  });

  it("guarda los tantos del ganador y perdedor cuando se quiere falta envido", () => {
    let e = estado1v1();
    e.manoActual!.cartasPorJugador.U = [
      carta("oro", 7),
      carta("oro", 6),
      carta("espada", 1)
    ];
    e.manoActual!.cartasPorJugador.B = [
      carta("copa", 7),
      carta("copa", 5),
      carta("basto", 4)
    ];

    e = aplicar(e, { tipo: "cantar_falta_envido", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_quiero", jugadorId: "B" });

    expect(e.ganadorPartida).toBe(0);
    expect(e.manoActual?.envidoResolucion).toMatchObject({
      ganadorEquipo: 0,
      tipo: "falta_envido",
      querido: true,
      puntosEquipo: [33, 32]
    });
  });
});

describe("envido — bloqueos", () => {
  it("ignora cantar_envido si el mismo equipo ya tiene canto pendiente", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "U" });
    // El bot debe responder. No el usuario re-cantando.
    const r = aplicarAccion(e, { tipo: "cantar_envido", jugadorId: "U" });
    expect(r.ok).toBe(true);
    expect(r.estado.manoActual?.envidoCantoActivo?.cadena).toEqual(["envido"]);
  });

  it("rechaza envido si la primera baza ya tiene cartas jugadas y el cantor jugó", () => {
    let e = estado1v1();
    // Mano juega su carta primero → envido se cierra.
    const cartas = e.manoActual!.cartasPorJugador["U"];
    e = aplicar(e, {
      tipo: "jugar_carta",
      jugadorId: "U",
      cartaId: cartas[0].id
    });
    // El bot tiene que jugar también para cerrar la ventana del envido.
    const cartasB = e.manoActual!.cartasPorJugador["B"];
    e = aplicar(e, {
      tipo: "jugar_carta",
      jugadorId: "B",
      cartaId: cartasB[0].id
    });
    // Baza 1 cerrada → no se puede cantar envido más.
    const legales = accionesLegales(e, "U");
    expect(legales).not.toContain("cantar_envido");
  });

  it("si mi compañero ya cantó envido, mi intento stale queda como no-op", () => {
    let e = estado2v2(["human", "bot", "human", "bot"]);
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "P2" });
    const r = aplicarAccion(e, { tipo: "cantar_envido", jugadorId: "P0" });
    expect(r.ok).toBe(true);
    expect(r.estado.manoActual?.envidoCantoActivo?.equipoQueCanto).toBe(0);
    expect(r.estado.manoActual?.envidoCantoActivo?.cadena).toEqual(["envido"]);
  });
});
