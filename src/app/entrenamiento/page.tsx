"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  accionComoTexto,
  cartasOriginalesDelJugador,
  type SnapshotEntrenamiento
} from "@/lib/truco/entrenamiento";
import type { Accion, AccionTipo, Carta } from "@/lib/truco/types";
import { CartaEspanola } from "@/components/CartaEspanola";

type RespuestaApi = {
  ok: boolean;
  error?: string;
  snapshot?: SnapshotEntrenamiento;
  guardado?: boolean;
  aviso?: string;
};

type CriterioCorreccion = {
  id: string;
  label: string;
  acciones?: AccionTipo[];
};

const ETIQUETAS_ACCION: Record<AccionTipo, string> = {
  jugar_carta: "Jugar carta",
  cantar_envido: "Envido",
  cantar_real_envido: "Real envido",
  cantar_falta_envido: "Falta envido",
  responder_quiero: "Quiero",
  responder_no_quiero: "No quiero",
  cantar_truco: "Truco",
  cantar_retruco: "Retruco",
  cantar_vale4: "Vale 4",
  ir_al_mazo: "Ir al mazo",
  mazo: "Ir al mazo",
  pasar_mano: "Pasar mano",
  iniciar_prox_mano: "Próx. mano"
};

const ESTILO_PALO: Record<
  Carta["palo"],
  { label: string; className: string }
> = {
  espada: { label: "Espada", className: "bg-sky-950/70 text-sky-100" },
  basto: { label: "Basto", className: "bg-emerald-950/70 text-emerald-100" },
  oro: { label: "Oro", className: "bg-amber-900/80 text-amber-100" },
  copa: { label: "Copa", className: "bg-rose-950/70 text-rose-100" }
};

const CRITERIOS_CORRECCION: CriterioCorreccion[] = [
  {
    id: "pie_define_primera",
    label: "Que defina el pie",
    acciones: ["jugar_carta"]
  },
  {
    id: "no_quemar_alta",
    label: "No quemar alta",
    acciones: ["jugar_carta"]
  },
  {
    id: "baja_alcanza",
    label: "Con una baja alcanzaba",
    acciones: ["jugar_carta"]
  },
  {
    id: "guardar_ganadora",
    label: "Guardar ganadora",
    acciones: ["jugar_carta"]
  },
  {
    id: "hacer_pasada",
    label: "Hacer pasada",
    acciones: ["jugar_carta"]
  },
  {
    id: "forzar_rival",
    label: "Forzar rival",
    acciones: ["jugar_carta"]
  },
  {
    id: "cuidar_companero",
    label: "Cuidar compañero",
    acciones: ["jugar_carta"]
  },
  {
    id: "respuesta_conservadora",
    label: "Respuesta conservadora",
    acciones: ["responder_quiero", "responder_no_quiero"]
  },
  {
    id: "meter_presion",
    label: "Meter presión",
    acciones: ["cantar_truco", "cantar_retruco", "cantar_vale4"]
  },
  {
    id: "envido_primero",
    label: "Envido primero",
    acciones: ["cantar_envido", "cantar_real_envido", "cantar_falta_envido"]
  },
  {
    id: "jugar_por_marcador",
    label: "Jugar por marcador"
  }
];

