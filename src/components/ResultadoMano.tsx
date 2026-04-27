"use client";
// Banner grande que aparece cuando termina una mano (truco). Muestra qué
// equipo se la llevó y cuántos puntos sumó. Dispara cuando crece la
// historia de manos. Auto-oculta a los ~3.5s.
import { useEffect, useRef, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

const DURACION_MS = 3500;

export function ResultadoMano({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string;
}) {
  const [data, setData] = useState<{
    yoGane: boolean;
    puntos: number;
    motivo: string;
    numero: number;
  } | null>(null);
  const ultimaLen = useRef<number>(estado.historialManos.length);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    const len = estado.historialManos.length;
    if (len <= ultimaLen.current) {
      ultimaLen.current = len;
      return;
    }
    ultimaLen.current = len;
    const ultima = estado.historialManos[len - 1];
    if (!ultima || ultima.ganadorMano === null) return;

    // Sumamos los puntos de truco que se otorgaron en esa mano (excluyendo
    // los del envido, que ya tuvieron su propio banner).
    const me = estado.jugadores.find((j) => j.id === miId);
    const yoGane = me ? me.equipo === ultima.ganadorMano : false;
    const puntosMano = ultima.puntosOtorgados
      .filter((p) => !/envido/i.test(p.motivo))
      .filter((p) => p.equipo === ultima.ganadorMano)
      .reduce((s, p) => s + p.puntos, 0);
    const motivo =
      ultima.puntosOtorgados.find(
        (p) => p.equipo === ultima.ganadorMano && !/envido/i.test(p.motivo)
      )?.motivo || "Mano";

    if (puntosMano <= 0) return;

    setData({
      yoGane,
      puntos: puntosMano,
      motivo,
      numero: ultima.numero
    });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setData(null);
      tRef.current = null;
    }, DURACION_MS);
  }, [estado.historialManos, estado.jugadores, miId]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  if (!data) return null;

  const colorBorde = data.yoGane ? "border-dorado" : "border-red";
  const colorTexto = data.yoGane ? "text-dorado" : "text-red";
  const titulo = data.yoGane ? "¡Te llevaste la mano!" : "Perdiste la mano";

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none px-4">
      <div
        className={`papel border-t-4 ${colorBorde} px-6 py-4 text-center max-w-sm shadow-2xl envido-pop`}
      >
        <div
          className="subtitulo-claim text-[10px] mb-1"
          style={{ color: "var(--azul-criollo)" }}
        >
          ✦ Mano {data.numero} resuelta ✦
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
          +{data.puntos}{" "}
          <span className="text-base align-middle font-bold uppercase tracking-wider">
            {data.puntos === 1 ? "pto" : "ptos"}
          </span>
        </div>
        <div
          className="text-xs mt-1"
          style={{ color: "var(--madera-oscura)" }}
        >
          {data.motivo}
        </div>
      </div>
    </div>
  );
}
