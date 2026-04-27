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

const DURACION_MS = 3500;

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
