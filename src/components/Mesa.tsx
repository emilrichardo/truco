"use client";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import type { EstadoJuego, Jugador, Carta } from "@/lib/truco/types";
import { jerarquia } from "@/lib/truco/cartas";
import { CartaEspanola } from "./CartaEspanola";
import { JugadorPanel } from "./JugadorPanel";
import { useHablando } from "@/lib/useHablando";
import { ICONOS_COMPANERO, ORDENES_COMPANERO } from "@/lib/chatRapido";
import { urlPersonaje } from "@/data/jugadores";

type Posicion =
  | "abajo-izquierda"
  | "derecha-medio"
  | "arriba-derecha"
  | "arriba-izquierda";

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
export function Mesa({
  estado,
  miId,
  enviarChat
}: {
  estado: EstadoJuego;
  miId: string;
  enviarChat?: (m: {
    texto?: string;
    reaccion?: string;
    sticker?: string;
    destinatarioId?: string;
  }) => void;
}) {
  // Toggle estable para "espiar" las cartas del compañero (solo en 2v2).
  const [verCompañero, setVerCompañero] = useState(false);
  const [panelCompañero, setPanelCompañero] = useState<{
    jugador: Jugador;
    pos: Posicion;
  } | null>(null);
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

  // Layout asimétrico pedido por el diseño:
  //   yo (idx 0) → BL
  //   siguiente (idx 1) → mid-right
  //   compañero (idx 2 en 2v2) → TR
  //   último rival (idx 3 en 2v2) → TL
  // Para 1v1 dejamos al rival diagonal opuesto (TR) para balancear.
  const posiciones: Record<number, Posicion> = {};
  if (total === 2) {
    posiciones[0] = "abajo-izquierda";
    posiciones[1] = "arriba-derecha";
  } else if (total === 4) {
    posiciones[0] = "abajo-izquierda";
    posiciones[1] = "derecha-medio";
    posiciones[2] = "arriba-derecha";
    posiciones[3] = "arriba-izquierda";
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
      {/* Tapete + cartas tiradas en plano 2D. Avatares y mini-manos quedan
       * afuera para conservar la UI sin deformaciones. */}
      <div className="absolute inset-0">
        <div className="absolute inset-1 sm:inset-2 tapete" />
        {/* Cartas jugadas: cada jugador en su arm desde el centro */}
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
      </div>

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
            onMensajeCompañero={
              esCompañero && enviarChat
                ? () => setPanelCompañero({ jugador: j, pos })
                : undefined
            }
            hablando={esQuienHabla}
            hablandoKey={esQuienHabla ? hablandoKey : null}
            hablandoTexto={esQuienHabla ? hablandoTexto : null}
            hablandoEvento={esQuienHabla ? hablandoEvento : null}
            hablandoSticker={esQuienHabla ? hablandoSticker : null}
          />
        );
      })}

      {panelCompañero && enviarChat && (
        <PanelMensajeCompañero
          jugador={panelCompañero.jugador}
          pos={panelCompañero.pos}
          onCerrar={() => setPanelCompañero(null)}
          onEnviar={(m) => {
            enviarChat({
              ...m,
              destinatarioId: panelCompañero.jugador.id
            });
            setPanelCompañero(null);
          }}
        />
      )}

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
  onMensajeCompañero,
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
  onMensajeCompañero?: () => void;
  hablando?: boolean;
  hablandoKey?: string | null;
  hablandoTexto?: string | null;
  hablandoEvento?: import("@/lib/truco/types").CategoriaEvento | null;
  hablandoSticker?: string | null;
}) {
  const cartasOcultas = !esCompañero || !mostrarCompañero;
  const enLadoIzquierdo =
    pos === "abajo-izquierda" || pos === "arriba-izquierda";
  const enLadoSuperior =
    pos === "arriba-derecha" || pos === "arriba-izquierda";
  // Alineación interna: items-start si el puesto vive contra el borde
  // izquierdo (avatar+nombre crecen hacia el centro); items-end si vive
  // contra el borde derecho.
  const alineacion = enLadoIzquierdo ? "items-start" : "items-end";
  // Nombre del lado interior de la pantalla: si el avatar está sobre el
  // borde izq, el pill va a la derecha del avatar. Y al revés.
  const ladoNombre: "izquierda" | "derecha" = enLadoIzquierdo
    ? "derecha"
    : "izquierda";
  // Burbuja arriba/abajo del avatar para no pisar el pill del nombre
  // (que está al costado interior).
  const ladoBurbuja: "izquierda" | "derecha" | "arriba" | "abajo" =
    enLadoSuperior ? "abajo" : "arriba";
  // Anclaje horizontal de la burbuja: si el avatar vive contra el borde
  // izq, la burbuja crece hacia la derecha (anclada a izq). Y al revés.
  // Antes la burbuja se centraba sobre el avatar y se cortaba contra el
  // borde de la pantalla cuando el puesto vivía en una esquina.
  const alineacionBurbujaH: "izq" | "der" = enLadoIzquierdo ? "izq" : "der";

  // Para los puestos de abajo, la mini-hand va ARRIBA del avatar
  // (flex-col-reverse) — si no, se sale por debajo de la pantalla cuando
  // el avatar vive contra el borde inferior.
  const enLadoInferior =
    pos === "abajo-izquierda" || pos === "derecha-medio";
  const direccionFlex = enLadoInferior ? "flex-col-reverse" : "flex-col";

  return (
    // z-[500] para que el puesto (avatar + burbuja) quede por encima de
    // las cartas tiradas. Las cartas usan zIndex inline 100..314 con stacking
    // context propio, así que un z-20 dejaba el avatar atrás del mazo.
    <div
      className={clsx(
        "absolute z-[500] flex gap-1",
        direccionFlex,
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
        ladoNombre={ladoNombre}
        alineacionBurbujaH={alineacionBurbujaH}
        onAvatarClick={onMensajeCompañero}
        avatarTitle={
          onMensajeCompañero
            ? `Mandarle una seña a ${jugador.nombre}`
            : undefined
        }
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

function PanelMensajeCompañero({
  jugador,
  pos,
  onEnviar,
  onCerrar
}: {
  jugador: Jugador;
  pos: Posicion;
  onEnviar: (m: { texto?: string; reaccion?: string }) => void;
  onCerrar: () => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <div className="absolute inset-0 z-[90] pointer-events-none">
      <div
        className={clsx(
          "absolute pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] rounded-md border border-dorado/60 bg-carbon/95 shadow-2xl backdrop-blur-sm p-2",
          clasePosicionPanelCompañero(pos)
        )}
      >
        <div className="flex items-center gap-2 pb-2 border-b border-border/70">
          <img
            src={urlPersonaje(jugador.personaje)}
            alt=""
            className="w-9 h-9 rounded-md object-cover object-top border border-dorado/60"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[9px] uppercase tracking-widest text-dorado font-bold">
              Seña rápida
            </div>
            <div className="text-xs text-crema truncate">{jugador.nombre}</div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1 mt-2">
          {ORDENES_COMPANERO.map((o) => (
            <button
              key={o.texto}
              type="button"
              onClick={() => onEnviar({ texto: `${o.icono} ${o.texto}` })}
              className="flex items-center gap-1.5 rounded border border-dorado/30 bg-surface/80 px-2 py-1.5 text-left text-[10px] uppercase tracking-wider text-crema hover:bg-dorado/15 transition font-bold"
            >
              <span className="text-sm leading-none">{o.icono}</span>
              <span className="truncate">{o.texto}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {ICONOS_COMPANERO.map((icono) => (
            <button
              key={icono}
              type="button"
              onClick={() => onEnviar({ reaccion: icono })}
              className="text-xl active:scale-90 transition px-1.5 hover:bg-dorado/15 rounded border border-dorado/20"
              title={`Enviar ${icono}`}
            >
              {icono}
            </button>
          ))}
        </div>

        <form
          className="flex gap-1 mt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!texto.trim()) return;
            onEnviar({ texto: texto.trim() });
            setTexto("");
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Mensaje privado…"
            className="input-marca flex-1"
            maxLength={200}
            autoFocus
          />
          <button className="btn btn-primary !px-3 !py-2 text-xs">
            Seña
          </button>
        </form>
      </div>
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
  // Las cartas sucesivas se desplazan hacia la esquina del dueño.
  const enLadoIzquierdo =
    pos === "abajo-izquierda" || pos === "arriba-izquierda";
  const enLadoSuperior =
    pos === "arriba-derecha" || pos === "arriba-izquierda";
  const dirX = enLadoIzquierdo ? -1 : 1;
  const dirY = enLadoSuperior ? -1 : 1;
  // Inclinación: cards del lado izq inclinan -12, del lado der +12.
  const rotBase = enLadoIzquierdo ? -12 : 12;

  return (
    // Sin transformaciones de cámara propias: las pilas quedan en el mismo
    // plano 2D del tapete, con rotación individual para dar naturalidad.
    <div className={clsx("absolute", clasePosicionArm(pos))}>
      {jugadas.map((j, i) => {
        // Cartas sucesivas se desplazan un poco hacia la esquina del jugador.
        const dx = dirX * i * 12;
        const dy = dirY * i * 8;
        // Rotación base + variación leve por baza para que no queden idénticas.
        const rot = rotBase + (i - (jugadas.length - 1) / 2) * 4;
        // z-index por capas:
        //   - Cada baza tiene su propio rango (baza 0: 100s, 1: 200s, 2: 300s).
        //   - Dentro de la misma baza manda la jerarquía real de Truco:
        //     un 3 debe tapar a un 11, aunque la baza ya haya cerrado.
        //   - La baza más nueva sigue quedando arriba de las viejas.
        const zIndex = (j.bazaIdx + 1) * 100 + jerarquia(j.carta);
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
              tamanio="lg"
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

/** Offset desde donde "vuela" cada carta hacia su destino. Cada cuadrante
 *  tiene como origen la esquina opuesta del tablero. */
function repartoOffset(pos?: Posicion): { x: string; y: string } {
  switch (pos) {
    case "abajo-izquierda":  return { x: "300%", y: "-300%" };  // viene desde TR
    case "derecha-medio":    return { x: "-300%", y: "0%" };    // viene desde la izq
    case "arriba-derecha":   return { x: "-300%", y: "300%" };  // viene desde BL
    case "arriba-izquierda": return { x: "300%", y: "300%" };   // viene desde BR
    default:                 return { x: "0", y: "300%" };
  }
}

/** Posición del puesto pegada a su esquina con un poco de aire. El
 *  "derecha-medio" en realidad ahora vive abajo-derecha (el usuario
 *  pidió que baje "mucho más" — los 4 puestos quedan en las 4 esquinas
 *  de la pantalla, simétricos). El nombre se mantiene por compat. */
function clasePosicionPuesto(pos: Posicion): string {
  switch (pos) {
    case "abajo-izquierda":  return "left-4 bottom-4";
    // Cholo (BR) un poco más arriba que el rincón pleno — el usuario
    // pidió que suba "un poco más" porque se sentía muy abajo.
    case "derecha-medio":    return "right-4 bottom-[12%]";
    case "arriba-derecha":   return "right-4 top-4";
    case "arriba-izquierda": return "left-4 top-4";
  }
}

function clasePosicionPanelCompañero(pos: Posicion): string {
  switch (pos) {
    case "arriba-derecha":
      return "right-4 top-28";
    case "arriba-izquierda":
      return "left-4 top-28";
    case "derecha-medio":
      return "right-4 bottom-[30%]";
    case "abajo-izquierda":
      return "left-4 bottom-32";
  }
}

/** Anchor de la pila de cartas tiradas: 4 cuadrantes cerca del centro pero
 *  con aire vertical. Arriba/abajo deben rozarse en las esquinas, no
 *  montarse como una sola pila. */
function clasePosicionArm(pos: Posicion): string {
  switch (pos) {
    case "abajo-izquierda":  return "bottom-[31%] left-[35%]";
    case "derecha-medio":    return "bottom-[31%] right-[35%]";
    case "arriba-derecha":   return "top-[31%] right-[35%]";
    case "arriba-izquierda": return "top-[31%] left-[35%]";
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
