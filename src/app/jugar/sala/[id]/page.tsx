"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  abandonarSalaOnline,
  agregarBotOnline,
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
import { ContadorPuntos } from "@/components/ContadorPuntos";
import { ChatFlotante } from "@/components/ChatFlotante";
import { MenuCompartir } from "@/components/MenuCompartir";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";
import { HeaderMarca } from "@/components/HeaderMarca";
import { MiAvatarBR } from "@/components/MiAvatarBR";
import { setMusicaUIOculta } from "@/components/MusicaAmbiental";
import { useAudioJuego } from "@/lib/audio/useAudioJuego";
import { usePreloadCartas } from "@/lib/preload";

export default function SalaPage() {
  // Preload de cartas al entrar a la sala — si el usuario abrió el link
  // directo o refrescó, no pasó por el lobby y nadie precargó. Idempotente.
  usePreloadCartas();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const salaId = params.id;
  const [miSlug, setMiSlug, listoSlug] = usePersonajeLocal();
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [unidoIntentado, setUnidoIntentado] = useState(false);
  const [chatNoVisto, setChatNoVisto] = useState(0);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [menuCompartir, setMenuCompartir] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [avisoAbandono, setAvisoAbandono] = useState<string | null>(null);
  const lastChatLen = useRef(0);
  const ultimaListaJugadores = useRef<
    { id: string; nombre: string; conectado: boolean }[]
  >([]);
  const avisoTimerRef = useRef<number | null>(null);

  const { estado, salaMeta, error: errorSala } = useSalaOnline(salaId);
  const chatVisibleCount = useMemo(() => {
    if (!estado || !miId) return 0;
    return estado.chat.filter(
      (m) =>
        !m.destinatarioId || m.destinatarioId === miId || m.jugadorId === miId
    ).length;
  }, [estado, miId]);

  // Audio del juego: cantos, cartas, reacciones.
  useAudioJuego(estado, miId);

  useEffect(() => {
    if (errorSala) setError(errorSala);
  }, [errorSala]);

  // No redirigimos a "/" si no hay personaje — mostramos un selector inline
  // (ver más abajo) para que la persona que entra por un link compartido
  // elija su primo y se sume directamente a esta sala.

  useEffect(() => {
    const s = leerSesion(salaId);
    if (s) setMiId(s.jugadorId);
  }, [salaId]);

  // Contador de chat no visto cuando el drawer está cerrado.
  useEffect(() => {
    if (!estado) return;
    if (chatAbierto) {
      lastChatLen.current = chatVisibleCount;
      return;
    }
    if (chatVisibleCount > lastChatLen.current) {
      setChatNoVisto((n) => n + (chatVisibleCount - lastChatLen.current));
      lastChatLen.current = chatVisibleCount;
    }
  }, [estado, chatVisibleCount, chatAbierto]);

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
    async (m: {
      texto?: string;
      reaccion?: string;
      sticker?: string;
      destinatarioId?: string;
    }) => {
      if (!miId) return;
      await enviarChatOnline(salaId, miId, m);
    },
    [salaId, miId]
  );
  const iniciar = useCallback(
    async (mezclarEquipos: boolean) => {
      const r = await iniciarPartidaOnline(
        salaId,
        miId ?? undefined,
        mezclarEquipos
      );
      if (!r.ok) setError(r.error || "No se pudo iniciar.");
    },
    [salaId, miId]
  );
  // Trackeamos en qué asiento está cargando el bot — así sólo ese slot
  // muestra "Cargando bot…" en vez de pintar todos los slots vacíos a la
  // vez. Si hay un asiento cargando, los otros botones se deshabilitan
  // para evitar doble pedido a la edge function.
  const [cargandoEnAsiento, setCargandoEnAsiento] = useState<number | null>(
    null
  );
  const sumarBot = useCallback(
    async (asiento: number) => {
      if (cargandoEnAsiento !== null) return;
      setCargandoEnAsiento(asiento);
      try {
        const r = await agregarBotOnline(salaId, miId ?? undefined);
        if (!r.ok) setError(r.error || "No se pudo agregar bot.");
      } finally {
        setCargandoEnAsiento(null);
      }
    },
    [salaId, miId, cargandoEnAsiento]
  );
  const quitarBot = useCallback(
    async (botId: string) => {
      const r = await abandonarSalaOnline(salaId, botId);
      if (!r.ok) setError(r.error || "No se pudo quitar el bot.");
    },
    [salaId]
  );
  const cerrarSala = useCallback(async () => {
    if (cerrando) return;
    setCerrando(true);
    await cerrarSalaOnline(salaId, miId ?? undefined);
    router.replace("/");
  }, [salaId, miId, cerrando, router]);
  const abandonarSala = useCallback(async () => {
    if (cerrando || !miId) return;
    setCerrando(true);
    await abandonarSalaOnline(salaId, miId);
    router.replace("/");
  }, [salaId, miId, cerrando, router]);
  const abrirChat = useCallback(() => {
    // En mobile abre el sheet, en desktop muestra el sidebar.
    setChatAbierto(true);
    setSidebarVisible(true);
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

  // Detectar abandonos: si la lista de jugadores se achica o uno pasa a
  // desconectado, mostramos un cartel arriba con quién se fue.
  // En la pantalla de espera (sala creada pero partida no iniciada) el
  // botón de música se solapa con "Compartir enlace" del header. Lo
  // ocultamos hasta que arranque la partida.
  useEffect(() => {
    setMusicaUIOculta(!estado?.iniciada);
    return () => setMusicaUIOculta(false);
  }, [estado?.iniciada]);

  useEffect(() => {
    if (!estado) return;
    const actuales = estado.jugadores.map((j) => ({
      id: j.id,
      nombre: j.nombre,
      conectado: j.conectado !== false
    }));
    const previa = ultimaListaJugadores.current;
    if (previa.length > 0) {
      const idsActuales = new Set(actuales.map((a) => a.id));
      const previosConectadosPorId = new Map(
        previa.filter((p) => p.conectado).map((p) => [p.id, p])
      );
      // Sacaron a alguien (espera) o uno pasó de conectado a desconectado.
      const removido = previa.find(
        (p) => p.conectado && !idsActuales.has(p.id)
      );
      const desconectado = actuales.find(
        (a) => !a.conectado && previosConectadosPorId.has(a.id)
      );
      const idoNombre = removido?.nombre || desconectado?.nombre;
      if (idoNombre) {
        setAvisoAbandono(`${idoNombre} se fue de la mesa`);
        if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
        avisoTimerRef.current = window.setTimeout(() => {
          setAvisoAbandono(null);
          avisoTimerRef.current = null;
        }, 3500);
      }
    }
    ultimaListaJugadores.current = actuales;
    return () => {
      if (avisoTimerRef.current) {
        clearTimeout(avisoTimerRef.current);
        avisoTimerRef.current = null;
      }
    };
  }, [estado]);

  if (!estado) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center text-center px-4">
        <div>
          <img
            src="/brand/logo.webp"
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

  // Llegué por un link compartido sin tener primo elegido todavía: mostramos
  // un selector inline para que elija acá mismo y se sume automáticamente.
  if (listoSlug && !miSlug) {
    return (
      <ElegirPrimoEnSala
        salaId={salaId}
        modo={estado.modo}
        onElegir={(slug) => setMiSlug(slug)}
      />
    );
  }

  const yaSoyJugador = miId && estado.jugadores.some((j) => j.id === miId);
  const total = estado.modo === "2v2" ? 4 : 2;
  const realesNecesarios = total - jugadoresReales.length;
  const meEnCurso = estado.iniciada && yaSoyJugador;
  const miEquipoEs0 =
    estado.jugadores.find((j) => j.id === miId)?.equipo === 0;
  // Para el marcador inline en el header (igual al modo Solo). En 1v1
  // mostramos los nombres reales; en 2v2 los rótulos genéricos.
  const yo = estado.jugadores.find((j) => j.id === miId);
  const es1v1 = estado.modo === "1v1";
  const rivalParaTitulo = es1v1
    ? estado.jugadores.find((j) => j.id !== miId)
    : undefined;
  const tituloNos = es1v1 && yo ? yo.nombre : "Nos";
  const tituloEllos = es1v1 && rivalParaTitulo ? rivalParaTitulo.nombre : "Ellos";

  return (
    <main className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-bg">
      {/* Header: en lobby muestra el alias de la sala + compartir; en
       *  partida usa el mismo layout que el modo Solo (back arrow + score
       *  inline centrado). El chat y la música son botones flotantes. */}
      {!estado.iniciada ? (
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
          <button
            onClick={() => setConfirmSalir(true)}
            className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs shrink-0"
            title="Salir de la sala"
          >
            ←
          </button>
          <Link href="/" className="hidden sm:inline-block">
            <img
              src="/brand/logo.webp"
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
          <button
            onClick={() => setMenuCompartir(true)}
            className="btn btn-primary !px-3 !py-1.5 !min-h-0 text-xs flex items-center gap-1.5 shrink-0 font-bold"
            title="Compartir enlace de la sala"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M10 13a5 5 0 0 0 7.07 0l3.54-3.54a5 5 0 0 0-7.07-7.07l-1.41 1.41" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3.54 3.54a5 5 0 0 0 7.07 7.07l1.41-1.41" />
            </svg>
            <span>Compartir sala</span>
          </button>
        </header>
      ) : (
        <header className="relative flex items-center px-2 py-1.5 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
          <button
            onClick={() => setConfirmSalir(true)}
            className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs shrink-0"
            title="Salir de la partida"
          >
            ←
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="text-dorado truncate max-w-[90px]">
                {tituloNos}
              </span>
              <ContadorPuntos
                valor={miEquipoEs0 ? estado.puntos[0] : estado.puntos[1]}
                esMio
              />
            </div>
            <span className="text-dorado/60 text-base">—</span>
            <div className="flex items-center gap-1.5">
              <ContadorPuntos
                valor={miEquipoEs0 ? estado.puntos[1] : estado.puntos[0]}
                esMio={false}
              />
              <span className="text-crema truncate max-w-[90px]">
                {tituloEllos}
              </span>
            </div>
          </div>
        </header>
      )}

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
          onSumarBot={sumarBot}
          onQuitarBot={quitarBot}
          cargandoEnAsiento={cargandoEnAsiento}
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
              <Mesa estado={estado} miId={miId!} enviarChat={enviarChat} />
              {/* Mi avatar: BR del área de mesa (encima del PanelAcciones)
               * para que quede arriba de mi mano de cartas. */}
              <MiAvatarBR estado={estado} miId={miId!} />
              {/* Burbuja con últimos 3 mensajes humanos */}
              <ChatFlotante
                estado={estado}
                miId={miId!}
                onAbrir={abrirChat}
                oculto={chatAbierto}
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

          {/* Chat: panel lateral en desktop (oculto si sidebarVisible=false) */}
          {sidebarVisible && (
            <aside className="hidden md:flex w-80 lg:w-96 border-l border-border flex-col p-2 overflow-hidden relative">
              <button
                onClick={() => setSidebarVisible(false)}
                className="absolute top-2 right-2 z-10 btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
                title="Ocultar chat"
              >
                ✕
              </button>
              <Chat estado={estado} miId={miId!} enviar={enviarChat} />
            </aside>
          )}
          {/* Chat: drawer en mobile */}
          {chatAbierto && (
            <div
              className="fixed inset-0 sheet-bg z-[600] md:hidden flex items-end"
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
            <div className="absolute inset-0 sheet-bg flex items-center justify-center z-[1000] p-4">
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
          className="fixed inset-0 sheet-bg flex items-center justify-center z-[1000] p-4"
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
  onSumarBot,
  onQuitarBot,
  cargandoEnAsiento,
  cerrando
}: {
  estado: EstadoJuego;
  miId: string | null;
  onIniciar: (mezclarEquipos: boolean) => void;
  onCerrar: () => void;
  onSumarBot?: (asiento: number) => void;
  onQuitarBot?: (botId: string) => void;
  cargandoEnAsiento?: number | null;
  cerrando: boolean;
}) {
  const total = estado.modo === "2v2" ? 4 : 2;
  const slots = Array.from({ length: total }).map((_, i) => {
    const j = estado.jugadores.find((x) => x.asiento === i);
    return { i, j };
  });
  const ocupados = slots.filter((s) => !!s.j).length;
  const faltan = total - ocupados;
  const todosListos = faltan === 0;
  const [mezclarEquipos, setMezclarEquipos] = useState(false);

  // Grid: 2 cols × 1 fila (1v1) o 2 cols × 2 filas (2v2).
  const gridCls = total === 4 ? "grid-cols-2 grid-rows-2" : "grid-cols-2 grid-rows-1";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className={`flex-1 grid ${gridCls} gap-3 p-3 sm:p-4`}>
        {slots.map(({ i, j }) => {
          const hayCargando = cargandoEnAsiento != null;
          const esEstaSlotCargando = cargandoEnAsiento === i;
          return (
            <SlotEspera
              key={i}
              asiento={i}
              jugador={j}
              esYo={j?.id === miId}
              onSumarBot={!j && onSumarBot ? () => onSumarBot(i) : undefined}
              cargandoBot={esEstaSlotCargando}
              deshabilitarBot={hayCargando && !esEstaSlotCargando}
              onQuitarBot={
                j?.esBot && onQuitarBot ? () => onQuitarBot(j.id) : undefined
              }
            />
          );
        })}
      </div>
      {/* Toggle: solo en 2v2, donde tiene sentido sortear compañeros */}
      {total === 4 && (
        <div className="px-3 sm:px-4 py-2 flex items-center justify-center">
          <label className="flex items-center gap-2 text-xs text-text-dim cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mezclarEquipos}
              onChange={(e) => setMezclarEquipos(e.target.checked)}
              className="accent-[var(--dorado)] w-4 h-4"
            />
            <span>Sortear compañeros al azar</span>
          </label>
        </div>
      )}
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
          onClick={() => onIniciar(mezclarEquipos)}
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
  esYo,
  onSumarBot,
  onQuitarBot,
  cargandoBot,
  deshabilitarBot
}: {
  asiento: number;
  jugador?: Jugador;
  esYo: boolean;
  onSumarBot?: () => void;
  onQuitarBot?: () => void;
  cargandoBot?: boolean;
  deshabilitarBot?: boolean;
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
              className={`w-20 sm:w-24 aspect-[3/4] rounded-md object-cover object-top border-2 shadow-md ${
                esYo ? "border-dorado halo" : colorEquipo
              }`}
            />
            {esYo && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-dorado text-carbon text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded">
                vos
              </span>
            )}
            {jugador.esBot && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-carbon border border-dorado/50 text-crema/80 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded">
                bot
              </span>
            )}
            {jugador.esBot && onQuitarBot && (
              <button
                type="button"
                onClick={onQuitarBot}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rojo-fernet/90 hover:bg-rojo-fernet text-crema text-[10px] font-bold flex items-center justify-center shadow-md border border-carbon"
                title={`Quitar a ${jugador.nombre}`}
                aria-label={`Quitar a ${jugador.nombre}`}
              >
                ✕
              </button>
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
          <div className="w-20 sm:w-24 aspect-[3/4] rounded-md border-2 border-dashed border-border/60 flex items-center justify-center text-text-dim/40 text-3xl">
            ?
          </div>
          <div className="text-center text-text-dim/70 text-xs italic subtitulo-claim">
            Esperando primo
          </div>
          {onSumarBot && (
            <button
              type="button"
              onClick={onSumarBot}
              disabled={cargandoBot || deshabilitarBot}
              className="btn btn-ghost !px-2 !py-1 !min-h-0 text-[10px] mt-1 disabled:opacity-50"
              title="Llenar este lugar con un bot"
            >
              {cargandoBot ? (
                <span className="flex items-center gap-1">
                  <span className="parpadeo">⏳</span>
                  <span>Cargando bot…</span>
                </span>
              ) : (
                "+ Sumar bot"
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Pantalla intermedia: alguien que abre el link compartido sin tener primo
 *  guardado. Elige acá mismo y queda dentro de la sala (no rebota al home). */
function ElegirPrimoEnSala({
  salaId,
  modo,
  onElegir
}: {
  salaId: string;
  modo: "1v1" | "2v2";
  onElegir: (slug: string) => void;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-xl mx-auto">
      <HeaderMarca variante="compacto" />
      <div className="card p-4 mt-5 mb-3 text-center border-l-4 border-l-azul-criollo">
        <div className="label-slim acento-azul">Te invitaron a</div>
        <div className="font-display text-xl text-dorado">{salaId}</div>
        <div className="text-text-dim text-xs mt-1 subtitulo-claim">
          {modo === "2v2" ? "Partida en parejas" : "Solo a solo"}
        </div>
      </div>
      <p className="text-center text-text-dim text-sm mb-4">
        Elegí qué primo te representa para entrar.
      </p>
      <div className="card p-4">
        <SelectorPersonaje
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
        />
        <button
          onClick={() => seleccionado && onElegir(seleccionado)}
          disabled={!seleccionado}
          className="btn btn-primary w-full mt-4"
        >
          {seleccionado ? "Entrar a la sala" : "Elegí un primo"}
        </button>
      </div>
    </main>
  );
}
