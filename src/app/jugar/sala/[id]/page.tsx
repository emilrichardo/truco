"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSocket, guardarSesion, leerSesion } from "@/lib/socket";
import { usePersonajeLocal } from "@/lib/personaje";
import { getPersonaje, urlPersonaje } from "@/data/jugadores";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";
import { Mesa } from "@/components/Mesa";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { UltimoCanto } from "@/components/UltimoCanto";

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const salaId = params.id;
  const [miSlug, , listoSlug] = usePersonajeLocal();
  const [estado, setEstado] = useState<EstadoJuego | null>(null);
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [unidoIntentado, setUnidoIntentado] = useState(false);
  const [chatNoVisto, setChatNoVisto] = useState(0);

  useEffect(() => {
    if (listoSlug && !miSlug) router.replace("/");
  }, [listoSlug, miSlug, router]);

  useEffect(() => {
    const s = leerSesion(salaId);
    if (s) setMiId(s.jugadorId);
  }, [salaId]);

  useEffect(() => {
    const sock = getSocket();
    const onEstado = (e: EstadoJuego) => {
      setEstado((prev) => {
        // Sumar mensajes nuevos al contador si el chat está cerrado.
        if (prev && !chatAbierto && e.chat.length > prev.chat.length) {
          setChatNoVisto((n) => n + (e.chat.length - prev.chat.length));
        }
        return e;
      });
    };
    const onError = (msg: string) => setError(msg);
    sock.on("estado", onEstado);
    sock.on("estado_error", onError);
    sock.on("accion_error", onError);
    if (miId) sock.emit("reconectar", { salaId, jugadorId: miId });
    return () => {
      sock.off("estado", onEstado);
      sock.off("estado_error", onError);
      sock.off("accion_error", onError);
    };
  }, [salaId, miId, chatAbierto]);

  useEffect(() => {
    if (!estado || !miSlug || unidoIntentado) return;
    const yaSoy = miId && estado.jugadores.some((j) => j.id === miId);
    if (yaSoy || estado.iniciada) return;
    setUnidoIntentado(true);
    const sock = getSocket();
    sock.emit(
      "unirse_sala",
      {
        salaId,
        nombre: getPersonaje(miSlug)?.nombre || "Primo",
        personaje: miSlug
      },
      (resp: { ok: boolean; jugadorId?: string; error?: string }) => {
        if (!resp.ok) return setError(resp.error || "No se pudo entrar.");
        if (resp.jugadorId) {
          setMiId(resp.jugadorId);
          guardarSesion({ salaId, jugadorId: resp.jugadorId });
        }
      }
    );
  }, [estado, miSlug, miId, unidoIntentado, salaId]);

  const enviarAccion = useCallback(
    (a: Accion) => {
      if (!miId) return;
      getSocket().emit("accion", { salaId, jugadorId: miId, accion: a });
    },
    [salaId, miId]
  );
  const enviarChat = useCallback(
    (m: { texto?: string; reaccion?: string }) => {
      if (!miId) return;
      getSocket().emit("chat", { salaId, jugadorId: miId, ...m });
    },
    [salaId, miId]
  );
  const iniciar = useCallback(() => {
    getSocket().emit("iniciar_partida", { salaId });
  }, [salaId]);
  const compartirLink = useCallback(() => {
    if (typeof window === "undefined") return;
    navigator.clipboard.writeText(`${window.location.origin}/jugar/sala/${salaId}`);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 1500);
  }, [salaId]);
  const compartirWhatsApp = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/jugar/sala/${salaId}`;
    const texto = `🃏 ¡Sumate a la mesa de truco entre primos!\nSala: *${salaId}*\n${url}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
  }, [salaId]);
  const abrirChat = useCallback(() => {
    setChatAbierto(true);
    setChatNoVisto(0);
  }, []);

  const jugadoresReales = useMemo(
    () => estado?.jugadores.filter((j) => !j.esBot) || [],
    [estado]
  );

  if (!estado) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center text-center px-4">
        <div>
          <img
            src="/brand/logo.png"
            alt="Truco Entre Primos"
            className="w-32 mx-auto mb-4 opacity-80 parpadeo"
          />
          <div className="text-dorado font-display text-xl">
            Conectando…
          </div>
          <div className="text-text-dim text-xs mt-2 subtitulo-claim">
            Sala #{salaId}
          </div>
        </div>
      </main>
    );
  }

  const yaSoyJugador = miId && estado.jugadores.some((j) => j.id === miId);
  const total = estado.modo === "2v2" ? 4 : 2;
  const realesNecesarios = total - jugadoresReales.length;
  const meEnCurso = estado.iniciada && yaSoyJugador;
  const miEquipoEs0 =
    estado.jugadores.find((j) => j.id === miId)?.equipo === 0;

  return (
    <main className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-bg">
      {/* Header compacto con mini logo */}
      <header className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
        <Link
          href="/"
          className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
          title="Volver"
        >
          ←
        </Link>
        <Link href="/" className="hidden sm:inline-block">
          <img
            src="/brand/logo.png"
            alt="Truco Entre Primos"
            className="h-7 w-auto opacity-90 hover:opacity-100 transition"
          />
        </Link>
        <div className="flex-1 min-w-0 text-[11px] text-text-dim truncate subtitulo-claim">
          #{salaId}
        </div>
        <JugadoresRealesBadge jugadores={jugadoresReales} miId={miId} />
        <button
          onClick={compartirWhatsApp}
          className="btn !px-2 !py-1 !min-h-0 text-xs flex items-center gap-1"
          title="Compartir por WhatsApp"
          style={{
            background: "#25d366",
            borderColor: "#1ea952",
            color: "#fff"
          }}
        >
          <span aria-hidden>💬</span>
          <span className="hidden sm:inline">WhatsApp</span>
        </button>
        <button
          onClick={compartirLink}
          className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
          title="Copiar link"
        >
          {linkCopiado ? "✓ Copiado" : "📋 Copiar"}
        </button>
        {!estado.iniciada && yaSoyJugador && (
          <button
            onClick={iniciar}
            className="btn btn-primary !px-3 !py-1 !min-h-0 text-xs"
          >
            Iniciar
          </button>
        )}
        <button
          onClick={abrirChat}
          className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs relative md:hidden"
          title="Abrir chat"
        >
          💬
          {chatNoVisto > 0 && (
            <span className="absolute -top-1 -right-1 bg-red text-text text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
              {chatNoVisto > 9 ? "9+" : chatNoVisto}
            </span>
          )}
        </button>
      </header>

      {error && (
        <div className="bg-red/30 border-b border-red text-text py-1 px-2 text-xs text-center">
          {error}
        </div>
      )}

      {!estado.iniciada && !yaSoyJugador && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card p-5 text-center max-w-sm border-l-4 border-l-azul-criollo">
            <div className="titulo-marca text-xl mb-2">
              Esperando que se <span className="acento">sienten</span>
            </div>
            <p className="text-sm text-text-dim">
              La partida no empezó. Si querés jugar, volvé al inicio y elegí tu primo.
            </p>
          </div>
        </div>
      )}

      {!estado.iniciada && yaSoyJugador && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="card p-4 max-w-md mx-auto border-t-4 border-t-dorado">
            <div className="titulo-marca text-xl mb-2 text-center">
              Esperando <span className="acento">primos</span>
            </div>
            <p className="text-sm text-text-dim mb-4 text-center">
              Mandales el link. Si falta alguien al iniciar, lo completa un bot.
            </p>
            <ListaJugadoresEspera estado={estado} miId={miId} />
            {realesNecesarios > 0 && (
              <p className="text-text-dim text-xs mt-4 text-center subtitulo-claim">
                Faltan {realesNecesarios}{" "}
                {realesNecesarios === 1 ? "primo" : "primos"} reales
              </p>
            )}
          </div>
        </div>
      )}

      {/* Layout principal: mesa flexible + chat lateral en desktop / drawer en mobile */}
      {estado.iniciada && yaSoyJugador && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Columna principal */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 relative min-h-0">
              <Mesa estado={estado} miId={miId!} />
              <UltimoCanto estado={estado} miId={miId!} />
            </div>
            {meEnCurso && (
              <PanelAcciones
                estado={estado}
                miId={miId!}
                enviar={enviarAccion}
              />
            )}
          </div>

          {/* Chat: panel lateral en desktop */}
          <aside className="hidden md:flex w-80 lg:w-96 border-l border-border flex-col p-2 overflow-hidden">
            <Chat
              estado={estado}
              miId={miId!}
              miEquipoEs0={miEquipoEs0}
              enviar={enviarChat}
            />
          </aside>

          {/* Chat: drawer en mobile */}
          {chatAbierto && (
            <div
              className="fixed inset-0 sheet-bg z-40 md:hidden flex items-end"
              onClick={() => setChatAbierto(false)}
            >
              <div
                className="bg-bg w-full h-[85vh] rounded-t-xl border-t border-border p-2 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center px-1 pb-2">
                  <span className="label-slim">Mesa</span>
                  <button
                    onClick={() => setChatAbierto(false)}
                    className="btn btn-ghost !py-1 !px-2 !min-h-0 text-xs"
                  >
                    Cerrar ✕
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <Chat
                    estado={estado}
                    miId={miId!}
                    miEquipoEs0={miEquipoEs0}
                    enviar={enviarChat}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Modal ganador */}
          {estado.ganadorPartida !== null && (
            <div className="absolute inset-0 sheet-bg flex items-center justify-center z-40 p-4">
              <div className="papel p-6 text-center max-w-sm">
                <div className="text-5xl mb-2">🏆</div>
                <div className="titulo-marca text-2xl mb-1" style={{ color: "var(--carbon)", textShadow: "1px 1px 0 rgba(217,164,65,0.5)" }}>
                  Equipo <span className="acento" style={{ color: "var(--azul-criollo)" }}>{estado.ganadorPartida + 1}</span>
                </div>
                <p className="text-sm mb-4 subtitulo-claim text-[10px]" style={{ color: "var(--madera-oscura)" }}>
                  Se llevó la partida
                </p>
                <Link href="/" className="btn btn-primary">
                  Volver al inicio
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function JugadoresRealesBadge({
  jugadores,
  miId
}: {
  jugadores: Jugador[];
  miId: string | null;
}) {
  if (!jugadores.length) return null;
  return (
    <div
      className="flex items-center gap-0.5"
      title="Primos reales conectados"
    >
      <div className="flex -space-x-1.5">
        {jugadores.map((j) => (
          <div
            key={j.id}
            className={`w-6 h-6 rounded-full overflow-hidden border-[1.5px] ${
              j.id === miId ? "border-dorado" : "border-border"
            } ${!j.conectado ? "grayscale opacity-50" : ""}`}
            title={j.nombre + (j.id === miId ? " (vos)" : "")}
          >
            <img
              src={urlPersonaje(j.personaje)}
              alt={j.nombre}
              className="w-full h-full object-cover object-top"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ListaJugadoresEspera({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string | null;
}) {
  const total = estado.modo === "2v2" ? 4 : 2;
  const slots = Array.from({ length: total }).map((_, i) => {
    const j = estado.jugadores.find((x) => x.asiento === i && !x.esBot);
    return { i, j };
  });
  return (
    <div className="grid grid-cols-2 gap-2">
      {slots.map(({ i, j }) => (
        <div
          key={i}
          className={`flex items-center gap-2 p-2.5 rounded text-left transition ${
            j
              ? "bg-surface-2 border border-border"
              : "border-2 border-dashed border-border/60"
          }`}
        >
          {j ? (
            <>
              <img
                src={urlPersonaje(j.personaje)}
                alt={j.nombre}
                className={`w-10 h-10 rounded-full object-cover object-top border-2 ${
                  j.id === miId ? "border-dorado shadow-md" : "border-border"
                }`}
              />
              <div className="min-w-0">
                <div className="text-sm font-bold leading-tight truncate">
                  {j.nombre}
                  {j.id === miId && (
                    <span className="text-[10px] text-azul-criollo ml-1 font-bold">
                      vos
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-text-dim uppercase tracking-wider mt-0.5 font-bold">
                  Equipo {j.equipo + 1}
                </div>
              </div>
            </>
          ) : (
            <span className="text-text-dim italic text-xs subtitulo-claim w-full text-center">
              Asiento {i + 1} libre
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
