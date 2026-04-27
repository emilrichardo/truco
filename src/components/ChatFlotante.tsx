"use client";
// Botón flotante de chat: grande, circular, con icono SVG y contador de
// mensajes nuevos. Vive arriba a la derecha del MiAvatarBR para no
// pisarse con el avatar. Click → abre el sheet (mobile) o trae foco al
// chat (desktop, lo maneja la página padre).
//
// Encima del botón muestra una mini-burbuja con el último mensaje humano
// de la mesa, así el jugador ve la última frase sin tener que abrir el
// chat completo.
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import type { EstadoJuego } from "@/lib/truco/types";

export function ChatFlotante({
  estado,
  miId,
  onAbrir,
  oculto
}: {
  estado: EstadoJuego;
  miId: string;
  onAbrir?: () => void;
  /** Cuando el sheet del chat ya está abierto, no tiene sentido seguir
   *  mostrando el botón — se renderiza encima del input de enviar. */
  oculto?: boolean;
}) {
  if (oculto) return null;
  // Mensajes humanos (no eventos del juego).
  const humanos = useMemo(
    () => estado.chat.filter((m) => !m.evento),
    [estado.chat]
  );
  const ultimo = humanos[humanos.length - 1];

  // Contador de mensajes humanos nuevos desde la última vez que el usuario
  // abrió el chat. Se resetea cada vez que onAbrir se dispara.
  const [vistosId, setVistosId] = useState<string | null>(null);
  const inicializadoRef = useRef(false);
  useEffect(() => {
    if (inicializadoRef.current) return;
    inicializadoRef.current = true;
    setVistosId(humanos[humanos.length - 1]?.id ?? null);
  }, [humanos]);

  const idxVistos = vistosId
    ? humanos.findIndex((m) => m.id === vistosId)
    : -1;
  const sinVer = idxVistos === -1 ? humanos.length : humanos.length - 1 - idxVistos;

  // Mostrar la mini-burbuja con el último mensaje sólo unos segundos
  // después de que llegó (para que no quede tapando la mesa para siempre).
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ultimo) return;
    setPreviewVisible(true);
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      setPreviewVisible(false);
      previewTimerRef.current = null;
    }, 4000);
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [ultimo?.id]);

  const abrir = () => {
    setVistosId(humanos[humanos.length - 1]?.id ?? null);
    setPreviewVisible(false);
    onAbrir?.();
  };

  const nombreUltimo = ultimo
    ? estado.jugadores.find((j) => j.id === ultimo.jugadorId)?.nombre
    : null;
  const esYoUltimo = ultimo?.jugadorId === miId;

  return (
    <div
      // En desktop ya hay un panel de chat lateral siempre visible, así
      // que escondemos el botón flotante. Sólo aparece en mobile.
      className="md:hidden fixed z-40 right-2 bottom-2 flex flex-col items-end gap-1.5 pointer-events-none"
      style={{
        // Respetar safe-area en mobiles con notch / barra inferior.
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
        paddingRight: "max(0px, env(safe-area-inset-right))"
      }}
    >
      {previewVisible && ultimo && (
        <div
          className={clsx(
            "md:hidden max-w-[60vw] sm:max-w-[260px] rounded-xl px-3 py-1.5 text-xs leading-snug shadow-lg backdrop-blur-sm border pointer-events-none",
            esYoUltimo
              ? "bg-dorado/90 text-carbon border-dorado-oscuro"
              : "bg-carbon/85 text-crema border-azul-criollo/50"
          )}
          style={{
            // Cola de la burbuja apuntando al botón (abajo-derecha).
            borderBottomRightRadius: "4px"
          }}
        >
          {ultimo.sticker ? (
            <div className="flex items-center gap-1.5">
              {nombreUltimo && !esYoUltimo && (
                <span className="text-azul-claro font-bold">
                  {nombreUltimo}:
                </span>
              )}
              <img
                src={ultimo.sticker}
                alt="sticker"
                className="w-10 h-10 object-contain"
              />
            </div>
          ) : ultimo.reaccion ? (
            <span className="text-xl leading-none">{ultimo.reaccion}</span>
          ) : (
            <>
              {nombreUltimo && !esYoUltimo && (
                <span className="text-azul-claro mr-1 font-bold">
                  {nombreUltimo}:
                </span>
              )}
              <span className="break-words">{ultimo.texto}</span>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={abrir}
        aria-label={`Abrir chat${sinVer > 0 ? ` (${sinVer} sin ver)` : ""}`}
        className={clsx(
          "pointer-events-auto relative w-[68px] h-[68px] rounded-full",
          "bg-gradient-to-br from-dorado-claro via-dorado to-dorado-oscuro",
          "border-[3px] border-carbon",
          "shadow-[0_4px_16px_rgba(0,0,0,0.55),0_0_0_2px_rgba(217,164,65,0.35)]",
          "active:scale-95 hover:brightness-110 transition",
          "flex items-center justify-center",
          // Anillo ámbar pulsante cuando hay mensajes sin ver
          sinVer > 0 && "ring-4 ring-dorado/60 animate-pulse"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-9 h-9 text-carbon drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]"
          aria-hidden
        >
          <path d="M12 3C6.48 3 2 6.92 2 11.5c0 2.08.93 3.97 2.46 5.4L3 21l4.6-1.45c1.32.62 2.84.95 4.4.95 5.52 0 10-3.92 10-8.5S17.52 3 12 3zm-4 9.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm4 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm4 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
        </svg>
        {sinVer > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 bg-red text-crema text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-carbon shadow-md">
            {sinVer > 9 ? "9+" : sinVer}
          </span>
        )}
      </button>
    </div>
  );
}
