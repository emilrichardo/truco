"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  cerrarSalaOnline,
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
import { MenuCompartir } from "@/components/MenuCompartir";
import { useAudioJuego } from "@/lib/audio/useAudioJuego";

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const salaId = params.id;
  const [miSlug, , listoSlug] = usePersonajeLocal();
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [unidoIntentado, setUnidoIntentado] = useState(false);
  const [chatNoVisto, setChatNoVisto] = useState(0);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [menuCompartir, setMenuCompartir] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const lastChatLen = useRef(0);

  const { estado, salaMeta, error: errorSala } = useSalaOnline(salaId);

  // Audio del juego: cantos, cartas, reacciones.
  useAudioJuego(estado, miId);

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
  const cerrarSala = useCallback(async () => {
    if (cerrando) return;
    setCerrando(true);
    await cerrarSalaOnline(salaId);
    router.replace("/");
  }, [salaId, cerrando, router]);
  const abrirChat = useCallback(() => {
    setChatAbierto(true);
    setChatNoVisto(0);
  }, []);

  const urlSala =
    typeof window !== "undefined"
      ? `${window.location.origin}/jugar/sala/${salaId}`
      : "";

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
      <header className="flex items-center gap-2 px-3 py-2 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
        <Link href="/" className="hidden sm:inline-block">
          <img
            src="/brand/logo.png"
            alt="Truco Entre Primos"
            className="h-7 w-auto opacity-90 hover:opacity-100 transition"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-text-dim subtitulo-claim leading-none">
            Sala
          </div>
          <div className="font-display text-base sm:text-lg text-dorado leading-tight truncate">
            {salaId}
          </div>
        </div>
        {!estado.iniciada && (
          <button
            onClick={() => setMenuCompartir(true)}
            className="btn btn-primary !px-3 !py-1.5 !min-h-0 text-xs flex items-center gap-1.5"
          >
            <span aria-hidden>📤</span>
            <span>Compartir enlace</span>
          </button>
        )}
        {estado.iniciada && (
          <>
            <button
              onClick={abrirChat}
              className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs relative md:hidden"
              title="Chat de la mesa"
            >
              💬
              {chatNoVisto > 0 && (
                <span className="absolute -top-1 -right-1 bg-red text-text text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                  {chatNoVisto > 9 ? "9+" : chatNoVisto}
                </span>
              )}
            </button>
            <button
              onClick={() => setMenuCompartir(true)}
              className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
              title="Compartir"
            >
              📤
            </button>
            <button
              onClick={() => setConfirmSalir(true)}
              className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
              title="Salir"
            >
              ✕
            </button>
          </>
        )}
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
        <SalaEspera
          estado={estado}
          miId={miId}
          onIniciar={iniciar}
          onCerrar={() => setConfirmSalir(true)}
          cerrando={cerrando}
        />
      )}

      {/* Layout principal: mesa flexible + chat lateral en desktop / drawer en mobile */}
      {estado.iniciada && yaSoyJugador && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Columna principal */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 relative min-h-0">
              <Mesa estado={estado} miId={miId!} />
              <UltimoCanto estado={estado} miId={miId!} />
              {/* Marcador flotante: palitos compactos, esquina superior derecha */}
              <div className="absolute top-2 right-2 z-20">
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

      {/* Menú de compartir enlace */}
      {menuCompartir && (
        <MenuCompartir
          salaId={salaId}
          url={urlSala}
          onCerrar={() => setMenuCompartir(false)}
        />
      )}

      {/* Confirmación cerrar sala */}
      {confirmSalir && (
        <div
          className="fixed inset-0 sheet-bg flex items-center justify-center z-50 p-4"
          onClick={() => setConfirmSalir(false)}
        >
          <div
            className="card p-5 max-w-sm w-full text-center border-t-4 border-t-red"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="titulo-marca text-xl mb-2">
              ¿Cerrar la <span className="acento">sala</span>?
            </div>
            <p className="text-text-dim text-sm mb-4">
              {estado.iniciada
                ? "La partida se va a dar por terminada para todos."
                : "La sala se elimina y los primos invitados no van a poder entrar."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSalir(false)}
                className="btn flex-1"
              >
                Volver
              </button>
              <button
                onClick={cerrarSala}
                disabled={cerrando}
                className="btn btn-danger flex-1"
              >
                {cerrando ? "Cerrando…" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Sala en espera: layout grid 1×2 (solo a solo) o 2×2 (en parejas) que
 * ocupa la pantalla, con barra de acciones abajo (Cerrar / Iniciar). */
function SalaEspera({
  estado,
  miId,
  onIniciar,
  onCerrar,
  cerrando
}: {
  estado: EstadoJuego;
  miId: string | null;
  onIniciar: () => void;
  onCerrar: () => void;
  cerrando: boolean;
}) {
  const total = estado.modo === "2v2" ? 4 : 2;
  const slots = Array.from({ length: total }).map((_, i) => {
    const j = estado.jugadores.find((x) => x.asiento === i && !x.esBot);
    return { i, j };
  });
  const ocupados = slots.filter((s) => !!s.j).length;
  const faltan = total - ocupados;
  const todosListos = faltan === 0;

  // Grid: 2 cols × 1 fila (1v1) o 2 cols × 2 filas (2v2).
  const gridCls = total === 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-1";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className={`flex-1 grid ${gridCls} gap-3 p-3 sm:p-4`}>
        {slots.map(({ i, j }) => (
          <SlotEspera key={i} asiento={i} jugador={j} esYo={j?.id === miId} />
        ))}
      </div>
      <div className="border-t border-border bg-surface/40 p-3 flex items-center gap-2">
        <button
          onClick={onCerrar}
          disabled={cerrando}
          className="btn btn-danger flex-1 sm:flex-initial sm:px-6"
        >
          Cerrar sala
        </button>
        <div className="flex-1 text-center text-xs subtitulo-claim">
          {todosListos ? (
            <span className="text-dorado">¡Todos listos!</span>
          ) : (
            <span className="text-text-dim">
              {faltan === 1 ? "Falta 1 primo" : `Faltan ${faltan} primos`}
            </span>
          )}
        </div>
        <button
          onClick={onIniciar}
          disabled={!todosListos}
          className="btn btn-primary flex-1 sm:flex-initial sm:px-6"
          title={todosListos ? "Empezar partida" : "Esperá a que se sienten todos"}
        >
          Iniciar
        </button>
      </div>
    </div>
  );
}

function SlotEspera({
  asiento,
  jugador,
  esYo
}: {
  asiento: number;
  jugador?: Jugador;
  esYo: boolean;
}) {
  const equipo = (asiento % 2) as 0 | 1;
  const colorEquipo = equipo === 0 ? "border-dorado" : "border-azul-criollo";
  return (
    <div
      className={`relative card flex flex-col items-center justify-center gap-2 p-3 sm:p-4 transition ${
        jugador
          ? `border-l-4 ${colorEquipo}`
          : "border-2 border-dashed border-border/60 bg-transparent"
      }`}
    >
      <div className="absolute top-2 right-2 text-[9px] text-text-dim subtitulo-claim font-bold">
        Eq {equipo + 1}
      </div>
      {jugador ? (
        <>
          <div className="relative">
            <img
              src={urlPersonaje(jugador.personaje)}
              alt={jugador.nombre}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover object-top border-[3px] shadow-md ${
                esYo ? "border-dorado halo" : colorEquipo
              }`}
            />
            {esYo && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-dorado text-carbon text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded">
                vos
              </span>
            )}
          </div>
          <div className="text-center">
            <div className="font-display text-base sm:text-lg leading-tight truncate max-w-[140px]">
              {jugador.nombre}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center text-text-dim/40 text-3xl">
            ?
          </div>
          <div className="text-center text-text-dim/70 text-xs italic subtitulo-claim">
            Esperando primo
          </div>
        </>
      )}
    </div>
  );
}
