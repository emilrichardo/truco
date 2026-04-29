"use client";
// Banner grande que aparece cuando se resuelve un envido (querido o no
// querido). Muestra qué equipo ganó y cuántos puntos. Vive en la Mesa
// para que se centre sobre la mesa.
//
// Timing: se demora ~2.5s después de que el motor resuelve el envido,
// así primero se escuchan las voces ("Quiero", "Tengo 28.", "Son buenas")
// y recién después aparece el +N pts. Antes el toast salía instantáneo
// y se solapaba con las voces.
import { useEffect, useRef, useState } from "react";
import type { EstadoJuego, ResolucionEnvido } from "@/lib/truco/types";

const RETARDO_TOAST_MS = 2500;
const DURACION_MS = 2800;

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
  const showRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);

  const res = estado.manoActual?.envidoResolucion ?? null;
  const manoNum = estado.manoActual?.numero ?? 0;
  const fase = estado.manoActual?.fase;
  const key = res ? `${manoNum}:${res.ganadorEquipo}:${res.puntos}` : null;

  useEffect(() => {
    if (!res || !key) return;
    if (ultimaKey.current === key) return;
    ultimaKey.current = key;
    const me = estado.jugadores.find((j) => j.id === miId);
    const yoGane = me ? me.equipo === res.ganadorEquipo : false;
    if (showRef.current) clearTimeout(showRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    // Demoramos el toast: primero suenan "Quiero" + tantos ("Tengo 28.",
    // "Son buenas") y recién después aparece el +N pts. Así no se pisa
    // visualmente con la voz que está cantando.
    showRef.current = window.setTimeout(() => {
      // Si para cuando se cumple el delay la mano ya cerró, no mostramos
      // el toast del envido — el banner grande de fin de mano va a ocupar
      // el centro y no queremos los dos overlapping.
      if (estado.manoActual?.fase === "terminada") {
        showRef.current = null;
        return;
      }
      setData({ res, yoGane, key });
      showRef.current = null;
      hideRef.current = window.setTimeout(() => {
        setData(null);
        hideRef.current = null;
      }, DURACION_MS);
    }, RETARDO_TOAST_MS);
  }, [res, key, estado.jugadores, miId, estado.manoActual]);

  // Si la mano se cierra mientras el toast está visible, lo escondemos
  // para dejarle el centro al ResultadoMano (banner grande). Antes los
  // dos quedaban superpuestos por unos segundos.
  useEffect(() => {
    if (fase === "terminada" && data) {
      if (hideRef.current) clearTimeout(hideRef.current);
      if (showRef.current) clearTimeout(showRef.current);
      hideRef.current = null;
      showRef.current = null;
      setData(null);
    }
  }, [fase, data]);

  // Si cambia la mano, reseteamos para que la próxima resolución pueda volver a mostrar.
  useEffect(() => {
    if (!res) ultimaKey.current = null;
  }, [manoNum, res]);

  useEffect(() => {
    return () => {
      if (showRef.current) clearTimeout(showRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
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
