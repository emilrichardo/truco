import { describe, expect, it } from "vitest";
import { accionesLegales, aplicarAccion } from "@/lib/truco/motor";
import { estado1v1 } from "./helpers";

describe("motor sin flor", () => {
  it("no ofrece flor aunque una sala vieja traiga flags legacy", () => {
    const e = estado1v1();
    (e as any).conFlor = true;
    (e.manoActual as any).florCantores = ["B"];

    const legales = accionesLegales(e, "U");
    expect(legales).not.toContain("cantar_flor" as never);
    expect(legales).toContain("cantar_envido");
  });

  it("rechaza cantar_flor si llega desde un cliente viejo", () => {
    const e = estado1v1();
    const r = aplicarAccion(e, {
      tipo: "cantar_flor",
      jugadorId: "U"
    } as any);

    expect(r.ok).toBe(false);
    expect(r.error).toBe("Acción desconocida.");
  });
});
