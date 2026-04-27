"use client";
// Partida en modo Solo: corre 100% en el browser. No toca Socket.io ni
// Supabase. El motor del truco y la IA viven en src/lib/truco/.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mesa } from "@/components/Mesa";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { ResultadoEnvido } from "@/components/ResultadoEnvido";
import { ResultadoMano } from "@/components/ResultadoMano";
import { Marcador } from "@/components/Marcador";
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
      puntosObjetivo: puntos
    };
  }, [listoSlug, miSlug, tamanio, puntos]);

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

  return (
    <main className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-bg">
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
            src="/brand/logo.webp"
            alt="Truco Entre Primos"
            className="h-7 w-auto opacity-90 hover:opacity-100 transition"
          />
        </Link>
        <div className="flex-1 min-w-0 text-[11px] text-text-dim truncate subtitulo-claim">
          🤖 vs máquina · {tamanio === 4 ? "2v2" : "1v1"} · a {puntos}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative min-h-0">
            <Mesa estado={estado} miId={miId} />
            <ResultadoEnvido estado={estado} miId={miId} />
            <ResultadoMano estado={estado} miId={miId} />
            <MiAvatarBR estado={estado} miId={miId} />
            <div
              className={
                estado.modo === "2v2"
                  ? "absolute top-48 right-2 z-20 sm:top-52"
                  : "absolute top-3 right-2 z-20"
              }
            >
              <Marcador
                puntosNos={estado.puntos[0]}
                puntosEllos={estado.puntos[1]}
                objetivo={estado.puntosObjetivo}
                miEquipoEs0={miEquipoEs0}
              />
            </div>
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

        {estado.ganadorPartida !== null && (
          <div className="absolute inset-0 sheet-bg flex items-center justify-center z-40 p-4">
            <div className="papel p-6 text-center max-w-sm">
              <div className="text-5xl mb-2">🏆</div>
              <div
                className="titulo-marca text-2xl mb-1"
                style={{
                  color: "var(--carbon)",
                  textShadow: "1px 1px 0 rgba(217,164,65,0.5)"
                }}
              >
                Equipo{" "}
                <span
                  className="acento"
                  style={{ color: "var(--azul-criollo)" }}
                >
                  {estado.ganadorPartida + 1}
                </span>
              </div>
              <p
                className="text-sm mb-4 subtitulo-claim text-[10px]"
                style={{ color: "var(--madera-oscura)" }}
              >
                {miEquipoEs0 === (estado.ganadorPartida === 0)
                  ? "¡Ganaste!"
                  : "Perdiste."}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    // Hard reload para garantizar que el motor empiece
                    // de cero con un nuevo reparto contra el mismo oponente.
                    borrarSnapshotLocal();
                    window.location.href = `/jugar/solo/partida?tamanio=${tamanio}&puntos=${puntos}`;
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
        )}
      </div>
    </main>
  );
}
