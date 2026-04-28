"use client";
// Banner grande que aparece cuando se resuelve un envido (querido o no
// querido). Muestra qué equipo ganó y cuántos puntos. Auto-oculta a los
// ~3.5s. Vive en la Mesa para que se centre sobre la mesa.
import { useEffect, useRef, useState } from "react";
import type { EstadoJuego, ResolucionEnvido } from "@/lib/truco/types";

const DURACION_MS = 3500;

export function ResultadoEnvido({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string;
}) {
  const [data, setData] = useState<{
    res: ResolucionEnvido;
    yoGane: boolean;
    key: string;
  } | null>(null);
  const ultimaKey = useRef<string | null>(null);
  const tRef = useRef<number | null>(null);

  const res = estado.manoActual?.envidoResolucion ?? null;
  const manoNum = estado.manoActual?.numero ?? 0;
  const key = res ? `${manoNum}:${res.ganadorEquipo}:${res.puntos}` : null;

  useEffect(() => {
    if (!res || !key) return;
    if (ultimaKey.current === key) return;
    ultimaKey.current = key;
    const me = estado.jugadores.find((j) => j.id === miId);
    const yoGane = me ? me.equipo === res.ganadorEquipo : false;
    setData({ res, yoGane, key });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setData(null);
      tRef.current = null;
    }, DURACION_MS);
  }, [res, key, estado.jugadores, miId]);

  // Si cambia la mano, reseteamos para que la próxima resolución pueda volver a mostrar.
  useEffect(() => {
    if (!res) ultimaKey.current = null;
  }, [manoNum, res]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  if (!data) return null;

  const { yoGane, res: r } = data;
  const colorAcento = yoGane ? "var(--dorado)" : "var(--rojo-fernet)";
  const titulo = yoGane ? "Ganaste el envido" : "Perdiste el envido";

  // Toast efímero de puntos: nace en el centro de la mesa, sube y se
  // desvanece. z-[450] queda por encima de cartas (max 350) y globos (400).
  return (
    <div className="resultado-puntos-float absolute left-1/2 top-1/2 z-[450] pointer-events-none">
      <div
        className="flex items-center gap-2 bg-carbon/95 backdrop-blur-sm border-2 px-3 py-1.5 rounded-full shadow-lg"
        style={{ borderColor: colorAcento }}
      >
        <span
          className="text-[9px] uppercase tracking-widest font-bold leading-none"
          style={{ color: "var(--text-dim)" }}
        >
          Envido
        </span>
        <span className="w-px h-3 bg-crema/20" />
        <span
          className="text-xs font-bold leading-none"
          style={{ color: colorAcento }}
        >
          {titulo}
        </span>
        <span
          className="font-display text-base leading-none"
          style={{ color: colorAcento }}
        >
          +{r.puntos}
        </span>
      </div>
    </div>
  );
}
