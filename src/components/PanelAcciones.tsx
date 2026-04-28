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
  // Animación de reparto: sólo activa durante 1.5s después de que el
  // motor reparte una mano nueva. Reordenar cartas (drag horizontal) NO
  // debe re-disparar la animación — antes la animación se reseteaba en
  // cada cambio de orden y se veía mal en desktop.
  const [recienRepartido, setRecienRepartido] = useState(true);
  useEffect(() => {
    setOrdenLocal(misCartas.map((c) => c.id));
    setRecienRepartido(true);
    const t = window.setTimeout(() => setRecienRepartido(false), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  // Estado de arrastre. Una sola carta a la vez, registrada por id.
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [delta, setDelta] = useState({ x: 0, y: 0 });
  const inicioPunteroRef = useRef<{ x: number; y: number } | null>(null);

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
      enviar({ tipo: "jugar_carta", jugadorId: miId, cartaId });
      return;
    }
    // Arrastre vertical hacia arriba con suficiente fuerza → tirar a la mesa.
    if (movY < -80) {
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
  // final.
  const cartasOrdenadas = (() => {
    const porId = new Map(misCartas.map((c) => [c.id, c]));
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
      if (!visto.has(c.id)) out.push(c);
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
       *  sigue jugando la carta directo. */}
      <div className="flex justify-center items-end mb-2 min-h-[140px] sm:min-h-[170px]">
        {cartasOrdenadas.length === 0 ? (
          <span className="text-text-dim italic text-xs py-3 subtitulo-claim">
            {mano.fase === "terminada" ? "Repartiendo…" : "Sin cartas."}
          </span>
        ) : (
          cartasOrdenadas.map((c, i) => {
            const offset = i - centro;
            const rot = offset * 9;
            const dy = Math.abs(offset) * 8;
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
                <div
                  className={recienRepartido ? "reparto-anim" : undefined}
                  style={
                    recienRepartido
                      ? ({
                          "--reparto-from-x": "0",
                          "--reparto-from-y": "-300%",
                          "--reparto-delay": `${i * 90 + 200}ms`
                        } as React.CSSProperties)
                      : undefined
                  }
                >
                  <CartaEspanola
                    carta={c}
                    jugable={puedeJugarCarta}
                    tamanio="sm"
                  />
                </div>
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

      {/* Botoneras agrupadas por contexto.
       *  - Respondiendo truco: una sola fila con Quiero · No quiero ·
       *    Retruco/Vale 4. Si "el envido está primero" sigue vigente, va
       *    una segunda fila con los cantos de envido.
       *  - Respondiendo envido: una sola fila con Quiero · No quiero +
       *    subir envido (envido / real / falta).
       *  - En tu turno (sin canto pendiente): filas separadas para envido
       *    y truco; el mazo siempre va aparte. */}
      <div className="flex flex-col gap-1.5">
        {debeResponderTruco && (
          <GrupoBotones titulo="Responder truco">
            {puedo("responder_quiero") && (
              <button
                className="btn btn-primary"
                onClick={() => enviar({ tipo: "responder_quiero", jugadorId: miId })}
              >
                Quiero
              </button>
            )}
            {puedo("responder_no_quiero") && (
              <button
                className="btn btn-danger"
                onClick={() =>
                  enviar({ tipo: "responder_no_quiero", jugadorId: miId })
                }
              >
                No quiero
              </button>
            )}
            {puedo("cantar_retruco") && (
              <button
                className="btn"
                onClick={() => enviar({ tipo: "cantar_retruco", jugadorId: miId })}
              >
                Retruco
              </button>
            )}
            {puedo("cantar_vale4") && (
              <button
                className="btn"
                onClick={() => enviar({ tipo: "cantar_vale4", jugadorId: miId })}
              >
                Vale 4
              </button>
            )}
          </GrupoBotones>
        )}

        {debeResponderTruco &&
          (puedo("cantar_envido") ||
            puedo("cantar_real_envido") ||
            puedo("cantar_falta_envido")) && (
            <GrupoBotones titulo="Envido primero">
              {puedo("cantar_envido") && (
                <button
                  className="btn"
                  onClick={() => enviar({ tipo: "cantar_envido", jugadorId: miId })}
                >
                  Envido
                </button>
              )}
              {puedo("cantar_real_envido") && (
                <button
                  className="btn"
                  onClick={() =>
                    enviar({ tipo: "cantar_real_envido", jugadorId: miId })
                  }
                >
                  Real envido
                </button>
              )}
              {puedo("cantar_falta_envido") && (
                <button
                  className="btn"
                  onClick={() =>
                    enviar({ tipo: "cantar_falta_envido", jugadorId: miId })
                  }
                >
                  Falta envido
                </button>
              )}
            </GrupoBotones>
          )}

        {debeResponderEnvido && (
          <GrupoBotones titulo="Responder envido">
            {puedo("responder_quiero") && (
              <button
                className="btn btn-primary"
                onClick={() => enviar({ tipo: "responder_quiero", jugadorId: miId })}
              >
                Quiero
              </button>
            )}
            {puedo("responder_no_quiero") && (
              <button
                className="btn btn-danger"
                onClick={() =>
                  enviar({ tipo: "responder_no_quiero", jugadorId: miId })
                }
              >
                No quiero
              </button>
            )}
            {puedo("cantar_envido") && (
              <button
                className="btn"
                onClick={() => enviar({ tipo: "cantar_envido", jugadorId: miId })}
              >
                Envido
              </button>
            )}
            {puedo("cantar_real_envido") && (
              <button
                className="btn"
                onClick={() =>
                  enviar({ tipo: "cantar_real_envido", jugadorId: miId })
                }
              >
                Real envido
              </button>
            )}
            {puedo("cantar_falta_envido") && (
              <button
                className="btn"
                onClick={() =>
                  enviar({ tipo: "cantar_falta_envido", jugadorId: miId })
                }
              >
                Falta envido
              </button>
            )}
          </GrupoBotones>
        )}

        {/* En tu turno (sin canto pendiente) los grupos van sin rótulo —
         *  los botones se distinguen entre sí por color/borde dorado (truco)
         *  vs neutros (envido). Cada canto lleva su ícono. */}
        {!debeResponderEnvido &&
          !debeResponderTruco &&
          (puedo("cantar_envido") ||
            puedo("cantar_real_envido") ||
            puedo("cantar_falta_envido")) && (
            <GrupoBotones>
              {puedo("cantar_envido") && (
                <button
                  className="btn"
                  onClick={() => enviar({ tipo: "cantar_envido", jugadorId: miId })}
                >
                  <IconoEnvido /> Envido
                </button>
              )}
              {puedo("cantar_real_envido") && (
                <button
                  className="btn"
                  onClick={() =>
                    enviar({ tipo: "cantar_real_envido", jugadorId: miId })
                  }
                >
                  <IconoRealEnvido /> Real envido
                </button>
              )}
              {puedo("cantar_falta_envido") && (
                <button
                  className="btn"
                  onClick={() =>
                    enviar({ tipo: "cantar_falta_envido", jugadorId: miId })
                  }
                >
                  <IconoFaltaEnvido /> Falta envido
                </button>
              )}
            </GrupoBotones>
          )}

        {!debeResponderEnvido &&
          !debeResponderTruco &&
          (puedo("cantar_truco") ||
            puedo("cantar_retruco") ||
            puedo("cantar_vale4") ||
            puedo("ir_al_mazo")) && (
            <GrupoBotones>
              {puedo("cantar_truco") && (
                <button
                  className="btn btn-primary"
                  onClick={() => enviar({ tipo: "cantar_truco", jugadorId: miId })}
                >
                  <IconoCanto /> Truco
                </button>
              )}
              {puedo("cantar_retruco") && (
                <button
                  className="btn"
                  style={{ borderColor: "var(--dorado-oscuro)" }}
                  onClick={() =>
                    enviar({ tipo: "cantar_retruco", jugadorId: miId })
                  }
                >
                  <IconoCanto /> Retruco
                </button>
              )}
              {puedo("cantar_vale4") && (
                <button
                  className="btn"
                  style={{ borderColor: "var(--dorado-oscuro)" }}
                  onClick={() => enviar({ tipo: "cantar_vale4", jugadorId: miId })}
                >
                  <IconoCanto /> Vale 4
                </button>
              )}
              {puedo("ir_al_mazo") && (
                <button
                  className="btn"
                  onClick={() => enviar({ tipo: "ir_al_mazo", jugadorId: miId })}
                >
                  <IconoMazo /> Ir al mazo
                </button>
              )}
            </GrupoBotones>
          )}
      </div>

      {legales.length === 0 && estado.ganadorPartida === null && (
        <div className="text-center text-text-dim text-xs py-1 italic">
          Esperando…
        </div>
      )}
    </div>
  );
}

/** Fila etiquetada con los botones de una categoría (respuesta, envido,
 *  truco, mazo). El rótulo de la izquierda ancla el grupo visualmente y
 *  evita que el jugador confunda un canto de envido con uno de truco
 *  cuando aparecen ambos a la vez (el envido está primero). */
function GrupoBotones({
  titulo: _titulo,
  children
}: {
  titulo?: string;
  children: React.ReactNode;
}) {
  // Saqué el rótulo lateral — desalineaba todo en mobile y el banner
  // "TE CANTARON TRUCO" arriba ya da contexto. La fila se centra
  // horizontalmente debajo de las cartas. El prop `titulo` se mantiene
  // por compatibilidad pero no se renderiza.
  return (
    <div className="flex flex-wrap gap-1.5 justify-center">{children}</div>
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
