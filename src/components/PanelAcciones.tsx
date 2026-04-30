"use client";
import { useEffect, useRef, useState } from "react";
import type { Accion, EstadoJuego } from "@/lib/truco/types";
import { accionesLegales } from "@/lib/truco/motor";
import { CartaEspanola } from "./CartaEspanola";

export function PanelAcciones({
  estado,
  miId,
  enviar
}: {
  estado: EstadoJuego;
  miId: string;
  enviar: (a: Accion) => void;
}) {
  const me = estado.jugadores.find((j) => j.id === miId);
  if (!me || !estado.manoActual) return null;
  const mano = estado.manoActual;
  const misCartas = mano.cartasPorJugador[miId] || [];
  const legales = accionesLegales(estado, miId);

  const debeResponderEnvido =
    !!mano.envidoCantoActivo &&
    me.equipo === mano.envidoCantoActivo.equipoQueDebeResponder;
  const debeResponderTruco =
    !!mano.trucoCantoActivo &&
    me.equipo === mano.trucoCantoActivo.equipoQueDebeResponder;
  const esMiTurno = mano.turnoJugadorId === miId;
  const puedeJugarCarta =
    esMiTurno && !mano.envidoCantoActivo && !mano.trucoCantoActivo;
  // "El envido está primero": cuando me cantaron truco y todavía no se
  // resolvió el envido en la primera baza, puedo cortarlo cantando envido.
  // Lo computamos acá independiente de accionesLegales para que no se
  // pueda perder en builds stale/HMR — el motor también valida, así que
  // si el estado no lo permite la acción se rechaza sin efectos.
  const envidoEstaPrimero =
    debeResponderTruco &&
    !mano.envidoResuelto &&
    mano.bazas.length === 1 &&
    mano.bazas[0].jugadas.length < estado.jugadores.length;
  const puedo = (t: Accion["tipo"]) => {
    if (envidoEstaPrimero && (t === "cantar_envido" || t === "cantar_real_envido" || t === "cantar_falta_envido")) {
      return true;
    }
    return legales.includes(t);
  };

  // Orden local de las cartas en mano — se puede reordenar arrastrando.
  // Sincronizamos cuando el motor reparte una mano nueva (cambia el set
  // de IDs); mientras tanto preservamos el orden que el usuario eligió.
  const idsKey = misCartas
    .map((c) => c.id)
    .sort()
    .join(",");
  const [ordenLocal, setOrdenLocal] = useState<string[]>(() =>
    misCartas.map((c) => c.id)
  );
  // Sincronizamos ordenLocal cuando el motor reparte una mano nueva
  // (cambia el set de IDs). Saqué la animación de reparto previa porque
  // dejaba un salto raro al desactivarse a los 1.5s.
  useEffect(() => {
    setOrdenLocal(misCartas.map((c) => c.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Estado de arrastre. Una sola carta a la vez, registrada por id.
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const inicioPunteroRef = useRef<{ x: number; y: number } | null>(null);

  // UI optimista: en online, `enviar` es async — entre que solté la carta y
  // que el server confirma, la carta volvía a snap-back al abanico (con
  // z-index al fondo, lo que hacía que las cartas vecinas la pisaran).
  // Al ocultarla apenas la mandamos, la mesa "recibe" la carta al instante
  // como en solo. Cuando el motor confirma (idsKey cambia), limpiamos.
  const [cartasJugadas, setCartasJugadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    setCartasJugadas(new Set());
  }, [idsKey]);

  function onPointerDown(e: React.PointerEvent, cartaId: string) {
    if (!puedeJugarCarta) return;
    inicioPunteroRef.current = { x: e.clientX, y: e.clientY };
    setArrastrandoId(cartaId);
    setDelta({ x: 0, y: 0 });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!arrastrandoId || !inicioPunteroRef.current) return;
    setDelta({
      x: e.clientX - inicioPunteroRef.current.x,
      y: e.clientY - inicioPunteroRef.current.y
    });
  }

  function onPointerUp(e: React.PointerEvent, cartaId: string) {
    if (!arrastrandoId) return;
    const movX = delta.x;
    const movY = delta.y;
    const distancia = Math.hypot(movX, movY);
    setArrastrandoId(null);
    setDelta({ x: 0, y: 0 });
    inicioPunteroRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    // Tap / clic suelto: jugar la carta directamente (compatibilidad).
    if (distancia < 8) {
      setCartasJugadas((prev) => new Set(prev).add(cartaId));
      enviar({ tipo: "jugar_carta", jugadorId: miId, cartaId });
      return;
    }
    // Arrastre vertical hacia arriba con suficiente fuerza → tirar a la mesa.
    if (movY < -80) {
      setCartasJugadas((prev) => new Set(prev).add(cartaId));
      enviar({ tipo: "jugar_carta", jugadorId: miId, cartaId });
      return;
    }
    // Arrastre horizontal con poco vertical → reordenar en la mano. Se
    // calcula el desplazamiento entero por ancho de carta (~64px en
    // móvil con el solapado del abanico).
    if (Math.abs(movY) < 60 && Math.abs(movX) > 30) {
      const anchoSlot = 64;
      const idxActual = ordenLocal.indexOf(cartaId);
      if (idxActual >= 0) {
        const desplazamiento = Math.round(movX / anchoSlot);
        const idxNuevo = Math.max(
          0,
          Math.min(ordenLocal.length - 1, idxActual + desplazamiento)
        );
        if (idxNuevo !== idxActual) {
          const nuevoOrden = [...ordenLocal];
          nuevoOrden.splice(idxActual, 1);
          nuevoOrden.splice(idxNuevo, 0, cartaId);
          setOrdenLocal(nuevoOrden);
        }
      }
    }
    // En cualquier otro caso, snap-back a la posición original (transición
    // CSS hace el resto cuando seteamos delta a 0).
  }

  // Reordenamos las cartas según el orden local. Si el motor envía una
  // carta que no está en ordenLocal todavía (caso borde), la dejamos al
  // final. Excluimos las que mandamos jugar pero el server todavía no
  // confirma — así la mano "se vacía" al instante igual que en solo.
  const cartasOrdenadas = (() => {
    const porId = new Map(
      misCartas.filter((c) => !cartasJugadas.has(c.id)).map((c) => [c.id, c])
    );
    const visto = new Set<string>();
    const out = [] as typeof misCartas;
    for (const id of ordenLocal) {
      const c = porId.get(id);
      if (c) {
        out.push(c);
        visto.add(id);
      }
    }
    for (const c of misCartas) {
      if (!visto.has(c.id) && !cartasJugadas.has(c.id)) out.push(c);
    }
    return out;
  })();

  const total = cartasOrdenadas.length;
  const centro = (total - 1) / 2;

  return (
    <div className="px-2 py-2 relative">
      {/* Sutil borde dorado superior */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-dorado/40 to-transparent" />

      {/* Mis cartas en abanico — drag & drop: arrastrá hacia arriba para
       *  tirar a la mesa, o de lado para reordenar la mano. Tap simple
       *  sigue jugando la carta directo. pb-3 deja un colchón abajo
       *  para que las cartas con translateY positivo no se monten sobre
       *  los botones de acción y roben clicks. */}
      <div className="flex justify-center items-end mb-2 pb-3 min-h-[140px] sm:min-h-[170px]">
        {cartasOrdenadas.length === 0 ? (
          <span className="text-text-dim italic text-xs py-3 subtitulo-claim">
            {mano.fase === "terminada" ? "Repartiendo…" : "Sin cartas."}
          </span>
        ) : (
          cartasOrdenadas.map((c, i) => {
            const offset = i - centro;
            const rot = offset * 9;
            // Cartas exteriores ya no bajan — antes con translateY(8px)
            // se montaban sobre el área de los botones y robaban clicks.
            const dy = 0;
            const isDragging = arrastrandoId === c.id;
            // Cuando arrastro: usamos transform inline con delta del
            // puntero + un leve scale-up para que se sienta "agarrada".
            // Sin transición durante el arrastre (sigue al dedo 1:1).
            // Cuando suelto, transición de 200ms vuelve a la posición
            // del abanico (snap-back) o al nuevo slot (reordenado).
            const transform = isDragging
              ? `translate(${delta.x}px, ${delta.y}px) scale(1.06)`
              : `translateY(${dy}px) rotate(${rot}deg)`;
            return (
              <div
                key={c.id}
                className="fan-card"
                style={
                  {
                    marginLeft: i === 0 ? 0 : "-1.25rem",
                    zIndex: isDragging ? 100 : i + 1,
                    transform,
                    transition: isDragging
                      ? "none"
                      : "transform 200ms ease",
                    touchAction: "none"
                  } as React.CSSProperties
                }
                onPointerDown={(e) => onPointerDown(e, c.id)}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => onPointerUp(e, c.id)}
                onPointerCancel={(e) => onPointerUp(e, c.id)}
              >
                <CartaEspanola
                  carta={c}
                  jugable={puedeJugarCarta}
                  tamanio="sm"
                />
              </div>
            );
          })
        )}
      </div>

      {(debeResponderEnvido || debeResponderTruco) && (
        <div className="text-center subtitulo-claim text-dorado text-sm mb-2 parpadeo">
          ⚠ Te cantaron {debeResponderEnvido ? "envido" : "truco"}
        </div>
      )}

      {/* Botonera única en una sola fila con menús expandibles para
       *  Envido y Truco. Las opciones del menú se computan según el
       *  contexto (en tu turno vs. respondiendo a un canto del rival,
       *  envido está primero, etc.) — si una opción no es legal, no
       *  aparece. Cuando hay un solo item disponible, el tap dispara la
       *  acción directo sin abrir popover. */}
      <BotoneraMenu
        miId={miId}
        enviar={enviar}
        puedo={puedo}
        debeResponderEnvido={debeResponderEnvido}
        debeResponderTruco={debeResponderTruco}
      />

      {legales.length === 0 && estado.ganadorPartida === null && (
        <div className="text-center text-text-dim text-xs py-1 italic">
          Esperando…
        </div>
      )}
    </div>
  );
}

type Opcion = {
  tipo: Accion["tipo"];
  label: string;
  icono?: React.ReactNode;
};

/** Botonera única en una sola fila con menús dropdown para Envido y
 *  Truco. Cuando estás respondiendo a un canto del rival, también
 *  aparecen Quiero / No quiero como botones primarios. */
function BotoneraMenu({
  miId,
  enviar,
  puedo,
  debeResponderEnvido,
  debeResponderTruco
}: {
  miId: string;
  enviar: (a: Accion) => void;
  puedo: (t: Accion["tipo"]) => boolean;
  debeResponderEnvido: boolean;
  debeResponderTruco: boolean;
}) {
  const [menuAbierto, setMenuAbierto] = useState<"envido" | "truco" | null>(
    null
  );
  const refContenedor = useRef<HTMLDivElement>(null);

  // Cierra el menú si el contexto cambia (canto resuelto, turno cambia, etc.)
  useEffect(() => {
    setMenuAbierto(null);
  }, [debeResponderEnvido, debeResponderTruco]);

  // Cierra el menú al tocar afuera.
  useEffect(() => {
    if (!menuAbierto) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        refContenedor.current &&
        !refContenedor.current.contains(e.target as Node)
      ) {
        setMenuAbierto(null);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [menuAbierto]);

  const opcionesEnvido: Opcion[] = [];
  if (puedo("cantar_envido"))
    opcionesEnvido.push({ tipo: "cantar_envido", label: "Envido", icono: <IconoEnvido /> });
  if (puedo("cantar_real_envido"))
    opcionesEnvido.push({
      tipo: "cantar_real_envido",
      label: "Real envido",
      icono: <IconoRealEnvido />
    });
  if (puedo("cantar_falta_envido"))
    opcionesEnvido.push({
      tipo: "cantar_falta_envido",
      label: "Falta envido",
      icono: <IconoFaltaEnvido />
    });

  // Truco no necesita dropdown — solo una de [truco/retruco/vale4] es
  // legal a la vez según el estado del canto. Mostramos un único botón
  // con el label correspondiente.
  let cantoTruco: Opcion | null = null;
  if (puedo("cantar_truco"))
    cantoTruco = { tipo: "cantar_truco", label: "Truco", icono: <IconoCanto /> };
  else if (puedo("cantar_retruco"))
    cantoTruco = { tipo: "cantar_retruco", label: "Retruco", icono: <IconoCanto /> };
  else if (puedo("cantar_vale4"))
    cantoTruco = { tipo: "cantar_vale4", label: "Vale 4", icono: <IconoCanto /> };

  const disparar = (tipo: Accion["tipo"]) => {
    setMenuAbierto(null);
    enviar({ tipo, jugadorId: miId } as Accion);
  };

  return (
    <div
      ref={refContenedor}
      className="flex flex-wrap gap-1.5 justify-center"
    >
      {(debeResponderEnvido || debeResponderTruco) &&
        puedo("responder_quiero") && (
          <button
            className="btn btn-primary"
            onClick={() => disparar("responder_quiero")}
          >
            Quiero
          </button>
        )}
      {(debeResponderEnvido || debeResponderTruco) &&
        puedo("responder_no_quiero") && (
          <button
            className="btn btn-danger"
            onClick={() => disparar("responder_no_quiero")}
          >
            No quiero
          </button>
        )}

      {opcionesEnvido.length > 0 && (
        <BotonDropdown
          icono={<IconoEnvido />}
          label="Envido"
          opciones={opcionesEnvido}
          abierto={menuAbierto === "envido"}
          onToggle={() =>
            setMenuAbierto((m) => (m === "envido" ? null : "envido"))
          }
          onElegir={(t) => disparar(t)}
        />
      )}

      {puedo("cantar_flor") && (
        <button
          className="btn btn-primary"
          onClick={() => disparar("cantar_flor")}
          title="Tenés 3 cartas del mismo palo — flor"
        >
          🌼 Flor
        </button>
      )}

      {cantoTruco && (
        <button
          className="btn btn-primary"
          onClick={() => disparar(cantoTruco!.tipo)}
        >
          {cantoTruco.icono} {cantoTruco.label}
        </button>
      )}

      {!debeResponderEnvido && !debeResponderTruco && puedo("ir_al_mazo") && (
        <button className="btn" onClick={() => disparar("ir_al_mazo")}>
          <IconoMazo /> Mazo
        </button>
      )}
    </div>
  );
}

/** Botón con menú dropdown que se abre HACIA ARRIBA. Si hay una sola
 *  opción, el tap dispara la acción directo sin abrir popover (una
 *  alternativa más rápida cuando no hay ambigüedad). */
function BotonDropdown({
  icono,
  label,
  opciones,
  abierto,
  onToggle,
  onElegir,
  acentuado
}: {
  icono: React.ReactNode;
  label: string;
  opciones: Opcion[];
  abierto: boolean;
  onToggle: () => void;
  onElegir: (tipo: Accion["tipo"]) => void;
  acentuado?: boolean;
}) {
  const tieneVarias = opciones.length > 1;
  // Cuando queda una sola opción legal, mostramos el label/icono real de
  // esa opción (ej. "Falta envido") en vez del título genérico ("Envido").
  // Si no, el usuario ve "Envido" y tapea pero canta falta envido — confuso.
  const labelMostrado =
    tieneVarias || !opciones[0] ? label : opciones[0].label;
  const iconoMostrado =
    tieneVarias || !opciones[0] ? icono : opciones[0].icono ?? icono;
  const onTap = () => {
    if (tieneVarias) onToggle();
    else if (opciones.length === 1) onElegir(opciones[0].tipo);
  };
  return (
    <div className="relative">
      <button
        className={acentuado ? "btn btn-primary" : "btn"}
        onClick={onTap}
        aria-haspopup={tieneVarias ? "menu" : undefined}
        aria-expanded={tieneVarias ? abierto : undefined}
      >
        {iconoMostrado} {labelMostrado}
        {tieneVarias && <ChevronArriba />}
      </button>
      {abierto && tieneVarias && (
        <div
          role="menu"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-col gap-1 bg-carbon/95 backdrop-blur-sm border border-dorado/40 rounded-lg p-1 shadow-xl z-[600] min-w-[150px]"
        >
          {opciones.map((op) => (
            <button
              key={op.tipo}
              role="menuitem"
              className="btn whitespace-nowrap"
              onClick={() => onElegir(op.tipo)}
            >
              {op.icono} {op.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronArriba() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="10"
      height="10"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 15 12 9 18 15" />
    </svg>
  );
}

/** Megáfono para los cantos de truco — refuerza visualmente la idea de
 *  "gritarle al rival" sin meter color extra. */
function IconoCanto() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 8a4 4 0 0 1 0 8" />
      <path d="M18 5a7 7 0 0 1 0 14" />
    </svg>
  );
}

/** Envido: dos cartas chiquitas en abanico, evoca "tener dos del mismo palo". */
function IconoEnvido() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="6" y="5" width="9" height="13" rx="1.5" transform="rotate(-12 10 11)" />
      <rect x="9" y="6" width="9" height="13" rx="1.5" transform="rotate(10 13 12)" />
    </svg>
  );
}

/** Real envido: estrella — "real" como realeza, sube el envido a 3. */
function IconoRealEnvido() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2.5l2.94 6.34 6.86.6-5.18 4.62 1.55 6.94L12 17.5l-6.17 3.5 1.55-6.94L2.2 9.44l6.86-.6L12 2.5z" />
    </svg>
  );
}

/** Falta envido: "todo o nada" — ficha de all-in con barras crecientes. */
function IconoFaltaEnvido() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="14" width="4" height="7" rx="0.5" />
      <rect x="10" y="9" width="4" height="12" rx="0.5" />
      <rect x="17" y="4" width="4" height="17" rx="0.5" />
    </svg>
  );
}

/** Cartas tiradas hacia abajo — ícono de "ir al mazo" (descartar la mano). */
function IconoMazo() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="10" height="14" rx="1.5" transform="rotate(-12 9 11)" />
      <rect x="9" y="6" width="10" height="14" rx="1.5" transform="rotate(8 14 13)" />
      <path d="M5 22h14" />
    </svg>
  );
}