export default function EntrenamientoPage() {
  const [snapshot, setSnapshot] = useState<SnapshotEntrenamiento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tamanio, setTamanio] = useState<2 | 4>(4);
  const [puntosObjetivo, setPuntosObjetivo] = useState<18 | 30>(18);
  const [accionManual, setAccionManual] = useState<AccionTipo | "">("");
  const [cartaManual, setCartaManual] = useState<string>("");
  const [criterios, setCriterios] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [guardado, setGuardado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const actor = snapshot?.actor ?? null;
  const estado = snapshot?.estado ?? null;
  const mano = estado?.manoActual ?? null;
  const cartasActor = useMemo(
    () => (actor && mano ? mano.cartasPorJugador[actor.id] || [] : []),
    [actor, mano]
  );
  const accionContextual = accionManual || snapshot?.sugerencia?.tipo || null;
  const criteriosDisponibles = useMemo(
    () =>
      CRITERIOS_CORRECCION.filter(
        (criterio) =>
          !criterio.acciones ||
          !accionContextual ||
          criterio.acciones.includes(accionContextual)
      ),
    [accionContextual]
  );

  const cargarSesion = async (config?: {
    tamanio?: 2 | 4;
    puntosObjetivo?: 18 | 30;
  }) => {
    setLoading(true);
    setError(null);
    setGuardado(null);
    setAccionManual("");
    setCartaManual("");
    setCriterios([]);
    const res = await fetch("/api/entrenamiento/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tamanio: config?.tamanio ?? tamanio,
        puntosObjetivo: config?.puntosObjetivo ?? puntosObjetivo
      })
    });
    const data = (await res.json()) as RespuestaApi;
    if (!data.ok || !data.snapshot) {
      setError(data.error || "No se pudo crear la sesión.");
      setLoading(false);
      return;
    }
    setSnapshot(data.snapshot);
    setLoading(false);
  };

  useEffect(() => {
    void cargarSesion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enviarFeedback = async (aprobada: boolean, accionFinal: Accion) => {
    if (!snapshot?.actor) return;
    const res = await fetch("/api/entrenamiento/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: snapshot.estado,
        actorId: snapshot.actor.id,
        sugerencia: snapshot.sugerencia,
        accionFinal,
        aprobada,
        origen: "web",
        criterios,
        notas: notas.trim() || undefined
      })
    });
    const data = (await res.json()) as RespuestaApi;
    if (data.ok) {
      setGuardado(
        data.guardado
          ? "Feedback guardado."
          : data.aviso || "Feedback recibido."
      );
    }
  };

  const avanzar = async (accion: Accion, aprobada: boolean) => {
    if (!snapshot) return;
    setEnviando(true);
    setError(null);
    setGuardado(null);
    await enviarFeedback(aprobada, accion);
    const res = await fetch("/api/entrenamiento/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        estado: snapshot.estado,
        accion
      })
    });
    const data = (await res.json()) as RespuestaApi;
    if (!data.ok || !data.snapshot) {
      setError(data.error || "No se pudo avanzar el entrenamiento.");
      setEnviando(false);
      return;
    }
    setSnapshot(data.snapshot);
    setAccionManual("");
    setCartaManual("");
    setCriterios([]);
    setNotas("");
    setEnviando(false);
  };

  const aprobar = async () => {
    if (!snapshot?.actor || !snapshot.sugerencia) return;
    await avanzar(snapshot.sugerencia, true);
  };

  const rechazar = async () => {
    if (!snapshot?.actor || !accionManual) return;
    if (accionManual === "jugar_carta" && !cartaManual) {
      setError("Elegí la carta para corregir la jugada.");
      return;
    }
    const accion: Accion = {
      tipo: accionManual,
      jugadorId: snapshot.actor.id,
      cartaId: accionManual === "jugar_carta" ? cartaManual : undefined
    };
    await avanzar(accion, false);
  };

  return (
    <main className="h-[100dvh] overflow-hidden px-2 py-2 md:px-3 md:py-3 max-w-[1700px] mx-auto flex flex-col gap-2">
      <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 px-1">
        <div className="min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-text-dim text-xs hover:text-dorado transition"
          >
            <span>←</span> Volver
          </Link>
          <div className="mt-1">
            <p className="uppercase tracking-[0.32em] text-[10px] text-dorado/70">
              Laboratorio de entrenamiento
            </p>
            <h1 className="font-display text-[1.25rem] md:text-[1.45rem] lg:text-[1.65rem] text-crema leading-none mt-1">
              Mesa de decisiones
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1.5 w-full lg:w-auto lg:min-w-[480px] lg:max-w-[560px]">
          <SelectorToggle
            activo={tamanio === 2}
            onClick={() => setTamanio(2)}
            label="1v1"
          />
          <SelectorToggle
            activo={tamanio === 4}
            onClick={() => setTamanio(4)}
            label="2v2"
          />
          <SelectorToggle
            activo={puntosObjetivo === 18}
            onClick={() => setPuntosObjetivo(18)}
            label="A 18"
          />
          <SelectorToggle
            activo={puntosObjetivo === 30}
            onClick={() => setPuntosObjetivo(30)}
            label="A 30"
          />
          <button
            type="button"
            onClick={() => void cargarSesion({ tamanio, puntosObjetivo })}
            className="sm:col-span-1 col-span-2 btn btn-primary !py-2 !px-3 whitespace-nowrap text-sm"
            disabled={loading || enviando}
          >
            Nueva
          </button>
        </div>
      </div>

      <section className="flex-1 min-h-0 rounded-[24px] border border-dorado/30 bg-[radial-gradient(circle_at_top,_rgba(212,170,64,0.16),_rgba(21,32,41,0.96)_45%,_rgba(10,16,22,1))] shadow-[0_24px_70px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="grid h-full lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)] gap-0">
          <section className="p-2.5 md:p-3 border-b lg:border-b-0 lg:border-r border-dorado/15 overflow-hidden">
            <div className="grid h-full grid-rows-[auto_auto_1fr_auto] gap-2">
              <PanelResumen
                titulo="Próxima decisión"
                contenido={
                  loading
                    ? "Esperando motor…"
                    : actor && snapshot?.sugerencia
                    ? `${actor.nombre} va a ${accionComoTexto(snapshot.sugerencia)}`
                    : "Sin actor disponible."
                }
              />

              {error && (
                <div className="rounded-xl border border-red-400/40 bg-red-950/30 px-3 py-2 text-xs text-red-100">
                  {error}
                </div>
              )}

              <div className="rounded-[20px] border border-dorado/20 bg-[#171f26] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="font-display text-base text-crema">
                    Aprobar o corregir
                  </h2>
                  {guardado && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-dorado/75">
                      {guardado}
                    </span>
                  )}
                </div>

                <div className="grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void aprobar()}
                      disabled={!snapshot?.sugerencia || enviando || loading}
                      className="btn btn-primary !py-2 text-sm"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => void rechazar()}
                      disabled={!accionManual || enviando || loading}
                      className="btn btn-danger !py-2 text-sm"
                    >
                      Rechazar
                    </button>
                  </div>

                  {snapshot?.sugerencia && (
                    <div className="rounded-xl border border-dorado/15 bg-black/20 px-3 py-2 text-xs text-crema/80">
                      Sugerencia actual:
                      <span className="ml-1 font-semibold text-crema">
                        {accionComoTexto(snapshot.sugerencia)}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <select
                      value={accionManual}
                      onChange={(e) => setAccionManual(e.target.value as AccionTipo | "")}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-crema outline-none"
                    >
                      <option value="">Corrección manual</option>
                      {snapshot?.legales.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {ETIQUETAS_ACCION[tipo] || tipo}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void rechazar()}
                      disabled={!accionManual || enviando || loading}
                      className="btn !py-2 !px-3 text-sm"
                    >
                      Usar
                    </button>
                  </div>

                  {accionManual === "jugar_carta" && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-crema/55 mb-1.5">
                        Elegí carta
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {cartasActor.map((carta) => (
                          <button
                            key={carta.id}
                            type="button"
                            onClick={() => setCartaManual(carta.id)}
                            className={`rounded-xl border p-1.5 text-sm transition ${
                              cartaManual === carta.id
                                ? "border-dorado bg-dorado/10"
                                : "border-white/10 bg-black/20"
                            }`}
                          >
                            <div className="flex justify-center">
                              <CartaEspanola carta={carta} tamanio="mini" />
                            </div>
                            <div className="mt-1.5 flex items-center justify-between gap-1">
                              <span className="text-[11px] font-semibold text-crema">
                                {carta.numero}
                              </span>
                              <PaloBadge carta={carta} />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-crema/55 mb-1.5">
                      Criterios
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {criteriosDisponibles.map((criterio) => {
                        const activo = criterios.includes(criterio.id);
                        return (
                          <button
                            key={criterio.id}
                            type="button"
                            onClick={() =>
                              setCriterios((prev) =>
                                prev.includes(criterio.id)
                                  ? prev.filter((id) => id !== criterio.id)
                                  : [...prev, criterio.id]
                              )
                            }
                            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                              activo
                                ? "border-dorado bg-dorado/15 text-dorado"
                                : "border-white/10 bg-black/20 text-crema/75"
                            }`}
                          >
                            {criterio.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-crema/55 mb-1.5">
                      Comentario libre
                    </div>
                    <textarea
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Por qué aprobás o rechazás esta decisión"
                      className="min-h-10 max-h-16 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-crema outline-none placeholder:text-crema/35"
                    />
                  </div>
                </div>
              </div>

              <details className="rounded-[18px] border border-dorado/20 bg-black/10 p-2.5">
                <summary className="font-display text-sm text-crema cursor-pointer list-none">
                  API rápida
                </summary>
                <pre className="whitespace-pre-wrap text-[10px] leading-4.5 font-mono text-[#efe3c4] rounded-xl bg-black/25 p-2.5 border border-white/5 mt-2 overflow-auto">
{`POST /api/entrenamiento/session
POST /api/entrenamiento/step
POST /api/entrenamiento/feedback

Ejemplo:
curl -X POST /api/entrenamiento/session
curl -X POST /api/entrenamiento/step -H 'Content-Type: application/json' \\
  -d '{"estado": {...}, "accion": {"tipo":"responder_quiero","jugadorId":"train-2"}}'`}
                </pre>
              </details>
            </div>
          </section>

          <section className="p-2.5 md:p-3 overflow-hidden">
            <div className="grid h-full grid-rows-[auto_minmax(0,0.42fr)] lg:grid-rows-[minmax(0,0.58fr)_minmax(0,0.42fr)] gap-2">
              <div className="rounded-[20px] border border-dorado/20 bg-black/15 p-2.5">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="font-display text-base text-crema">Mesa visual</h2>
                  {snapshot?.terminado && (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-dorado">
                      Partida cerrada
                    </span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-1.5">
                  {estado?.jugadores.map((jugador) => {
                    const originales = cartasOriginalesDelJugador(
                      estado,
                      jugador.id
                    );
                    const restantes = new Set(
                      (mano?.cartasPorJugador[jugador.id] || []).map((c) => c.id)
                    );
                    return (
                      <div
                        key={jugador.id}
                        className={`rounded-xl border p-2 ${
                          actor?.id === jugador.id
                            ? "border-dorado bg-dorado/10"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div>
                            <div className="font-display text-sm md:text-base text-crema leading-none">
                              {jugador.nombre}
                            </div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-crema/55">
                              Equipo {jugador.equipo + 1}
                            </div>
                          </div>
                          {actor?.id === jugador.id && (
                            <span className="text-[9px] uppercase tracking-[0.18em] text-dorado">
                              Ahora
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {originales.map((carta) => (
                            <CartaEntrenamiento
                              key={`${jugador.id}-${carta.id}`}
                              carta={carta}
                              apagada={!restantes.has(carta.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[20px] border border-dorado/20 bg-[#111a21]/90 p-2.5 shadow-inner min-h-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <h2 className="font-display text-base text-dorado">
                    Texto plano
                  </h2>
                  <span className="text-[9px] uppercase tracking-[0.18em] text-crema/45">
                    Interno
                  </span>
                </div>
                {loading ? (
                  <div className="text-xs text-crema/70">Preparando mano…</div>
                ) : (
                  <pre className="h-full min-h-0 whitespace-pre-wrap text-[10px] leading-4.5 font-mono text-[#efe3c4] overflow-auto rounded-xl bg-black/25 p-2.5 border border-white/5">
                    {snapshot?.textoPlano}
                  </pre>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function SelectorToggle({
  activo,
  onClick,
  label
}: {
  activo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-sm transition ${
        activo
          ? "border-dorado bg-dorado/20 text-dorado"
          : "border-white/10 bg-black/15 text-crema/80"
      }`}
    >
      {label}
    </button>
  );
}

function PanelResumen({
  titulo,
  contenido
}: {
  titulo: string;
  contenido: string;
}) {
  return (
    <div className="rounded-[20px] border border-dorado/20 bg-[#161d24] px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-[0.26em] text-dorado/70">
        {titulo}
      </div>
      <div className="font-display text-[1.2rem] md:text-[1.35rem] lg:text-[1.5rem] text-crema mt-1.5 leading-tight">
        {contenido}
      </div>
    </div>
  );
}

function CartaEntrenamiento({
  carta,
  apagada
}: {
  carta: Carta;
  apagada?: boolean;
}) {
  return (
    <div className={`relative ${apagada ? "opacity-45 grayscale-[0.2]" : ""}`}>
      <CartaEspanola carta={carta} tamanio="mini" />
      <div className="mt-1 flex items-center justify-between gap-1 px-0.5">
        <span className="text-[10px] font-semibold text-crema/85">
          {carta.numero}
        </span>
        <PaloBadge carta={carta} />
      </div>
    </div>
  );
}

function PaloBadge({ carta }: { carta: Carta }) {
  const estilo = ESTILO_PALO[carta.palo];
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${estilo.className}`}
    >
      {estilo.label}
    </span>
  );
}
