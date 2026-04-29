"use client";
// Hook para animar el contador de puntos del marcador. Cuando `objetivo`
// cambia hacia arriba, el valor mostrado se incrementa de a 1 con un
// pequeño delay entre cada paso y un "tick" sonoro. Si baja (caso raro,
// ej. revancha que resetea), salta directo. Si la diferencia es 0,
// no hay animación.
import { useEffect, useRef, useState } from "react";
import { sonidoTickPunto } from "./audio/sfx";

const MS_POR_PUNTO = 220;

export function usePuntoAnimado(objetivo: number, esMio: boolean): number {
  const [mostrado, setMostrado] = useState(objetivo);
  const tRef = useRef<number | null>(null);
  const ultimoObjetivoRef = useRef(objetivo);
  const ultimoMostradoRef = useRef(objetivo);

  useEffect(() => {
    if (objetivo === ultimoObjetivoRef.current) return;
    const objetivoPrevio = ultimoObjetivoRef.current;
    ultimoObjetivoRef.current = objetivo;
    // Si bajó (reset / revancha), saltamos directo sin animar.
    if (objetivo < ultimoMostradoRef.current) {
      if (tRef.current) {
        clearTimeout(tRef.current);
        tRef.current = null;
      }
      ultimoMostradoRef.current = objetivo;
      setMostrado(objetivo);
      return;
    }
    // Diferencia exacta: nuevo - viejo. No queremos pisar una animación
    // en curso, así que arrancamos desde lo último que mostramos.
    void objetivoPrevio;
    const tick = () => {
      const actual = ultimoMostradoRef.current;
      if (actual >= ultimoObjetivoRef.current) {
        tRef.current = null;
        return;
      }
      const proximo = actual + 1;
      ultimoMostradoRef.current = proximo;
      setMostrado(proximo);
      sonidoTickPunto(esMio);
      tRef.current = window.setTimeout(tick, MS_POR_PUNTO);
    };
    if (!tRef.current) tick();
  }, [objetivo, esMio]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  return mostrado;
}
