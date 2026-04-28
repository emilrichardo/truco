"use client";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { EstadoJuego, Jugador, Carta } from "@/lib/truco/types";
import { CartaEspanola } from "./CartaEspanola";
import { JugadorPanel } from "./JugadorPanel";
import { useHablando } from "@/lib/useHablando";

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
  const [verCompañero, setVerCompañero] = useState(false);
  const toggleCompañero = useCallback(
    () => setVerCompañero((v) => !v),
    []
  );
  // Auto-ocultar las cartas del compañero después de 5s para no espiar
  // permanentemente (y que el rival no vea por encima del hombro).
  useEffect(() => {
    if (!verCompañero) return;
    const t = window.setTimeout(() => setVerCompañero(false), 5000);
    return () => clearTimeout(t);
  }, [verCompañero]);

  const {
    hablandoId,
    hablandoKey,
    hablandoTexto,
    hablandoEvento,
    hablandoSticker
  } = useHablando(estado);

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

      {/* La meta info (Mano · Baza y Vale X) se renderea abajo para no pisar
       *  las cartas tiradas. */}
      <div className="absolute left-1/2 bottom-1 -translate-x-1/2 z-10 flex items-center gap-2 pointer-events-none">
        <div
          className="text-dorado/80 text-[10px] uppercase tracking-widest font-bold"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 6px rgba(0,0,0,0.5)" }}
        >
          Mano {estado.manoActual?.numero ?? 0} · Baza {numeroDeBaza}
        </div>
        {estado.manoActual && estado.manoActual.valorMano > 1 && (
          <div
            className="bg-azul-criollo text-crema font-bold px-2 py-0.5 rounded uppercase text-[10px] tracking-widest border border-dorado shadow-lg subtitulo-claim"
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
        const esMano = estado.manoActual?.manoJugadorId === j.id;
        const esCompañero = total === 4 && j.equipo === me.equipo;
        const cartasEnMano =
          estado.manoActual?.cartasPorJugador[j.id] || [];
        const esRival = total === 4 ? j.equipo !== me.equipo : true;
        const esQuienHabla = hablandoId === j.id;
        return (
          <PuestoJugador
            key={j.id}
            pos={pos}
            jugador={j}
            esTurno={!!esTurno}
            esMano={!!esMano}
            esYo={false}
            esRival={esRival}
            esCompañero={esCompañero}
            cartasEnMano={cartasEnMano}
            mostrarCompañero={verCompañero}
            onToggleCompañero={toggleCompañero}
            hablando={esQuienHabla}
            hablandoKey={esQuienHabla ? hablandoKey : null}
            hablandoTexto={esQuienHabla ? hablandoTexto : null}
            hablandoEvento={esQuienHabla ? hablandoEvento : null}
            hablandoSticker={esQuienHabla ? hablandoSticker : null}
          />
        );
      })}

      {/* Cartas jugadas: cada jugador en su arm de la cruz desde el centro */}
      {orden.map((j, idx) => {
        const pos = posiciones[idx];
        if (!pos) return null;
        const jugadas = jugadasPorJugador.get(j.id) || [];
        if (jugadas.length === 0) return null;
        // Para cada jugada calculamos si la carta ganó la baza
        // (ganadorEquipo === equipo del jugador). El render usa esto
        // para subir el z-index — la carta ganadora queda por encima
        // de las perdedoras dentro del pile del jugador.
        const jugadasConGanador = jugadas.map((jg) => {
          const baza = estado.manoActual?.bazas[jg.bazaIdx];
          const gano = !!baza && baza.ganadorEquipo === j.equipo;
          return { ...jg, gano };
        });
        return (
          <CartasJugadas
            key={`cards-${j.id}`}
            pos={pos}
            jugadas={jugadasConGanador}
            numeroDeBaza={numeroDeBaza}
          />
        );
      })}

      {totalJugadas === 0 && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-20 text-crema/85 italic text-xs subtitulo-claim z-10 parpadeo"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.55)" }}
        >
          Esperando primera carta…
        </div>
      )}
    </div>
  );
}

