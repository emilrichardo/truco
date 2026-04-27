"use client";
// Hook compartido: detecta el último canto/respuesta del chat y devuelve
// { hablandoId, hablandoKey } por ~1.4s. JugadorPanel lo usa para hacer
// pulsar al avatar del que está hablando.
import { useEffect, useRef, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

const DURACION_MS = 1400;
const DESTACAR = new Set(["canto", "respuesta"]);

export function useHablando(estado: EstadoJuego | null): {
  hablandoId: string | null;
  hablandoKey: string | null;
} {
  const [data, setData] = useState<{ id: string; key: string } | null>(null);
  const ultimoIdRef = useRef<string | null>(null);
  const tRef = useRef<number | null>(null);

  useEffect(() => {
    if (!estado) return;
    const ultimo = [...estado.chat]
      .reverse()
      .find((m) => m.evento && DESTACAR.has(m.evento));
    if (!ultimo) return;
    if (ultimoIdRef.current === ultimo.id) return;
    ultimoIdRef.current = ultimo.id;

    setData({ id: ultimo.jugadorId, key: ultimo.id });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = window.setTimeout(() => {
      setData(null);
      tRef.current = null;
    }, DURACION_MS);
  }, [estado?.chat]);

  useEffect(() => {
    return () => {
      if (tRef.current) clearTimeout(tRef.current);
    };
  }, []);

  return {
    hablandoId: data?.id || null,
    hablandoKey: data?.key || null
  };
}
