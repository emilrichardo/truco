"use client";
// Banner grande que aparece cuando termina una mano (truco). Muestra qué
// equipo se la llevó y cuántos puntos sumó. Dispara en dos casos:
//  - Solo (motor con pausa): mano actual entra en fase "terminada" antes
//    de repartir la siguiente.
//  - Online (motor que aún reparte de corrido): crece historialManos y
//    leemos la última cerrada de ahí.
// Auto-oculta a los ~3.5s.
import { useEffect, useRef, useState } from "react";
import type { Mano, EstadoJuego } from "@/lib/truco/types";

// Coincide con la animación CSS resultado-puntos-float (2.8s).
const DURACION_MS = 2800;

function resumenDeMano(mano: Mano, miEquipo: 0 | 1 | undefined) {
  if (mano.ganadorMano === null) return null;
  const yoGane = miEquipo !== undefined ? miEquipo === mano.ganadorMano : false;
  const puntosMano = mano.puntosOtorgados
    .filter((p) => !/envido/i.test(p.motivo))
    .filter((p) => p.equipo === mano.ganadorMano)
    .reduce((s, p) => s + p.puntos, 0);
  const motivo =
    mano.puntosOtorgados.find(
      (p) => p.equipo === mano.ganadorMano && !/envido/i.test(p.motivo)
    )?.motivo || "Mano";
  if (puntosMano <= 0) return null;
  return { yoGane, puntos: puntosMano, motivo, numero: mano.numero };
}

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
  const ultimoNumeroRef = useRef<number>(0);
  const tRef = useRef<number | null>(null);

  const mano = estado.manoActual;
  const fase = mano?.fase;
  const numeroActual = mano?.numero ?? 0;
  const histLen = estado.historialManos.length;

  useEffect(() => {
    const me = estado.jugadores.find((j) => j.id === miId);
    const miEquipo = me?.equipo;

    // Caso 1: mano actual quedó en fase "terminada" (flujo Solo con delay).
    let resumen: ReturnType<typeof resumenDeMano> | null = null;
    let numero = 0;
    if (mano && fase === "terminada") {
      resumen = resumenDeMano(mano, miEquipo);
      numero = mano.numero;
    } else if (histLen > 0) {
      // Caso 2: ya repartieron la próxima (flujo Online). Leemos la última.
      const ultima = estado.historialManos[histLen - 1];
      resumen = resumenDeMano(ultima, miEquipo);
      numero = ultima.numero;
    }
    if (!resumen) return;
    if (ultimoNumeroRef.current === numero) return;
    ultimoNumeroRef.current = numero;

    setData(resumen);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setData(null);
      tRef.current = null;
    }, DURACION_MS);
  }, [fase, numeroActual, histLen, estado.jugadores, miId, mano, estado.historialManos]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  if (!data) return null;

  const colorAcento = data.yoGane ? "var(--dorado)" : "var(--rojo-fernet)";
  const titulo = data.yoGane ? "Te la llevaste" : "Perdiste";

  // Toast efímero de puntos: nace en el centro de la mesa, sube y se
  // desvanece. z-[450] queda por encima de cartas (max 350) y burbujas
  // de diálogo (400). Mismo patrón que ResultadoEnvido para que el cierre
  // de mano y el resultado de envido se sientan consistentes.
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
          Mano {data.numero}
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
          +{data.puntos}
        </span>
      </div>
    </div>
  );
}
