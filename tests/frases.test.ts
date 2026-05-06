import { describe, expect, it } from "vitest";
import { FRASES } from "@/lib/truco/frases";

describe("frases del truco", () => {
  it("rechazar envido/truco siempre usa no_quiero y nunca paso", () => {
    for (const frase of FRASES.no_quiero) {
      expect(frase.toLowerCase()).not.toMatch(/\bpaso\b/);
      expect(frase.toLowerCase()).toContain("no quiero");
    }
  });
});
