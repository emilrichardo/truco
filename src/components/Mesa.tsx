"use client";
import { useState } from "react";
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
  // Toggle para "espiar" las cartas del compañero (solo en 2v2). Por defecto
  // boca abajo; al tocar se da vuelta para verlas. Click otra vez la oculta.
  const [verCompañero, setVerCompañero] = useState(false);

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
        const esYoFlag = j.id === miId;
        // En 2v2, el compañero es del mismo equipo y NO soy yo.
        const esCompañero =
          total === 4 && !esYoFlag && j.equipo === me.equipo;
        const cartasEnMano = estado.manoActual?.cartasPorJugador[j.id] || [];
        return (
          <PuestoJugador
            key={j.id}
            pos={pos}
            jugador={j}
            esTurno={!!esTurno}
            esYo={esYoFlag}
            esCompañero={esCompañero}
            cartasEnMano={cartasEnMano}
            mostrarCompañero={verCompañero}
            onToggleCompañero={() => setVerCompañero((v) => !v)}
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
 *  Avatar contra el borde de la mesa, cartas extendiéndose hacia el centro.
 *  Debajo del avatar mostramos la "mano oculta" (cartas que aún no jugó),
 *  cara abajo. Si es mi compañero (2v2), tocando se dan vuelta. */
function PuestoJugador({
  pos,
  jugador,
  esTurno,
  esYo,
  esCompañero,
  cartasEnMano,
  mostrarCompañero,
  onToggleCompañero,
  jugadas,
  numeroDeBaza
}: {
  pos: Posicion;
  jugador: Jugador;
  esTurno: boolean;
  esYo: boolean;
  esCompañero: boolean;
  cartasEnMano: Carta[];
  mostrarCompañero: boolean;
  onToggleCompañero: () => void;
  jugadas: JugadaEnMesa[];
  numeroDeBaza: number;
}) {
  const cartasOcultas = !esCompañero || !mostrarCompañero;

  return (
    <div
      className={clsx(
        "absolute z-20 flex items-center gap-2 sm:gap-3",
        clasePosicionPuesto(pos),
        claseFlexPuesto(pos)
      )}
    >
      <div className="flex flex-col items-center gap-1">
        <JugadorPanel
          jugador={jugador}
          esTurno={esTurno}
          esYo={esYo}
          compacto
        />
        {/* Mini hand: solo para los demás (no yo), debajo del avatar */}
        {!esYo && cartasEnMano.length > 0 && (
          <ManoOculta
            cartas={cartasEnMano}
            ocultas={cartasOcultas}
            esCompañero={esCompañero}
            onTap={esCompañero ? onToggleCompañero : undefined}
          />
        )}
      </div>
      {jugadas.length > 0 && (
        <div
          className="relative flex-shrink-0"
          // Reservamos espacio para una carta + offset acumulado de los apilados.
          // sm card es ~80-96px ancho × 120-144px alto. Más 8px*(N-1) por offset.
          style={{
            width: `calc(6rem + ${(jugadas.length - 1) * 0.6}rem)`,
            height: `calc(8.5rem + ${(jugadas.length - 1) * 0.4}rem)`
          }}
        >
          {jugadas.map((j, i) => {
            // Cada carta sucesiva: leve desplazamiento diagonal hacia abajo-derecha
            // y rotación incremental para que el "pile" parezca natural.
            const dx = i * 10; // px hacia derecha
            const dy = i * 6;  // px hacia abajo
            const rot = (i - (jugadas.length - 1) / 2) * 6;
            return (
              <div
                key={`${j.bazaIdx}-${j.jugIdx}-${j.carta.id}`}
                className="absolute top-0 left-0 transition-transform"
                style={{
                  zIndex: i + 1,
                  transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
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

/** Mini-hand de cartas en mano (no jugadas todavía), boca abajo por default.
 *  Si es la del compañero, tocando se da vuelta y se ven las cartas. */
function ManoOculta({
  cartas,
  ocultas,
  esCompañero,
  onTap
}: {
  cartas: Carta[];
  ocultas: boolean;
  esCompañero: boolean;
  onTap?: () => void;
}) {
  return (
    <div
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      onClick={onTap}
      onKeyDown={(e) => {
        if (onTap && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onTap();
        }
      }}
      className={clsx(
        "flex -space-x-2 transition-transform",
        esCompañero && "cursor-pointer hover:scale-110",
        esCompañero && ocultas && "ring-2 ring-dorado/40 rounded p-0.5 parpadeo"
      )}
      title={
        esCompañero
          ? ocultas
            ? "Tocá para ver las cartas de tu compañero"
            : "Tocá para ocultarlas"
          : undefined
      }
    >
      {cartas.map((c, i) => (
        <div key={c.id} style={{ zIndex: i, transform: `rotate(${(i - 1) * 4}deg)` }}>
          <CartaEspanola carta={c} oculta={ocultas} tamanio="xs" />
        </div>
      ))}
    </div>
  );
}

/** Layout en esquinas:
 *   abajo    → bottom-right (yo)
 *   arriba   → top-left     (en 1v1: oponente; en 2v2: compañero diagonal)
 *   izquierda→ bottom-left  (rival, sólo 2v2)
 *   derecha  → top-right    (rival, sólo 2v2)
 * Las cartas tiradas se extienden hacia el centro de la mesa. */
function clasePosicionPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo":
      return "right-3 bottom-3";
    case "arriba":
      return "left-3 top-3";
    case "izquierda":
      return "left-3 bottom-3";
    case "derecha":
      return "right-3 top-3";
  }
}

/** Dirección del flex para que el avatar quede contra la esquina y las cartas
 * se extiendan en horizontal hacia el centro de la mesa. */
function claseFlexPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo": // br: avatar a la derecha, cartas a la izquierda
      return "flex-row-reverse";
    case "arriba": // tl: avatar a la izquierda, cartas a la derecha
      return "flex-row";
    case "izquierda": // bl: avatar a la izquierda, cartas a la derecha
      return "flex-row";
    case "derecha": // tr: avatar a la derecha, cartas a la izquierda
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
