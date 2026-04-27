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
  const colorBorde = yoGane ? "border-dorado" : "border-red";
  const colorTexto = yoGane ? "text-dorado" : "text-red";
  const titulo = yoGane ? "¡Ganaste el envido!" : "Perdiste el envido";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-4">
      <div
        className={`papel border-t-4 ${colorBorde} px-6 py-4 text-center max-w-sm shadow-2xl envido-pop`}
      >
        <div
          className="subtitulo-claim text-[10px] mb-1"
          style={{ color: "var(--azul-criollo)" }}
        >
          ✦ Envido resuelto ✦
        </div>
        <div
          className={`titulo-marca text-2xl mb-1 ${colorTexto}`}
          style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.15)" }}
        >
          {titulo}
        </div>
        <div
          className="font-display text-4xl leading-none my-2"
          style={{ color: "var(--carbon)" }}
        >
          +{r.puntos}{" "}
          <span className="text-base align-middle font-bold uppercase tracking-wider">
            {r.puntos === 1 ? "pto" : "ptos"}
          </span>
        </div>
        <div
          className="text-xs mt-1"
          style={{ color: "var(--madera-oscura)" }}
        >
          {r.detalle}
        </div>
      </div>
    </div>
  );
}
