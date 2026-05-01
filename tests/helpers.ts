// Helpers para construir estados de prueba.
import { crearEstadoInicial, iniciarPartida, aplicarAccion } from "@/lib/truco/motor";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";

export function jugador(
  id: string,
  asiento: number,
  esBot: boolean,
  nombre = id
): Jugador {
  return {
    id,
    nombre,
    personaje: id.toLowerCase(),
    equipo: (asiento % 2) as 0 | 1,
    asiento,
    conectado: true,
    esBot
  };
}

/** Crea un estado 1v1 humano vs bot, con la partida iniciada. */
export function estado1v1(): EstadoJuego {
  const jugadores = [jugador("U", 0, false, "Yo"), jugador("B", 1, true, "Bot")];
  const e = crearEstadoInicial({
    salaId: "sala-test",
    jugadores,
    modo: "1v1",
    puntosObjetivo: 18,
    conFlor: false
  });
  iniciarPartida(e);
  return e;
}

/** Crea un estado 2v2 con el setup `cfg`. cfg[i] = "human" | "bot". */
export function estado2v2(
  cfg: ("human" | "bot")[] = ["human", "bot", "bot", "bot"]
): EstadoJuego {
  const jugadores = cfg.map((tipo, i) =>
    jugador(`P${i}`, i, tipo === "bot", `J${i}`)
  );
  const e = crearEstadoInicial({
    salaId: "sala-test",
    jugadores,
    modo: "2v2",
    puntosObjetivo: 18,
    conFlor: false
  });
  iniciarPartida(e);
  return e;
}

/** Aplica una acción y devuelve el estado nuevo (lanza si falla). */
export function aplicar(estado: EstadoJuego, accion: Accion): EstadoJuego {
  const r = aplicarAccion(estado, accion);
  if (!r.ok) throw new Error(`aplicarAccion falló: ${r.error}`);
  return r.estado;
}
