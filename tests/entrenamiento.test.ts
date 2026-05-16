import { describe, expect, it } from "vitest";
import {
  aplicarDecisionEntrenamiento,
  crearEstadoEntrenamiento,
  crearSnapshotEntrenamiento
} from "@/lib/truco/entrenamiento";

describe("entrenamiento", () => {
  it("crea una sesión con actor, legales y texto plano", () => {
    const estado = crearEstadoEntrenamiento({ tamanio: 4, puntosObjetivo: 18 });
    const snapshot = crearSnapshotEntrenamiento(estado);
    expect(snapshot.actor).not.toBeNull();
    expect(snapshot.legales.length).toBeGreaterThan(0);
    expect(snapshot.textoPlano).toContain("Sugerencia:");
    expect(snapshot.textoPlano).toContain("Legales:");
  });

  it("aplica la sugerencia y devuelve el siguiente snapshot", () => {
    const estado = crearEstadoEntrenamiento({ tamanio: 2, puntosObjetivo: 18 });
    const snapshot = crearSnapshotEntrenamiento(estado);
    expect(snapshot.actor).not.toBeNull();
    expect(snapshot.sugerencia).not.toBeNull();
    const siguiente = aplicarDecisionEntrenamiento(
      snapshot.estado,
      snapshot.sugerencia!
    );
    expect(siguiente.estado.version).toBeGreaterThan(snapshot.estado.version);
    expect(siguiente.textoPlano).toContain("Sala:");
  });
});
