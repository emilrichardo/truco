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
    mano.envidoCantoActivo &&
    me.equipo === mano.envidoCantoActivo.equipoQueDebeResponder;
  const debeResponderTruco =
    mano.trucoCantoActivo &&
    me.equipo === mano.trucoCantoActivo.equipoQueDebeResponder;
  const esMiTurno = mano.turnoJugadorId === miId;

  const puedeJugarCarta = esMiTurno && !mano.envidoCantoActivo && !mano.trucoCantoActivo;

  const puedo = (t: Accion["tipo"]) => legales.includes(t);

  return (
    <div className="parchment rounded-lg p-3 md:p-4 mt-4 mx-auto max-w-3xl">
      {/* Cartas */}
      <div className="flex justify-center gap-2 mb-3 flex-wrap">
        {misCartas.length === 0 ? (
          <span className="text-truco-dark/60 italic text-sm">
            {mano.fase === "terminada"
              ? "Repartiendo nueva mano…"
              : "Sin cartas en mano."}
          </span>
        ) : (
          misCartas.map((c) => (
            <CartaEspanola
              key={c.id}
              carta={c}
              jugable={puedeJugarCarta}
              onClick={() =>
                puedeJugarCarta && enviar({ tipo: "jugar_carta", jugadorId: miId, cartaId: c.id })
              }
            />
          ))
        )}
      </div>

      {/* Aviso de respuesta requerida */}
      {(debeResponderEnvido || debeResponderTruco) && (
        <div className="text-center mb-3 font-display uppercase text-truco-red text-sm tracking-wider parpadeo">
          {debeResponderEnvido ? "Te están cantando envido" : "Te están cantando truco"}
        </div>
      )}

      {/* Botones */}
      <div className="flex flex-wrap gap-2 justify-center">
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
            onClick={() => enviar({ tipo: "responder_no_quiero", jugadorId: miId })}
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
        {puedo("cantar_truco") && (
          <button
            className="btn"
            onClick={() => enviar({ tipo: "cantar_truco", jugadorId: miId })}
          >
            Truco
          </button>
        )}
        {puedo("cantar_retruco") && (
          <button
            className="btn"
            onClick={() => enviar({ tipo: "cantar_retruco", jugadorId: miId })}
          >
            Quiero retruco
          </button>
        )}
        {puedo("cantar_vale4") && (
          <button
            className="btn"
            onClick={() => enviar({ tipo: "cantar_vale4", jugadorId: miId })}
          >
            Vale cuatro
          </button>
        )}
        {puedo("ir_al_mazo") && (
          <button
            className="btn btn-danger"
            onClick={() => enviar({ tipo: "ir_al_mazo", jugadorId: miId })}
          >
            Mazo
          </button>
        )}
      </div>

      {legales.length === 0 && estado.ganadorPartida === null && (
        <div className="text-center text-truco-dark/60 text-sm mt-2 italic">
          Esperando a los demás jugadores…
        </div>
      )}
    </div>
  );
}
