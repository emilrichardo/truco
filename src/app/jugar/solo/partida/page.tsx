"use client";
// Partida en modo Solo: corre 100% en el browser. No toca Socket.io ni
// Supabase. El motor del truco y la IA viven en src/lib/truco/.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mesa } from "@/components/Mesa";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { CartaEspanola } from "@/components/CartaEspanola";
import { PrecargaCartas } from "@/components/PrecargaCartas";
import { ResultadoEnvido } from "@/components/ResultadoEnvido";
import { ResultadoMano } from "@/components/ResultadoMano";
import { ChatFlotante } from "@/components/ChatFlotante";
import { MiAvatarBR } from "@/components/MiAvatarBR";
import { useAudioJuego } from "@/lib/audio/useAudioJuego";
import {
  useSalaLocal,
  borrarSnapshotLocal,
  type ConfigSalaLocal
} from "@/lib/salaLocal";
import { usePersonajeLocal } from "@/lib/personaje";
import { getPersonaje } from "@/data/jugadores";

export default function PartidaSoloPage() {
  // Suspense boundary requerido por Next 14 para useSearchParams() en build.
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] flex items-center justify-center">
          <div className="text-dorado font-display text-xl parpadeo">
            Repartiendo…
          </div>
        </main>
      }
    >
      <PartidaSoloInterno />
    </Suspense>
  );
}

