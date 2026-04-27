"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  enviarAccionOnline,
  enviarChatOnline,
  guardarSesion,
  iniciarPartidaOnline,
  leerSesion,
  unirseSalaOnline,
  useSalaOnline
} from "@/lib/salaOnline";
import { usePersonajeLocal } from "@/lib/personaje";
import { getPersonaje, urlPersonaje } from "@/data/jugadores";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";
import { Mesa } from "@/components/Mesa";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { UltimoCanto } from "@/components/UltimoCanto";
import { Marcador } from "@/components/Marcador";
import { ChatFlotante } from "@/components/ChatFlotante";

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const salaId = params.id;
  const [miSlug, , listoSlug] = usePersonajeLocal();
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [unidoIntentado, setUnidoIntentado] = useState(false);
  const [chatNoVisto, setChatNoVisto] = useState(0);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const lastChatLen = useRef(0);

  const { estado, salaMeta, error: errorSala } = useSalaOnline(salaId);

  useEffect(() => {
    if (errorSala) setError(errorSala);
  }, [errorSala]);

  useEffect(() => {
    if (listoSlug && !miSlug) router.replace("/");
  }, [listoSlug, miSlug, router]);

  useEffect(() => {
    const s = leerSesion(salaId);
    if (s) setMiId(s.jugadorId);
  }, [salaId]);

  // Contador de chat no visto cuando el drawer está cerrado.
  useEffect(() => {
    if (!estado) return;
    if (chatAbierto) {
      lastChatLen.current = estado.chat.length;
      return;
    }
    if (estado.chat.length > lastChatLen.current) {
      setChatNoVisto((n) => n + (estado.chat.length - lastChatLen.current));
      lastChatLen.current = estado.chat.length;
    }
  }, [estado?.chat.length, chatAbierto]);

  // Auto-unirse a la sala si ya tengo perfil pero no estoy en jugadores.
  useEffect(() => {
    if (!estado || !miSlug || unidoIntentado) return;
    const yaSoy = miId && estado.jugadores.some((j) => j.id === miId);
    if (yaSoy || (salaMeta?.iniciada ?? false)) return;
    setUnidoIntentado(true);
    (async () => {
      const r = await unirseSalaOnline({
        salaId,
        nombre: getPersonaje(miSlug)?.nombre || "Primo",
        personaje: miSlug
      });
      if (!r.ok || !r.jugador_id) {
        setError(r.error || "No se pudo entrar.");
        return;
      }
      setMiId(r.jugador_id);
      guardarSesion({
        salaId,
        jugadorId: r.jugador_id,
        perfilId: r.perfil_id
      });
    })();
  }, [estado, miSlug, miId, unidoIntentado, salaId, salaMeta?.iniciada]);

  const enviarAccion = useCallback(
    async (a: Accion) => {
      if (!miId) return;
      const r = await enviarAccionOnline(salaId, miId, a);
      if (!r.ok) setError(r.error || "Acción rechazada.");
    },
    [salaId, miId]
  );
  const enviarChat = useCallback(
    async (m: { texto?: string; reaccion?: string }) => {
      if (!miId) return;
      await enviarChatOnline(salaId, miId, m);
    },
    [salaId, miId]
  );
  const iniciar = useCallback(async () => {
    const r = await iniciarPartidaOnline(salaId);
    if (!r.ok) setError(r.error || "No se pudo iniciar.");
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
        <button
          onClick={() => setConfirmSalir(true)}
          className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
          title="Salir de la partida"
        >
          ←
        </button>
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
              {/* Marcador flotante: visible siempre, esquina superior derecha */}
              <div className="absolute top-2 right-2 z-20 w-44 sm:w-52">
                <Marcador
                  puntosNos={estado.puntos[0]}
                  puntosEllos={estado.puntos[1]}
                  objetivo={estado.puntosObjetivo}
                  miEquipoEs0={miEquipoEs0}
                />
              </div>
              {/* Burbuja con últimos 3 mensajes humanos */}
              <ChatFlotante
                estado={estado}
                miId={miId!}
                onAbrir={abrirChat}
              />
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
            <Chat estado={estado} miId={miId!} enviar={enviarChat} />
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
                  <Chat estado={estado} miId={miId!} enviar={enviarChat} />
                </div>
              </div>
            </div>
          )}

          {/* Modal confirmación salir */}
          {confirmSalir && (
            <div
              className="absolute inset-0 sheet-bg flex items-center justify-center z-50 p-4"
              onClick={() => setConfirmSalir(false)}
            >
              <div
                className="card p-5 max-w-sm w-full text-center border-t-4 border-t-red"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="titulo-marca text-xl mb-2">
                  ¿Salir de la <span className="acento">partida</span>?
                </div>
                <p className="text-text-dim text-sm mb-4">
                  Si la partida está en curso, los demás primos van a poder
                  seguir jugando. Vos quedás afuera.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmSalir(false)}
                    className="btn flex-1"
                  >
                    Quedarme
                  </button>
                  <Link href="/" className="btn btn-danger flex-1">
                    Salir
                  </Link>
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
