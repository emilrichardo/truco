"use client";
// Partida en modo Solo: corre 100% en el browser. No toca Socket.io ni
// Supabase. El motor del truco y la IA viven en src/lib/truco/.
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mesa } from "@/components/Mesa";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { UltimoCanto } from "@/components/UltimoCanto";
import { useSalaLocal, type ConfigSalaLocal } from "@/lib/salaLocal";
import { usePersonajeLocal } from "@/lib/personaje";
import { getPersonaje } from "@/data/jugadores";

export default function PartidaSoloPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [miSlug, , listoSlug] = usePersonajeLocal();
  const [chatAbierto, setChatAbierto] = useState(false);
  const [chatNoVisto, setChatNoVisto] = useState(0);

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

  // Contador de mensajes no vistos en chat (cuando está cerrado).
  useEffect(() => {
    if (chatAbierto) return;
    setChatNoVisto((n) => n + 0); // noop; el contador se actualizaría con un ref si lo quisiéramos exacto
  }, [estado?.chat.length, chatAbierto]);

  if (!estado || !miId) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center text-center px-4">
        <div>
          <img
            src="/brand/logo.png"
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
          🤖 vs máquina · {tamanio === 4 ? "2v2" : "1v1"} · a {puntos}
        </div>
        <button
          onClick={() => {
            setChatAbierto(true);
            setChatNoVisto(0);
          }}
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

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 relative min-h-0">
            <Mesa estado={estado} miId={miId} />
            <UltimoCanto estado={estado} miId={miId} />
          </div>
          <PanelAcciones estado={estado} miId={miId} enviar={enviarAccion} />
        </div>

        <aside className="hidden md:flex w-80 lg:w-96 border-l border-border flex-col p-2 overflow-hidden">
          <Chat
            estado={estado}
            miId={miId}
            miEquipoEs0={miEquipoEs0}
            enviar={enviarChat}
          />
        </aside>

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
                  miId={miId}
                  miEquipoEs0={miEquipoEs0}
                  enviar={enviarChat}
                />
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
              <Link href="/" className="btn btn-primary">
                Volver al inicio
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
