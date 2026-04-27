"use client";
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
  const puedo = (t: Accion["tipo"]) => legales.includes(t);

  const total = misCartas.length;
  const centro = (total - 1) / 2;

  return (
    <div className="px-2 py-2 relative">
      {/* Sutil borde dorado superior */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-dorado/40 to-transparent" />

      {/* Mis cartas en abanico — grandes y separadas para leerlas bien */}
      <div className="flex justify-center items-end mb-2 min-h-[180px] sm:min-h-[230px]">
        {misCartas.length === 0 ? (
          <span className="text-text-dim italic text-xs py-3 subtitulo-claim">
            {mano.fase === "terminada" ? "Repartiendo…" : "Sin cartas."}
          </span>
        ) : (
          misCartas.map((c, i) => {
            const offset = i - centro;
            const rot = offset * 9;
            const dy = Math.abs(offset) * 10;
            return (
              <div
                key={c.id}
                className="fan-card"
                style={
                  {
                    "--r": `${rot}deg`,
                    "--dy": `${dy}px`,
                    marginLeft: i === 0 ? 0 : "-2.25rem",
                    zIndex: i + 1
                  } as React.CSSProperties
                }
              >
                <CartaEspanola
                  carta={c}
                  jugable={puedeJugarCarta}
                  tamanio="md"
                  onClick={() =>
                    puedeJugarCarta &&
                    enviar({
                      tipo: "jugar_carta",
                      jugadorId: miId,
                      cartaId: c.id
                    })
                  }
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

      {/* Botones agrupados por jerarquía cromática */}
      <div className="flex flex-wrap gap-1.5 justify-center">
        {/* Respuestas (prioritarias) */}
        {puedo("responder_quiero") && (
          <button
            className="btn btn-primary flex-1 sm:flex-none min-w-[90px]"
            onClick={() => enviar({ tipo: "responder_quiero", jugadorId: miId })}
          >
            Quiero
          </button>
        )}
        {puedo("responder_no_quiero") && (
          <button
            className="btn btn-danger flex-1 sm:flex-none min-w-[90px]"
            onClick={() =>
              enviar({ tipo: "responder_no_quiero", jugadorId: miId })
            }
          >
            No quiero
          </button>
        )}

        {/* Envidos: en dorado claro como acento criollo */}
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
            onClick={() => enviar({ tipo: "cantar_real_envido", jugadorId: miId })}
          >
            Real envido
          </button>
        )}
        {puedo("cantar_falta_envido") && (
          <button
            className="btn"
            onClick={() => enviar({ tipo: "cantar_falta_envido", jugadorId: miId })}
          >
            Falta envido
          </button>
        )}

        {/* Trucos: en azul criollo, escalando intensidad */}
        {puedo("cantar_truco") && (
          <button
            className="btn btn-azul"
            onClick={() => enviar({ tipo: "cantar_truco", jugadorId: miId })}
          >
            Truco
          </button>
        )}
        {puedo("cantar_retruco") && (
          <button
            className="btn btn-azul"
            onClick={() => enviar({ tipo: "cantar_retruco", jugadorId: miId })}
          >
            Retruco
          </button>
        )}
        {puedo("cantar_vale4") && (
          <button
            className="btn btn-azul"
            onClick={() => enviar({ tipo: "cantar_vale4", jugadorId: miId })}
          >
            Vale 4
          </button>
        )}

        {/* Mazo: en marrón madera */}
        {puedo("ir_al_mazo") && (
          <button
            className="btn btn-madera"
            onClick={() => enviar({ tipo: "ir_al_mazo", jugadorId: miId })}
          >
            Mazo
          </button>
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
