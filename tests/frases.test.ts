import { describe, expect, it } from "vitest";
import { FRASES } from "@/lib/truco/frases";
import fs from "node:fs";
import path from "node:path";

const VOCES = ["lalo", "juan", "manuel", "agustin"] as const;

describe("frases del truco", () => {
  it("rechazar envido/truco siempre usa no_quiero y nunca paso", () => {
    for (const frase of FRASES.no_quiero) {
      expect(frase.toLowerCase()).not.toMatch(/\bpaso\b/);
      expect(frase.toLowerCase()).toContain("no quiero");
    }
  });

  it("cada frase reproducible tiene audio para cada voz", () => {
    for (const [canto, frases] of Object.entries(FRASES)) {
      for (const voz of VOCES) {
        for (let i = 1; i <= frases.length; i++) {
          const archivo = path.join(
            process.cwd(),
            "public",
            "audio",
            "voces",
            voz,
            canto,
            `${String(i).padStart(2, "0")}.mp3`
          );
          expect(fs.existsSync(archivo), `${voz}/${canto}/${i}`).toBe(true);
        }
      }
    }
  });
});