/** Avatar + mini-hand de un jugador, en una esquina del tablero. Layout
 *  vertical: avatar arriba, mini-hand horizontal debajo, más chiquita
 *  que el avatar. */
function PuestoJugador({
  pos,
  jugador,
  esTurno,
  esMano,
  esYo,
  esRival,
  esCompañero,
  cartasEnMano,
  mostrarCompañero,
  onToggleCompañero,
  hablando,
  hablandoKey,
  hablandoTexto,
  hablandoEvento,
  hablandoSticker
}: {
  pos: Posicion;
  jugador: Jugador;
  esTurno: boolean;
  esMano: boolean;
  esYo: boolean;
  esRival?: boolean;
  esCompañero: boolean;
  cartasEnMano: Carta[];
  mostrarCompañero: boolean;
  onToggleCompañero: () => void;
  hablando?: boolean;
  hablandoKey?: string | null;
  hablandoTexto?: string | null;
  hablandoEvento?: import("@/lib/truco/types").CategoriaEvento | null;
  hablandoSticker?: string | null;
}) {
  const cartasOcultas = !esCompañero || !mostrarCompañero;
  const alineacion =
    pos === "arriba" || pos === "izquierda" ? "items-start" : "items-end";
  // Lado de la burbuja: que apunte hacia adentro (centro de la mesa) para
  // que el rabito quede pegado a la foto y el texto se lea sobre el tapete.
  const ladoBurbuja: "izquierda" | "derecha" | "arriba" | "abajo" =
    pos === "arriba"
      ? "abajo"
      : pos === "abajo"
        ? "arriba"
        : pos === "izquierda"
          ? "derecha"
          : "izquierda";

  return (
    <div
      className={clsx(
        "absolute z-20 flex flex-col gap-1",
        alineacion,
        clasePosicionPuesto(pos)
      )}
    >
      <JugadorPanel
        jugador={jugador}
        esTurno={esTurno}
        esMano={esMano}
        esYo={esYo}
        esRival={esRival}
        compacto
        hablando={hablando}
        hablandoKey={hablandoKey}
        hablandoTexto={hablandoTexto}
        hablandoEvento={hablandoEvento}
        hablandoSticker={hablandoSticker}
        ladoBurbuja={ladoBurbuja}
      />
      {!esYo && cartasEnMano.length > 0 && (
        <ManoOculta
          cartas={cartasEnMano}
          ocultas={cartasOcultas}
          esCompañero={esCompañero}
          onTap={esCompañero ? onToggleCompañero : undefined}
          posReparto={pos}
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
  jugadas: (JugadaEnMesa & { gano: boolean })[];
  numeroDeBaza: number;
}) {
  // Cada cuadrante apunta a la esquina del avatar correspondiente.
  // arriba → TL, abajo → BR, izquierda → BL, derecha → TR.
  const dirX = pos === "arriba" || pos === "izquierda" ? -1 : 1;
  const dirY = pos === "arriba" || pos === "derecha" ? -1 : 1;
  // Inclinación base sutil: cada carta apunta hacia su dueño. Cards en el
  // lado izquierdo (TL/BL) inclinan negativo (top hacia la izq); en el
  // derecho (TR/BR) inclinan positivo.
  const rotBase = pos === "arriba" || pos === "izquierda" ? -12 : 12;

  return (
    // Sin z-index en el wrapper — antes z-15 creaba un stacking context
    // por jugador y los z-index internos no podían comparar entre cartas
    // de distintos jugadores. Ahora los hijos comparten el stacking
    // context del padre (Mesa) y la carta ganadora de la baza queda por
    // encima de las cartas perdedoras de la MISMA baza, sin importar de
    // qué jugador sean.
    <div className={clsx("absolute", clasePosicionArm(pos))}>
      {jugadas.map((j, i) => {
        // Cartas sucesivas se desplazan un poco hacia la esquina del jugador.
        const dx = dirX * i * 12;
        const dy = dirY * i * 8;
        // Rotación base + variación leve por baza para que no queden idénticas.
        const rot = rotBase + (i - (jugadas.length - 1) / 2) * 4;
        // z-index por capas:
        //   - Cada baza tiene su propio rango (baza 0: 100s, 1: 200s, 2: 300s).
        //   - La carta ganadora DENTRO de su baza suma +50 para quedar
        //     por encima de las perdedoras de esa misma baza.
        //   - La baza más nueva siempre queda arriba de las viejas.
        const zIndex = (j.bazaIdx + 1) * 100 + (j.gano ? 50 : 0);
        const esUltimaBaza = j.bazaIdx === numeroDeBaza - 1;
        return (
          <div
            key={`${j.bazaIdx}-${j.jugIdx}-${j.carta.id}`}
            className="absolute top-0 left-0 transition-transform"
            style={{
              zIndex,
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rot}deg)`
            }}
          >
            <CartaEspanola
              carta={j.carta}
              tamanio="md"
              resaltada={esUltimaBaza}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Mini-hand de cartas en mano (no jugadas todavía), boca abajo por default.
 *  Si es la del compañero, tocando se da vuelta y se ven las cartas.
 *  Cada carta entra con animación de reparto desde el centro de la mesa. */
function ManoOculta({
  cartas,
  ocultas,
  esCompañero,
  onTap,
  posReparto
}: {
  cartas: Carta[];
  ocultas: boolean;
  esCompañero: boolean;
  onTap?: () => void;
  posReparto?: Posicion;
}) {
  const offsets = repartoOffset(posReparto);
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
        "flex -space-x-3 transition-transform",
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
        <div
          key={c.id}
          style={{ zIndex: i, transform: `rotate(${(i - 1) * 3}deg)` }}
        >
          <div
            className="reparto-anim"
            style={
              {
                "--reparto-from-x": offsets.x,
                "--reparto-from-y": offsets.y,
                "--reparto-delay": `${i * 90}ms`
              } as React.CSSProperties
            }
          >
            <CartaEspanola carta={c} oculta={ocultas} tamanio="xs" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Offset desde donde "vuela" cada carta hacia su destino, según en qué
 *  esquina está el puesto. Como el centro está en el medio del tablero,
 *  para un puesto en TL la carta viene desde abajo-derecha (offset +X +Y). */
function repartoOffset(pos?: Posicion): { x: string; y: string } {
  switch (pos) {
    case "arriba":    return { x: "300%", y: "300%" };  // viene desde BR
    case "abajo":     return { x: "-300%", y: "-300%" }; // viene desde TL
    case "izquierda": return { x: "300%", y: "-300%" };  // viene desde TR
    case "derecha":   return { x: "-300%", y: "300%" };  // viene desde BL
    default:          return { x: "0", y: "300%" };
  }
}

/** Posición del puesto pegado a la esquina (inset 2 = 0.5rem). Antes
 *  estaba a 2rem del borde y le robaba mucho espacio al tapete. */
function clasePosicionPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo":
      return "right-2 bottom-2"; // (no se usa: yo voy por MiAvatarBR)
    case "arriba":
      return "left-2 top-2"; // top-left
    case "izquierda":
      return "left-2 bottom-2"; // bottom-left (rival 2v2)
    case "derecha":
      return "right-2 top-2"; // top-right (rival 2v2)
  }
}

/** Anchor del pile de cartas jugadas en cruz cardinal. Cada arm tiene un
 *  leve desplazamiento hacia la esquina del dueño:
 *    - top arm  (arriba)    → desplazado a la izquierda (avatar TL)
 *    - bottom arm (abajo)   → desplazado a la derecha (yo en BR)
 *    - left arm (izquierda) → desplazado hacia abajo (avatar BL)
 *    - right arm (derecha)  → desplazado hacia arriba (avatar TR)
 *  Así cada pila queda visualmente más cerca de su jugador sin perder la
 *  forma de cruz. */
function clasePosicionArm(pos: Posicion): string {
  switch (pos) {
    case "arriba":
      return "top-[28%] left-[38%]"; // arm vertical superior, sesgado a izq
    case "abajo":
      return "bottom-[28%] right-[44%]"; // arm vertical inferior, levemente sesgado a der
    case "izquierda":
      return "left-[28%] bottom-[38%]"; // arm horizontal izq, sesgado abajo
    case "derecha":
      return "right-[28%] top-[38%]"; // arm horizontal der, sesgado arriba
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
