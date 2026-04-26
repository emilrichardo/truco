"use client";
import clsx from "clsx";
import type { EstadoJuego, Jugador } from "@/lib/truco/types";
import { CartaEspanola } from "./CartaEspanola";
import { JugadorPanel } from "./JugadorPanel";

/**
 * Distribuye los jugadores alrededor del tapete. El "yo" siempre abajo.
 * Posiciones: bottom, top (1v1), o bottom/right/top/left (2v2).
 */
export function Mesa({ estado, miId }: { estado: EstadoJuego; miId: string }) {
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me) return null;
  const orden = ordenAlrededorDeMesa(estado.jugadores, me);
  const total = estado.jugadores.length;

  // Mapeo de posiciones según total de jugadores. orden[0] = yo (abajo).
  const posiciones: Record<number, string> = {};
  if (total === 2) {
    posiciones[0] = "abajo";
    posiciones[1] = "arriba";
  } else if (total === 4) {
    posiciones[0] = "abajo";
    posiciones[1] = "izquierda";
    posiciones[2] = "arriba";
    posiciones[3] = "derecha";
  }

  const baza = estado.manoActual?.bazas[estado.manoActual.bazas.length - 1];
  const numeroDeBaza = estado.manoActual?.bazas.length || 0;

  return (
    <div className="relative w-full max-w-5xl mx-auto" style={{ minHeight: 520 }}>
      <div className="tapete-table absolute inset-4 md:inset-8 z-0" />
      <div className="relative z-10 grid grid-rows-[auto_1fr_auto] grid-cols-[auto_1fr_auto] gap-2 h-[520px] p-6 md:p-10">
        {/* Arriba */}
        <div className="row-start-1 col-start-2 flex justify-center">
          {renderJugador(orden, posiciones, "arriba", estado, miId, true)}
        </div>
        {/* Izquierda */}
        <div className="row-start-2 col-start-1 flex items-center">
          {renderJugador(orden, posiciones, "izquierda", estado, miId, true)}
        </div>
        {/* Centro: cartas jugadas */}
        <div className="row-start-2 col-start-2 flex flex-col items-center justify-center gap-3">
          <div className="text-cream/70 text-[10px] uppercase tracking-widest">
            Mano {estado.manoActual?.numero ?? 0} · Baza {numeroDeBaza}
          </div>
          <div className="flex gap-3 flex-wrap justify-center max-w-md">
            {baza?.jugadas.map((j, i) => {
              const jugador = estado.jugadores.find((x) => x.id === j.jugadorId);
              return (
                <div key={i} className="flex flex-col items-center text-cream/80">
                  <CartaEspanola carta={j.carta} pequena />
                  <span className="text-[10px] mt-1">{jugador?.nombre}</span>
                </div>
              );
            })}
            {!baza?.jugadas.length && (
              <span className="text-cream/40 italic text-sm">
                Esperando que tiren la primera carta…
              </span>
            )}
          </div>
          {estado.manoActual && estado.manoActual.valorMano > 1 && (
            <div className="bg-truco-red/80 text-cream font-display px-3 py-1 rounded uppercase text-xs tracking-wider">
              Vale {estado.manoActual.valorMano}
            </div>
          )}
        </div>
        {/* Derecha */}
        <div className="row-start-2 col-start-3 flex items-center">
          {renderJugador(orden, posiciones, "derecha", estado, miId, true)}
        </div>
        {/* Abajo (yo): se renderiza en otro panel */}
        <div className="row-start-3 col-start-2 flex justify-center">
          {renderJugador(orden, posiciones, "abajo", estado, miId, false)}
        </div>
      </div>
    </div>
  );
}

function renderJugador(
  orden: Jugador[],
  pos: Record<number, string>,
  posicion: string,
  estado: EstadoJuego,
  miId: string,
  ocultas: boolean
) {
  const idx = Object.keys(pos).find((k) => pos[+k] === posicion);
  if (idx === undefined) return null;
  const jugador = orden[+idx];
  if (!jugador) return null;
  const esTurno = estado.manoActual?.turnoJugadorId === jugador.id;
  const cantidad = estado.manoActual?.cartasPorJugador[jugador.id]?.length ?? 0;
  return (
    <JugadorPanel
      jugador={jugador}
      esTurno={!!esTurno}
      esYo={jugador.id === miId}
      cartasOcultas={ocultas}
      cantidadCartas={cantidad}
    />
  );
}

function ordenAlrededorDeMesa(jugadores: Jugador[], yo: Jugador): Jugador[] {
  const orden: Jugador[] = [];
  const total = jugadores.length;
  for (let i = 0; i < total; i++) {
    const asiento = (yo.asiento + i) % total;
    orden.push(jugadores.find((j) => j.asiento === asiento)!);
  }
  return orden;
}
