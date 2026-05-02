"use client";
// Botón flotante con menú de emociones para reaccionar en tiempo real
// — accesible siempre desde la mesa, visible para TODOS los jugadores
// (sin destinatarioId, va al chat público de la sala). Reemplaza el
// flujo viejo donde había que tocar el avatar del compañero para
// abrir el panel y desde ahí elegir emoji (que llegaba solo al
// compañero).
import { useEffect, useRef, useState } from "react";
import { ICONOS_EMOCIONES } from "@/lib/chatRapido";

interface Props {
  enviarChat: (m: { reaccion?: string; texto?: string }) => void;
}

export function BarraEmociones({ enviarChat }: Props) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cierra el menú al tocar afuera.
  useEffect(() => {
    if (!abierto) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        ref.current &&
        !ref.current.contains(e.target as Node)
      ) {
        setAbierto(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [abierto]);

  const elegir = (icono: string) => {
    enviarChat({ reaccion: icono });
    setAbierto(false);
  };

  // El componente padre (MiAvatarBR) se encarga del posicionamiento
  // absoluto. Acá sólo manejamos el botón y el menú flotante (que se
  // despliega desde el botón hacia arriba-derecha).
  return (
    <div ref={ref} className="relative z-[510]">
      {abierto && (
        <div className="absolute left-0 bottom-11 grid grid-cols-4 gap-1.5 bg-carbon/95 backdrop-blur-sm border border-azul-criollo/50 rounded-xl p-2 shadow-2xl whitespace-nowrap">
          {ICONOS_EMOCIONES.map((icono) => (
            <button
              key={icono}
              type="button"
              onClick={() => elegir(icono)}
              className="w-9 h-9 flex items-center justify-center text-xl active:scale-90 transition hover:bg-azul-criollo/20 rounded leading-none"
              title={`Reaccionar ${icono}`}
            >
              {icono}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="w-9 h-9 rounded-full bg-carbon/85 backdrop-blur-sm border-2 border-azul-criollo/60 hover:border-azul-criollo flex items-center justify-center text-lg shadow-lg active:scale-95 transition"
        title="Reaccionar"
        aria-label="Abrir reacciones"
      >
        {abierto ? "✕" : "😊"}
      </button>
    </div>
  );
}
