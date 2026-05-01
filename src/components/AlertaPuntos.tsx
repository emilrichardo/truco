"use client";
// Toast efímero que aparece en tiempo real cada vez que se otorgan
// puntos durante la mano (envido aceptado / no querido, truco no
// querido, ir al mazo, etc.). Muestra el equipo, el motivo y los
// puntos ganados — el usuario quería un mensaje claro de QUÉ pasó.
//
// Diferente a ResultadoMano (banner grande al cierre) y a
// ResultadoEnvido (toast después del envido). AlertaPuntos cubre
// los puntos PARCIALES que se acumulan durante la mano sin tanto
// fanfare — un "+1 envido no querido" rápido y se va.
import { useEffect, useRef, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

const DURACION_MS = 2400;

interface Alerta {
  id: string;
  yoGane: boolean;
  puntos: number;
  motivo: string;
}

export function AlertaPuntos({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string;
}) {
  const [alerta, setAlerta] = useState<Alerta | null>(null);
  const procesadosRef = useRef<Set<string>>(new Set());
  const tRef = useRef<number | null>(null);

  // Recolecta TODOS los puntosOtorgados de la mano actual (un array que
  // el motor va creciendo). Cada item tiene equipo + puntos + motivo.
  // Identificamos cada uno por una key estable derivada del contenido,
  // así no replayeamos los mismos toast cuando el estado actualiza por
  // otro motivo (chat, etc.).
  const otorgados = estado.manoActual?.puntosOtorgados ?? [];
  const manoNum = estado.manoActual?.numero ?? 0;

  useEffect(() => {
    // Limpiamos el set cuando arranca una mano nueva — sino crece
    // sin freno y los IDs colisionan entre manos (mismo motivo +
    // puntos pueden repetirse).
    procesadosRef.current = new Set();
  }, [manoNum]);

  useEffect(() => {
    if (otorgados.length === 0) return;
    const me = estado.jugadores.find((j) => j.id === miId);
    const miEquipo = me?.equipo;
    // Tomamos el ÚLTIMO no procesado — toast solo el más reciente
    // para no encadenar varios uno tras otro (el resto los entrega
    // ResultadoMano al cierre).
    for (let i = otorgados.length - 1; i >= 0; i--) {
      const p = otorgados[i];
      const key = `${manoNum}:${i}:${p.equipo}:${p.puntos}:${p.motivo}`;
      if (procesadosRef.current.has(key)) continue;
      procesadosRef.current.add(key);
      const yoGane = miEquipo !== undefined && miEquipo === p.equipo;
      setAlerta({ id: key, yoGane, puntos: p.puntos, motivo: p.motivo });
      if (tRef.current) window.clearTimeout(tRef.current);
      tRef.current = window.setTimeout(() => {
        setAlerta(null);
        tRef.current = null;
      }, DURACION_MS);
      break; // mostramos solo el más reciente en este tick
    }
    // Marcamos como procesados todos los previos también, así no se
    // disparan retroactivamente si el state cambia.
    for (let i = 0; i < otorgados.length; i++) {
      const p = otorgados[i];
      procesadosRef.current.add(
        `${manoNum}:${i}:${p.equipo}:${p.puntos}:${p.motivo}`
      );
    }
  }, [otorgados, manoNum, estado.jugadores, miId]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  if (!alerta) return null;

  const colorAcento = alerta.yoGane ? "var(--dorado)" : "var(--rojo-fernet)";
  const flecha = alerta.yoGane ? "↑" : "↓";

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[455] pointer-events-none">
      <div
        className="resultado-puntos-float flex items-center gap-2 bg-carbon/95 backdrop-blur-sm border-2 px-3 py-1.5 rounded-full shadow-lg max-w-[90vw]"
        style={{ borderColor: colorAcento }}
      >
        <span
          className="font-display text-base leading-none"
          style={{ color: colorAcento }}
        >
          {flecha} +{alerta.puntos}
        </span>
        <span className="w-px h-3 bg-crema/20" />
        <span
          className="text-[11px] font-bold leading-tight"
          style={{ color: "var(--text-dim)" }}
        >
          {alerta.motivo}
        </span>
      </div>
    </div>
  );
}
