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

// Casi todo el RETARDO_PROX_MANO_MS de salaLocal (3500ms) — dejamos que
// el banner respire antes del próximo reparto.
const DURACION_MS = 3200;

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
  const titulo = data.yoGane ? "¡Te la llevaste!" : "Perdiste";
  const emoji = data.yoGane ? "🏆" : "😬";

  // Banner dramático centrado con pop animado. Más grande y más llamativo
  // que el chip viejo — el usuario quería sentir el cierre de cada mano.
  // z-[460] queda sobre las cartas (max 350) y burbujas (400), debajo del
  // chat (600) y los modales finales (1000).
  return (
    <div className="absolute inset-0 z-[460] flex items-center justify-center pointer-events-none">
      <div
        className="resultado-mano-pop flex flex-col items-center gap-1 px-6 py-4 rounded-2xl border-4 bg-carbon/95 backdrop-blur-md shadow-2xl"
        style={{ borderColor: colorAcento }}
      >
        <span
          className="text-[10px] uppercase tracking-[0.3em] font-bold"
          style={{ color: "var(--text-dim)" }}
        >
          Mano {data.numero}
        </span>
        <div className="text-5xl leading-none">{emoji}</div>
        <div
          className="font-display text-2xl leading-none subtitulo-claim"
          style={{ color: colorAcento }}
        >
          {titulo}
        </div>
        <div className="flex items-baseline gap-1">
          <span
            className="font-display text-6xl leading-none"
            style={{ color: colorAcento }}
          >
            {data.yoGane ? "+" : "−"}
            {data.puntos}
          </span>
          <span
            className="text-xs uppercase tracking-widest font-bold"
            style={{ color: "var(--text-dim)" }}
          >
            pts
          </span>
        </div>
      </div>
    </div>
  );
}
