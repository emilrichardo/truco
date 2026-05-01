// Tests de deberiaConsultar — el bot debe pedir input al humano antes
// de tirar carta SIEMPRE, no solo cuando es pie de equipo.
import { describe, expect, it } from "vitest";
import { deberiaConsultar } from "@/lib/consultaCompañero";
import { aplicar, estado1v1, estado2v2 } from "./helpers";

describe("deberiaConsultar — consulta jugar en cualquier baza/posición", () => {
  it("2v2: bot mano de equipo (asiento 1, equipo 1) consulta antes de tirar", () => {
    // P0 humano + P2 bot vs P1 bot + P3 bot. Mano de la mano = P0.
    // Después que P0 juega su carta, sigue P1 (bot, mano de su equipo).
    let e = estado2v2(["human", "bot", "bot", "bot"]);
    // P0 (humano) juega su primera carta.
    const cartasU = e.manoActual!.cartasPorJugador["P0"];
    e = aplicar(e, {
      tipo: "jugar_carta",
      jugadorId: "P0",
      cartaId: cartasU[0].id
    });
    // Ahora turno es P1 (siguiente asiento). P1 es bot.
    expect(e.manoActual?.turnoJugadorId).toBe("P1");
    // P1 es mano del equipo 1 (su compañero P3 viene después).
    // Como su equipo es 100% bot, NO tiene compañero humano —
    // deberiaConsultar devuelve null. Pero si fuera mixto sí.
    const p1 = e.jugadores.find((j) => j.id === "P1")!;
    const c = deberiaConsultar(e, p1);
    expect(c).toBeNull();
  });

  it("2v2: bot pie del equipo del humano consulta jugar siempre", () => {
    // P0 humano + P2 bot vs P1 bot + P3 bot.
    // P2 es bot, su compañero P0 es humano. P2 es pie del equipo 0.
    // Cuando le toque jugar, debería consultar.
    const e = estado2v2(["human", "bot", "bot", "bot"]);
    const p2 = e.jugadores.find((j) => j.id === "P2")!;
    // Forzamos el turno a P2 (sin pasar por P0/P1) — escenario:
    // baza 2 con P2 abriendo.
    e.manoActual!.turnoJugadorId = "P2";
    e.manoActual!.bazas.push({
      jugadas: [],
      ganadorEquipo: null,
      pardada: false
    });
    const c = deberiaConsultar(e, p2);
    expect(c).not.toBeNull();
    expect(c?.tipo).toBe("jugar");
  });

  it("2v2: bot mano de equipo del humano TAMBIÉN consulta (regresión)", () => {
    // Setup: P0 bot + P2 humano vs P1 bot + P3 bot.
    // P0 es mano del equipo 0, su compañero es P2 humano.
    // Antes la consulta solo disparaba si bot era PIE — el bot mano
    // jugaba sin preguntar. Ahora debe consultar igual.
    const e = estado2v2(["bot", "bot", "human", "bot"]);
    const p0 = e.jugadores.find((j) => j.id === "P0")!;
    expect(e.manoActual?.turnoJugadorId).toBe("P0");
    const c = deberiaConsultar(e, p0);
    // P0 es mano de mano y mano de equipo. Antes esto retornaba null.
    // Ahora debe retornar consulta de envido (baza 1) o jugar.
    expect(c).not.toBeNull();
  });

  it("1v1 vs bot: no consultamos (no hay compañero)", () => {
    const e = estado1v1();
    const bot = e.jugadores.find((j) => j.id === "B")!;
    const c = deberiaConsultar(e, bot);
    expect(c).toBeNull();
  });

  it("no consulta si hay envido pendiente (debe responder)", () => {
    let e = estado2v2(["human", "bot", "bot", "bot"]);
    e = aplicar(e, { tipo: "cantar_envido", jugadorId: "P0" });
    const p2 = e.jugadores.find((j) => j.id === "P2")!;
    const c = deberiaConsultar(e, p2);
    // P2 es bot, su equipo es 0 (mismo que P0). Está esperando que
    // P1/P3 (rival) responda. P2 no actúa, no consulta.
    // Pero si P2 está en turno y hay envido pendiente, también no
    // consulta (early return por envidoCantoActivo).
    expect(c).toBeNull();
  });
});
