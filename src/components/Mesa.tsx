"use client";
import { useCallback, useState } from "react";
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
 * Mesa con cartas en CRUZ: cada arm sale desde el centro hacia un borde,
 * sin pisarse con los demás. Los avatares viven aparte, en el borde de su
 * lado. Yo voy abajo a la derecha (BR del tablero), los rivales/compañero
 * en arriba/izquierda/derecha.
 */
export function Mesa({ estado, miId }: { estado: EstadoJuego; miId: string }) {
  // Toggle estable para "espiar" las cartas del compañero (solo en 2v2).
  // useCallback evita identidad nueva del handler en cada render (lo cual
  // no afectaba el state pero sí confundía al diff de React).
  const [verCompañero, setVerCompañero] = useState(false);
  const toggleCompañero = useCallback(
    () => setVerCompañero((v) => !v),
    []
  );

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

      {/* Avatares (avatar + mini-hand) de los DEMÁS jugadores. Mi avatar
       *  vive afuera de Mesa, en el wrapper del page, fijo a BR del screen. */}
      {orden.map((j, idx) => {
        if (j.id === miId) return null; // no rendero mi puesto acá
        const pos = posiciones[idx];
        if (!pos) return null;
        const esTurno = estado.manoActual?.turnoJugadorId === j.id;
        const esCompañero = total === 4 && j.equipo === me.equipo;
        const cartasEnMano =
          estado.manoActual?.cartasPorJugador[j.id] || [];
        return (
          <PuestoJugador
            key={j.id}
            pos={pos}
            jugador={j}
            esTurno={!!esTurno}
            esYo={false}
            esCompañero={esCompañero}
            cartasEnMano={cartasEnMano}
            mostrarCompañero={verCompañero}
            onToggleCompañero={toggleCompañero}
          />
        );
      })}

      {/* Cartas jugadas: cada jugador en su arm de la cruz desde el centro */}
      {orden.map((j, idx) => {
        const pos = posiciones[idx];
        if (!pos) return null;
        const jugadas = jugadasPorJugador.get(j.id) || [];
        if (jugadas.length === 0) return null;
        return (
          <CartasJugadas
            key={`cards-${j.id}`}
            pos={pos}
            jugadas={jugadas}
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

/** Avatar + mini-hand de un jugador, posicionado en su lado del tablero.
 *  Para sides (izq/der): mini-hand arriba, avatar abajo (orden inverso).
 *  Para mine (BR): solo avatar, sin mini-hand (mi mano está en PanelAcciones).
 *  Para arriba: avatar arriba y mini-hand debajo. */
function PuestoJugador({
  pos,
  jugador,
  esTurno,
  esYo,
  esCompañero,
  cartasEnMano,
  mostrarCompañero,
  onToggleCompañero
}: {
  pos: Posicion;
  jugador: Jugador;
  esTurno: boolean;
  esYo: boolean;
  esCompañero: boolean;
  cartasEnMano: Carta[];
  mostrarCompañero: boolean;
  onToggleCompañero: () => void;
}) {
  const cartasOcultas = !esCompañero || !mostrarCompañero;
  const sideMode = pos === "izquierda" || pos === "derecha";

  return (
    <div
      className={clsx(
        "absolute z-20 flex flex-col items-center gap-1",
        clasePosicionPuesto(pos),
        // Para sides: mini-hand arriba, avatar abajo
        sideMode && "flex-col-reverse"
      )}
    >
      <JugadorPanel
        jugador={jugador}
        esTurno={esTurno}
        esYo={esYo}
        compacto
      />
      {!esYo && cartasEnMano.length > 0 && (
        <ManoOculta
          cartas={cartasEnMano}
          ocultas={cartasOcultas}
          esCompañero={esCompañero}
          onTap={esCompañero ? onToggleCompañero : undefined}
        />
      )}
    </div>
  );
}

/** Cartas tiradas por un jugador, posicionadas en su arm de la cruz.
 *  El arm sale desde el centro de la mesa hacia el borde correspondiente,
 *  evitando que las cartas de distintos jugadores se superpongan. */
function CartasJugadas({
  pos,
  jugadas,
  numeroDeBaza
}: {
  pos: Posicion;
  jugadas: JugadaEnMesa[];
  numeroDeBaza: number;
}) {
  // Vector unitario del arm: hacia dónde se aleja del centro.
  const dirX =
    pos === "izquierda" ? -1 : pos === "derecha" ? 1 : 0;
  const dirY = pos === "arriba" ? -1 : pos === "abajo" ? 1 : 0;

  return (
    // Wrapper de 0×0 actúa como anchor en el centro del arm.
    <div className={clsx("absolute z-15", clasePosicionArm(pos))}>
      {jugadas.map((j, i) => {
        // Cada baza se aleja del centro siguiendo la dirección del arm,
        // con leve offset perpendicular para que no queden alineadas exactas.
        const dx = dirX * (i * 14) + (dirY !== 0 ? i * 6 : 0);
        const dy = dirY * (i * 14) + (dirX !== 0 ? i * 4 : 0);
        const rot = (i - (jugadas.length - 1) / 2) * 6;
        return (
          <div
            key={`${j.bazaIdx}-${j.jugIdx}-${j.carta.id}`}
            className="absolute top-0 left-0 transition-transform"
            style={{
              zIndex: i + 1,
              // -50% centra cada carta en el anchor; sumamos los offsets
              // direccionales para alejarnos del centro hacia el borde.
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`
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

/** Posición de la "estación" de cada jugador (avatar + mini-hand).
 *  Yo voy fijo a BR; el resto a su lado cardinal del tablero. */
function clasePosicionPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo":
      return "right-3 bottom-3";
    case "arriba":
      return "left-1/2 -translate-x-1/2 top-2";
    case "izquierda":
      return "left-2 top-1/2 -translate-y-1/2";
    case "derecha":
      return "right-2 top-1/2 -translate-y-1/2";
  }
}

/** Posición del arm de cartas jugadas — anclado al centro y desplazado un
 *  poco hacia el lado correspondiente. Ancho/alto reservado para evitar
 *  reflows cuando se acumulan bazas. */
function clasePosicionArm(pos: Posicion): string {
  switch (pos) {
    case "arriba":
      return "top-[28%] left-1/2 -translate-x-1/2";
    case "abajo":
      return "bottom-[28%] left-1/2 -translate-x-1/2";
    case "izquierda":
      return "left-[28%] top-1/2 -translate-y-1/2";
    case "derecha":
      return "right-[28%] top-1/2 -translate-y-1/2";
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
