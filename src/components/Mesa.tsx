"use client";
import clsx from "clsx";
import type { EstadoJuego, Jugador, Carta } from "@/lib/truco/types";
import { CartaEspanola } from "./CartaEspanola";
import { JugadorPanel } from "./JugadorPanel";

type Posicion = "arriba" | "abajo" | "izquierda" | "derecha";

type JugadaEnMesa = {
  jugadorId: string;
  carta: Carta;
  bazaIdx: number;
  jugIdx: number;
};

/**
 * Mesa: cada jugador es un "puesto" (avatar + cartas que tiró), agrupado con
 * flex y posicionado absoluto en uno de los cuatro costados. El avatar siempre
 * pegado al borde, las cartas extendiéndose hacia el centro. Yo voy abajo.
 */
export function Mesa({ estado, miId }: { estado: EstadoJuego; miId: string }) {
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me) return null;
  const orden = ordenAlrededorDeMesa(estado.jugadores, me);
  const total = estado.jugadores.length;

  const posiciones: Record<number, Posicion> = {};
  if (total === 2) {
    posiciones[0] = "abajo";
    posiciones[1] = "arriba";
  } else if (total === 4) {
    posiciones[0] = "abajo";
    posiciones[1] = "izquierda";
    posiciones[2] = "arriba";
    posiciones[3] = "derecha";
  }

  const numeroDeBaza = estado.manoActual?.bazas.length || 0;
  const jugadasPorJugador = new Map<string, JugadaEnMesa[]>();
  estado.manoActual?.bazas.forEach((b, bIdx) => {
    b.jugadas.forEach((j, jIdx) => {
      const arr = jugadasPorJugador.get(j.jugadorId) || [];
      arr.push({ ...j, bazaIdx: bIdx, jugIdx: jIdx });
      jugadasPorJugador.set(j.jugadorId, arr);
    });
  });

  const totalJugadas = Array.from(jugadasPorJugador.values()).reduce(
    (acc, l) => acc + l.length,
    0
  );

  return (
    <div className="relative w-full h-full">
      <div className="absolute inset-1 sm:inset-2 tapete" />

      {/* Centro: sol criollo + meta info */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 pointer-events-none">
        <div className="text-dorado/15 text-6xl leading-none -mb-1 select-none">
          ☀
        </div>
        <div className="text-crema/40 text-[10px] uppercase tracking-widest font-bold">
          Mano {estado.manoActual?.numero ?? 0} · Baza {numeroDeBaza}
        </div>
        {estado.manoActual && estado.manoActual.valorMano > 1 && (
          <div
            className="bg-azul-criollo text-crema font-bold px-3 py-1 rounded uppercase text-[10px] tracking-widest border border-dorado shadow-lg subtitulo-claim mt-1"
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.4)" }}
          >
            Vale {estado.manoActual.valorMano}
          </div>
        )}
      </div>

      {/* Puestos por jugador */}
      {orden.map((j, idx) => {
        const pos = posiciones[idx];
        if (!pos) return null;
        const esTurno = estado.manoActual?.turnoJugadorId === j.id;
        return (
          <PuestoJugador
            key={j.id}
            pos={pos}
            jugador={j}
            esTurno={!!esTurno}
            esYo={j.id === miId}
            jugadas={jugadasPorJugador.get(j.id) || []}
            numeroDeBaza={numeroDeBaza}
          />
        );
      })}

      {totalJugadas === 0 && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-20 text-crema/40 italic text-xs subtitulo-claim z-10">
          Esperando primera carta…
        </div>
      )}
    </div>
  );
}

/** Puesto = avatar + cartas que ese jugador tiró, agrupados con flex.
 *  Avatar contra el borde de la mesa, cartas extendiéndose hacia el centro. */
function PuestoJugador({
  pos,
  jugador,
  esTurno,
  esYo,
  jugadas,
  numeroDeBaza
}: {
  pos: Posicion;
  jugador: Jugador;
  esTurno: boolean;
  esYo: boolean;
  jugadas: JugadaEnMesa[];
  numeroDeBaza: number;
}) {
  return (
    <div
      className={clsx(
        "absolute z-20 flex items-center gap-2 sm:gap-3",
        clasePosicionPuesto(pos),
        claseFlexPuesto(pos)
      )}
    >
      <JugadorPanel
        jugador={jugador}
        esTurno={esTurno}
        esYo={esYo}
        compacto
      />
      {jugadas.length > 0 && (
        <div className="flex flex-row -space-x-7 sm:-space-x-9">
          {jugadas.map((j, i) => {
            const offset = (i - (jugadas.length - 1) / 2) * 5;
            return (
              <div
                key={`${j.bazaIdx}-${j.jugIdx}-${j.carta.id}`}
                style={{
                  zIndex: i + 1,
                  transform: `rotate(${offset}deg)`
                }}
              >
                <CartaEspanola
                  carta={j.carta}
                  tamanio="sm"
                  resaltada={j.bazaIdx === numeroDeBaza - 1}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function clasePosicionPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo":
      return "left-1/2 -translate-x-1/2 bottom-2";
    case "arriba":
      return "left-1/2 -translate-x-1/2 top-2";
    case "izquierda":
      return "left-2 top-1/2 -translate-y-1/2";
    case "derecha":
      return "right-2 top-1/2 -translate-y-1/2";
  }
}

/** Dirección del flex para que el avatar quede contra el borde y las cartas
 * se extiendan hacia el centro de la mesa. */
function claseFlexPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo":
      // Avatar abajo, cartas arriba (hacia centro)
      return "flex-col-reverse";
    case "arriba":
      // Avatar arriba, cartas abajo
      return "flex-col";
    case "izquierda":
      // Avatar izquierda, cartas a la derecha
      return "flex-row";
    case "derecha":
      // Avatar derecha, cartas a la izquierda
      return "flex-row-reverse";
  }
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
