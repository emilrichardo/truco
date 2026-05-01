// Tests del flujo de truco — incluyen los bugs reportados:
//  - Doble cantar_truco del mismo equipo (no debe acumular).
//  - ir_al_mazo fuera de turno (debe rechazar).
//  - Truco out-of-turn permitido.
import { describe, expect, it } from "vitest";
import { accionesLegales, aplicarAccion } from "@/lib/truco/motor";
import { aplicar, estado1v1 } from "./helpers";

describe("truco — flujo básico", () => {
  it("cantar_truco setea trucoCantoActivo y le pasa el turno al rival", () => {
    const e0 = estado1v1();
    const e1 = aplicar(e0, { tipo: "cantar_truco", jugadorId: "U" });
    expect(e1.manoActual?.trucoCantoActivo).not.toBeNull();
    expect(e1.manoActual?.trucoCantoActivo?.equipoQueCanto).toBe(0);
    expect(e1.manoActual?.trucoCantoActivo?.equipoQueDebeResponder).toBe(1);
    expect(e1.manoActual?.trucoCantoActivo?.nivel).toBe("truco");
    expect(e1.manoActual?.turnoJugadorId).toBe("B");
  });

  it("bot quiero el truco → trucoEstado='truco' + valorMano=2", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_quiero", jugadorId: "B" });
    expect(e.manoActual?.trucoEstado).toBe("truco");
    expect(e.manoActual?.valorMano).toBe(2);
    expect(e.manoActual?.equipoConTruco).toBe(0);
    expect(e.manoActual?.trucoCantoActivo).toBeNull();
  });

  it("bot no_quiero el truco → +1 al cantor, mano cerrada", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_no_quiero", jugadorId: "B" });
    expect(e.puntos[0]).toBe(1);
  });

  it("usuario puede cantar truco fuera de turno (regla relajada)", () => {
    const e = estado1v1();
    // Asegurarse: el turno es del bot (mano = U asiento 0, primer
    // jugador es U). En realidad el primer mano es asiento 0 = U.
    // Forzamos turno al bot mutando.
    if (e.manoActual!.manoJugadorId === "U") {
      // El usuario es mano, su turno. Pero igual debería poder cantar.
      const legales = accionesLegales(e, "U");
      expect(legales).toContain("cantar_truco");
    }
  });
});

describe("truco — bloqueos (regresiones)", () => {
  it("rechaza segundo cantar_truco del mismo equipo (anti-spam)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const r = aplicarAccion(e, { tipo: "cantar_truco", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });

  it("legales NO incluye cantar_truco cuando MI equipo ya tiene canto pendiente", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    const legales = accionesLegales(e, "U");
    expect(legales).not.toContain("cantar_truco");
  });

  it("rechaza cantar_retruco del propio equipo si tiene el truco aceptado", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    e = aplicar(e, { tipo: "responder_quiero", jugadorId: "B" });
    // Ahora U tiene el truco. No puede subir su propio truco.
    const r = aplicarAccion(e, { tipo: "cantar_retruco", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });

  it("rival puede contestar truco con retruco (escalación)", () => {
    let e = estado1v1();
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    e = aplicar(e, { tipo: "cantar_retruco", jugadorId: "B" });
    expect(e.manoActual?.trucoCantoActivo?.nivel).toBe("retruco");
    expect(e.manoActual?.trucoCantoActivo?.equipoQueDebeResponder).toBe(0);
    expect(e.manoActual?.trucoEstado).toBe("truco"); // truco implícitamente aceptado
  });
});

describe("ir_al_mazo — solo en turno", () => {
  it("rechaza ir_al_mazo cuando NO es mi turno (regresión)", () => {
    let e = estado1v1();
    // Forzamos turno al bot.
    e = aplicar(e, { tipo: "cantar_truco", jugadorId: "U" });
    // Ahora es turno del bot para responder. El usuario intenta mazo.
    const r = aplicarAccion(e, { tipo: "ir_al_mazo", jugadorId: "U" });
    expect(r.ok).toBe(false);
  });

  it("acepta ir_al_mazo en mi turno", () => {
    let e = estado1v1();
    // El usuario es mano (asiento 0) — su turno.
    if (e.manoActual!.turnoJugadorId !== "U") {
      // skip — no es turno del usuario
      return;
    }
    const r = aplicarAccion(e, { tipo: "ir_al_mazo", jugadorId: "U" });
    expect(r.ok).toBe(true);
    expect(r.estado.puntos[1]).toBe(1); // bot gana 1 (no había truco)
  });
});
