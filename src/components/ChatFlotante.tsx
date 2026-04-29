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
  // Mensajes humanos (no eventos del juego).
  const humanos = useMemo(
    () =>
      estado.chat.filter(
        (m) =>
          !m.evento &&
          (!m.destinatarioId ||
            m.destinatarioId === miId ||
            m.jugadorId === miId)
      ),
    [estado.chat, miId]
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

  // Early return DESPUÉS de los hooks — antes era arriba del componente
  // y violaba las rules of hooks (cuando `oculto` cambiaba, React veía
  // distinta cantidad de hooks renderizados y tiraba error).
  if (oculto) return null;

  return (
    <div
      // En desktop ya hay un panel lateral siempre visible, pero igual
      // mostramos el botón en el header — al lado del reproductor de
      // música — para que el acceso al chat sea consistente en todos los
      // tamaños. El sheet se abre solo en mobile (en md+ el panel ya
      // ocupa la columna lateral).
      className="fixed z-[600] top-1.5 right-[52px] flex flex-col items-end gap-1 pointer-events-none"
    >
      <button
        type="button"
        onClick={abrir}
        aria-label={`Abrir chat${sinVer > 0 ? ` (${sinVer} sin ver)` : ""}`}
        className={clsx(
          // Mismo estilo que el botón de música — botón neutral
          // (surface) en vez del dorado anterior, así son simétricos
          // visualmente. El badge de sin-ver sigue agregando color
          // cuando hay mensajes nuevos.
          "pointer-events-auto relative w-9 h-9 rounded-full",
          "bg-surface/80 backdrop-blur-sm border border-border",
          "hover:bg-surface-2 transition shadow-lg",
          "flex items-center justify-center",
          sinVer > 0 && "ring-2 ring-dorado/60 animate-pulse"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={clsx("w-4 h-4", sinVer > 0 ? "text-dorado" : "text-text-dim")}
          aria-hidden
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        {sinVer > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red text-crema text-[10px] font-bold rounded-full flex items-center justify-center border border-carbon shadow-md">
            {sinVer > 9 ? "9+" : sinVer}
          </span>
        )}
      </button>
      {previewVisible && ultimo && (
        <div
          className={clsx(
            "max-w-[60vw] sm:max-w-[260px] rounded-xl px-3 py-1.5 text-xs leading-snug shadow-lg backdrop-blur-sm border pointer-events-none",
            esYoUltimo
              ? "bg-dorado/90 text-carbon border-dorado-oscuro"
              : "bg-carbon/85 text-crema border-azul-criollo/50"
          )}
          style={{ borderTopRightRadius: "4px" }}
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
    </div>
  );
}
