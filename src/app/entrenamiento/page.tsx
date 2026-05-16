"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  accionComoTexto,
  cartaComoTexto,
  cartasOriginalesDelJugador,
  type SnapshotEntrenamiento
} from "@/lib/truco/entrenamiento";
import type { Accion, AccionTipo, Carta } from "@/lib/truco/types";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";

type RespuestaApi = {
  ok: boolean;
  error?: string;
  snapshot?: SnapshotEntrenamiento;
  guardado?: boolean;
  aviso?: string;
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
  iniciar_prox_mano: "Próxima mano"
};

function simboloPalo(carta: Carta): string {
  switch (carta.palo) {
    case "espada":
      return "♠";
    case "basto":
      return "♣";
    case "oro":
      return "♦";
    case "copa":
      return "♥";
  }
}

function colorPalo(carta: Carta): string {
  return carta.palo === "oro" || carta.palo === "copa"
    ? "text-[#f5d69a]"
    : "text-[#dce7ef]";
}

export default function EntrenamientoPage() {
  const [snapshot, setSnapshot] = useState<SnapshotEntrenamiento | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tamanio, setTamanio] = useState<2 | 4>(4);
  const [puntosObjetivo, setPuntosObjetivo] = useState<18 | 30>(18);
  const [accionManual, setAccionManual] = useState<AccionTipo | "">("");
  const [cartaManual, setCartaManual] = useState<string>("");
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

  const cargarSesion = async (config?: {
    tamanio?: 2 | 4;
    puntosObjetivo?: 18 | 30;
  }) => {
    setLoading(true);
    setError(null);
    setGuardado(null);
    setAccionManual("");
    setCartaManual("");
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
    setNotas("");
    setEnviando(false);
  };

  const aprobar = async () => {
    if (!snapshot?.actor || !snapshot.sugerencia) return;
    await avanzar(snapshot.sugerencia, true);
  };

  const corregir = async () => {
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
    <main className="min-h-[100dvh] px-4 py-5 max-w-7xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-text-dim text-xs hover:text-dorado transition mb-3"
      >
        <span>←</span> Volver
      </Link>

      <HeaderMarca variante="compacto" />
      <DivisorCriollo className="my-5" />

      <section className="rounded-[28px] border border-dorado/30 bg-[radial-gradient(circle_at_top,_rgba(212,170,64,0.18),_rgba(21,32,41,0.95)_45%,_rgba(10,16,22,1))] shadow-[0_30px_90px_rgba(0,0,0,0.35)] overflow-hidden">
        <div className="px-5 py-5 border-b border-dorado/20 bg-black/15">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="uppercase tracking-[0.35em] text-[10px] text-dorado/70">
                Laboratorio de entrenamiento
              </p>
              <h1 className="font-display text-3xl text-crema leading-none mt-2">
                Mesa de texto para entrenar al bot
              </h1>
              <p className="text-sm text-crema/75 mt-3 max-w-2xl leading-relaxed">
                Cada paso muestra la mano completa, la jugada sugerida por la
                máquina y un control para aprobar o corregir. Lo mismo se puede
                consumir por API.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full lg:min-w-[430px]">
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
                className="col-span-2 sm:col-span-4 btn btn-primary !py-3"
                disabled={loading || enviando}
              >
                Nueva sesión
              </button>
            </div>
          </div>
        </div>

        <div className="grid xl:grid-cols-[1.2fr_0.8fr] gap-0">
          <section className="p-4 md:p-5 border-b xl:border-b-0 xl:border-r border-dorado/15">
            <div className="rounded-[22px] border border-dorado/20 bg-[#111a21]/90 p-4 shadow-inner">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="font-display text-xl text-dorado">
                  Texto plano
                </h2>
                {guardado && (
                  <span className="text-[11px] uppercase tracking-[0.25em] text-dorado/75">
                    {guardado}
                  </span>
                )}
              </div>
              {loading ? (
                <div className="text-sm text-crema/70">Preparando mano…</div>
              ) : (
                <pre className="whitespace-pre-wrap text-[12px] leading-6 font-mono text-[#efe3c4] max-h-[70dvh] overflow-auto rounded-2xl bg-black/25 p-4 border border-white/5">
                  {snapshot?.textoPlano}
                </pre>
              )}
            </div>
          </section>

          <section className="p-4 md:p-5">
            <div className="space-y-4">
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
                <div className="rounded-2xl border border-red-400/40 bg-red-950/30 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <div className="rounded-[24px] border border-dorado/20 bg-black/15 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="font-display text-xl text-crema">Mesa visual</h2>
                  {snapshot?.terminado && (
                    <span className="text-xs uppercase tracking-[0.25em] text-dorado">
                      Partida cerrada
                    </span>
                  )}
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
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
                        className={`rounded-2xl border p-3 ${
                          actor?.id === jugador.id
                            ? "border-dorado bg-dorado/10"
                            : "border-white/10 bg-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div>
                            <div className="font-display text-lg text-crema">
                              {jugador.nombre}
                            </div>
                            <div className="text-[11px] uppercase tracking-[0.25em] text-crema/55">
                              Equipo {jugador.equipo + 1}
                            </div>
                          </div>
                          {actor?.id === jugador.id && (
                            <span className="text-[10px] uppercase tracking-[0.25em] text-dorado">
                              Actúa ahora
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {originales.map((carta) => (
                            <CartaPlano
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

              <div className="rounded-[24px] border border-dorado/20 bg-[#171f26] p-4">
                <h2 className="font-display text-xl text-crema mb-3">
                  Aprobar o corregir
                </h2>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => void aprobar()}
                    disabled={!snapshot?.sugerencia || enviando || loading}
                    className="btn btn-primary !py-3"
                  >
                    Aprobar sugerencia
                    {snapshot?.sugerencia
                      ? `: ${accionComoTexto(snapshot.sugerencia)}`
                      : ""}
                  </button>

                  <div className="grid sm:grid-cols-[1fr_auto] gap-2">
                    <select
                      value={accionManual}
                      onChange={(e) => setAccionManual(e.target.value as AccionTipo | "")}
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm text-crema outline-none"
                    >
                      <option value="">Elegir corrección manual</option>
                      {snapshot?.legales.map((tipo) => (
                        <option key={tipo} value={tipo}>
                          {ETIQUETAS_ACCION[tipo] || tipo}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void corregir()}
                      disabled={!accionManual || enviando || loading}
                      className="btn !py-3"
                    >
                      Aplicar corrección
                    </button>
                  </div>

                  {accionManual === "jugar_carta" && (
                    <div>
                      <div className="text-xs uppercase tracking-[0.25em] text-crema/55 mb-2">
                        Carta para la corrección
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cartasActor.map((carta) => (
                          <button
                            key={carta.id}
                            type="button"
                            onClick={() => setCartaManual(carta.id)}
                            className={`rounded-xl border px-3 py-2 text-sm ${
                              cartaManual === carta.id
                                ? "border-dorado bg-dorado/15 text-dorado"
                                : "border-white/10 bg-black/20 text-crema"
                            }`}
                          >
                            {cartaComoTexto(carta)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <textarea
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Notas opcionales sobre por qué corregiste la jugada"
                    className="min-h-24 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-crema outline-none placeholder:text-crema/35"
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-dorado/20 bg-black/10 p-4">
                <h2 className="font-display text-xl text-crema mb-3">
                  API rápida
                </h2>
                <pre className="whitespace-pre-wrap text-[12px] leading-6 font-mono text-[#efe3c4] rounded-2xl bg-black/25 p-4 border border-white/5">
{`POST /api/entrenamiento/session
POST /api/entrenamiento/step
POST /api/entrenamiento/feedback

Ejemplo:
curl -X POST /api/entrenamiento/session
curl -X POST /api/entrenamiento/step -H 'Content-Type: application/json' \\
  -d '{"estado": {...}, "accion": {"tipo":"responder_quiero","jugadorId":"train-2"}}'`}
                </pre>
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
      className={`rounded-xl border px-3 py-2 text-sm transition ${
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
    <div className="rounded-[24px] border border-dorado/20 bg-[#161d24] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.35em] text-dorado/70">
        {titulo}
      </div>
      <div className="font-display text-2xl text-crema mt-2 leading-tight">
        {contenido}
      </div>
    </div>
  );
}

function CartaPlano({
  carta,
  apagada
}: {
  carta: Carta;
  apagada?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 min-w-[68px] ${
        apagada
          ? "border-white/10 bg-black/15 text-crema/35"
          : "border-white/15 bg-[#f5e6c9] text-[#1f1812]"
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.25em] opacity-60">
        carta
      </div>
      <div className="font-display text-lg leading-none mt-1">
        {carta.numero}
      </div>
      <div className={`text-sm mt-1 ${apagada ? "" : colorPalo(carta)}`}>
        {simboloPalo(carta)} {cartaComoTexto(carta)}
      </div>
    </div>
  );
}