function PartidaSoloInterno() {
  const router = useRouter();
  const params = useSearchParams();
  const [miSlug, , listoSlug] = usePersonajeLocal();
  const [chatAbierto, setChatAbierto] = useState(false);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);

  const tamanio = (Number(params.get("tamanio")) === 4 ? 4 : 2) as 2 | 4;
  const puntos = (Number(params.get("puntos")) === 30 ? 30 : 15) as 15 | 30;
  // Si la URL trae `?bots=slug1,slug2,slug3` (orden por asiento), forzamos
  // a esos personajes. Lo usa el botón Revancha para mantener exactamente
  // los mismos oponentes entre partidas.
  const botsParam = params.get("bots");

  // Si no hay primo guardado, mandar al inicio.
  useEffect(() => {
    if (listoSlug && !miSlug) router.replace("/");
  }, [listoSlug, miSlug, router]);

  const config = useMemo<ConfigSalaLocal | null>(() => {
    if (!listoSlug || !miSlug) return null;
    const yo = getPersonaje(miSlug);
    return {
      miNombre: yo?.nombre || "Primo",
      miPersonaje: miSlug,
      tamanio,
      puntosObjetivo: puntos,
      botPersonajes: botsParam ? botsParam.split(",").filter(Boolean) : undefined
    };
  }, [listoSlug, miSlug, tamanio, puntos, botsParam]);

  const { estado, miId, enviarAccion, enviarChat } = useSalaLocal(config);

  // Audio del juego: cantos, cartas, reacciones.
  useAudioJuego(estado, miId);

  if (!estado || !miId) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center text-center px-4">
        <div>
          <img
            src="/brand/logo.webp"
            alt="Truco Entre Primos"
            className="w-32 mx-auto mb-4 opacity-80 parpadeo"
          />
          <div className="text-dorado font-display text-xl">Repartiendo…</div>
          <div className="text-text-dim text-xs mt-2 subtitulo-claim">
            Modo Solo · vs máquina
          </div>
        </div>
      </main>
    );
  }

  const miEquipoEs0 = estado.jugadores.find((j) => j.id === miId)?.equipo === 0;
  // En 1v1 mostramos los nombres reales en el marcador y el resumen en
  // vez de los abstractos "Nos / Ellos" — así Richi ve "Richi vs Lucas"
  // directamente. En 2v2 se mantienen los rótulos de equipo.
  const es1v1 = estado.jugadores.length === 2;
  const yo = estado.jugadores.find((j) => j.id === miId);
  const rival = es1v1
    ? estado.jugadores.find((j) => j.id !== miId)
    : undefined;
  const tituloNos = es1v1 && yo ? yo.nombre : "Nos";
  const tituloEllos = es1v1 && rival ? rival.nombre : "Ellos";

  return (
    <main className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-bg">
      <PrecargaCartas />
      <header className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
        <button
          onClick={() => setConfirmSalir(true)}
          className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs shrink-0"
          title="Salir de la partida"
        >
          ←
        </button>

        {/* Marcador prominente al centro del header. Reservamos un slot
         *  vacío a la derecha (140px) para que los controles de música
         *  flotantes (fixed top-right) no tapen el score. */}
        <div className="flex-1 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-dorado truncate max-w-[90px]">
              {tituloNos}
            </span>
            <span
              className="font-display text-lg text-crema leading-none"
              style={{ minWidth: "1.4em", textAlign: "right" }}
            >
              {miEquipoEs0 ? estado.puntos[0] : estado.puntos[1]}
            </span>
          </div>
          <span className="text-dorado/60 text-base">—</span>
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="font-display text-lg text-crema leading-none"
              style={{ minWidth: "1.4em", textAlign: "left" }}
            >
              {miEquipoEs0 ? estado.puntos[1] : estado.puntos[0]}
            </span>
            <span className="text-crema truncate max-w-[90px]">
              {tituloEllos}
            </span>
          </div>
        </div>

        {/* Reserva derecha para no chocar con MusicaAmbiental (fixed
         *  top-1.5 right-2 z-50, ~140px de ancho con sus 2 botones +
         *  slider). Dejamos el espacio vacío en el flex; los controles
         *  flotan encima sin tapar el score. */}
        <div className="w-[140px] shrink-0" aria-hidden />
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative min-h-0">
            <Mesa estado={estado} miId={miId} />
            <ResultadoEnvido estado={estado} miId={miId} />
            <ResultadoMano estado={estado} miId={miId} />
            <MiAvatarBR estado={estado} miId={miId} />
            <ChatFlotante
              estado={estado}
              miId={miId}
              onAbrir={() => setChatAbierto(true)}
            />
          </div>
          <PanelAcciones estado={estado} miId={miId} enviar={enviarAccion} />
        </div>

        {sidebarVisible && (
          <aside className="hidden md:flex w-80 lg:w-96 border-l border-border flex-col p-2 overflow-hidden relative">
            <button
              onClick={() => setSidebarVisible(false)}
              className="absolute top-2 right-2 z-10 btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
              title="Ocultar chat"
            >
              ✕
            </button>
            <Chat estado={estado} miId={miId} enviar={enviarChat} />
          </aside>
        )}
        {!sidebarVisible && (
          <button
            onClick={() => setSidebarVisible(true)}
            className="hidden md:flex absolute top-2 right-2 z-30 btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
            title="Mostrar chat"
          >
            💬
          </button>
        )}

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
                <Chat estado={estado} miId={miId} enviar={enviarChat} />
              </div>
            </div>
          </div>
        )}

        {confirmSalir && estado.ganadorPartida === null && (
          <div
            className="absolute inset-0 sheet-bg flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmSalir(false)}
          >
            <div
              className="card p-5 max-w-sm w-full text-center border-t-4 border-t-red"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="titulo-marca text-xl mb-2">
                ¿Finalizar <span className="acento">partida</span>?
              </div>
              <p className="text-text-dim text-sm mb-4">
                Vas a perder el progreso contra la máquina.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmSalir(false)}
                  className="btn flex-1"
                >
                  Seguir jugando
                </button>
                <Link href="/" className="btn btn-danger flex-1">
                  Finalizar
                </Link>
              </div>
            </div>
          </div>
        )}

        {estado.ganadorPartida !== null && (() => {
          const yoGane = miEquipoEs0 === (estado.ganadorPartida === 0);
          const miEquipoIdx = miEquipoEs0 ? 0 : 1;
          const rivalEquipoIdx = miEquipoEs0 ? 1 : 0;
          const miPuntaje = estado.puntos[miEquipoIdx];
          const rivalPuntaje = estado.puntos[rivalEquipoIdx];
          // Última mano: la que cerró la partida. Si la partida cerró por
          // envido sin cerrar la mano, manoActual sigue siendo la activa
          // (con cartas todavía en hand). Si cerró por truco, está en
          // historialManos. Tomamos la más reciente disponible.
          const ultimaMano =
            estado.historialManos[estado.historialManos.length - 1] ||
            estado.manoActual;
          const rival = estado.jugadores.find((j) => j.id !== miId);
          const cartasRival = ultimaMano && rival
            ? [
                ...(ultimaMano.cartasPorJugador[rival.id] || []),
                ...ultimaMano.bazas.flatMap((b) =>
                  b.jugadas
                    .filter((j) => j.jugadorId === rival.id)
                    .map((j) => j.carta)
                )
              ]
            : [];
          return (
            <div className="absolute inset-0 sheet-bg flex items-center justify-center z-40 p-4 overflow-y-auto">
              <div className="papel p-5 text-center max-w-sm w-full my-4">
                {yoGane && <div className="text-5xl mb-1">🏆</div>}
                <div
                  className="titulo-marca text-2xl mb-1"
                  style={{
                    color: "var(--carbon)",
                    textShadow: "1px 1px 0 rgba(217,164,65,0.5)"
                  }}
                >
                  {yoGane ? "¡Ganaste!" : "Perdiste"}
                </div>
                <p
                  className="text-[10px] mb-4 subtitulo-claim"
                  style={{ color: "var(--madera-oscura)" }}
                >
                  Equipo {(estado.ganadorPartida ?? 0) + 1} se llevó la
                  partida
                </p>

                {/* Marcador final */}
                <div
                  className="grid grid-cols-2 gap-2 mb-4 px-2 py-3 rounded border-2"
                  style={{ borderColor: "var(--dorado-oscuro)" }}
                >
                  <div className="text-center">
                    <div
                      className="text-[10px] uppercase tracking-widest font-bold mb-0.5 truncate"
                      style={{ color: "var(--azul-criollo)" }}
                    >
                      {es1v1 && yo ? yo.nombre : "Nosotros"}
                    </div>
                    <div
                      className="text-3xl font-display"
                      style={{ color: "var(--carbon)" }}
                    >
                      {miPuntaje}
                    </div>
                  </div>
                  <div className="text-center">
                    <div
                      className="text-[10px] uppercase tracking-widest font-bold mb-0.5 truncate"
                      style={{ color: "var(--rojo-fernet)" }}
                    >
                      {es1v1 && rival ? rival.nombre : "Ellos"}
                    </div>
                    <div
                      className="text-3xl font-display"
                      style={{ color: "var(--carbon)" }}
                    >
                      {rivalPuntaje}
                    </div>
                  </div>
                </div>

                {/* Cartas del rival de la última mano */}
                {cartasRival.length > 0 && rival && (
                  <div className="mb-4">
                    <div
                      className="text-[10px] uppercase tracking-widest font-bold mb-2"
                      style={{ color: "var(--madera-oscura)" }}
                    >
                      Cartas de {rival.nombre} en la última mano
                    </div>
                    <div className="flex justify-center gap-1">
                      {cartasRival.slice(0, 3).map((c) => (
                        <CartaEspanola key={c.id} carta={c} tamanio="sm" />
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      // Hard reload para garantizar que el motor empiece
                      // de cero. Pasamos `?bots=slug1,slug2,...` con TODOS
                      // los bots ordenados por asiento — antes en 2v2 sólo
                      // preservaba uno y los otros 2 cambiaban.
                      const slugsBots = estado.jugadores
                        .filter((j) => j.id !== miId)
                        .sort((a, b) => a.asiento - b.asiento)
                        .map((j) => j.personaje);
                      const url = `/jugar/solo/partida?tamanio=${tamanio}&puntos=${puntos}${
                        slugsBots.length
                          ? `&bots=${encodeURIComponent(slugsBots.join(","))}`
                          : ""
                      }`;
                      borrarSnapshotLocal();
                      window.location.href = url;
                    }}
                    className="btn btn-primary w-full"
                  >
                    Revancha
                  </button>
                  <Link href="/jugar/solo" className="btn w-full">
                    Cambiar de oponente
                  </Link>
                  <Link href="/" className="btn btn-ghost w-full text-xs">
                    Volver al inicio
                  </Link>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </main>
  );
}
