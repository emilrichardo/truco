"use client";
// Banner efímero cuando alguien canta o responde — aparece pegado al jugador
// que habla para que se entienda quién dijo qué. Estilo cinta dorada.
//
// Implementación: usamos refs para el id ya mostrado y para el handle del
// timeout de auto-hide. Así, cuando el chat cambia por otra razón (carta
// jugada, nueva mano), no cancelamos el timeout que oculta la burbuja.
import { useEffect, useRef, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

type Posicion = "arriba" | "abajo" | "izquierda" | "derecha";

const DESTACAR = new Set(["canto", "respuesta"]);
const DURACION_MS = 1800;

export function UltimoCanto({
  estado,
  miId
}: {
  estado: EstadoJuego;
  miId: string;
}) {
  const [mostrar, setMostrar] = useState<{
    id: string;
    texto: string;
    nombre?: string;
    pos?: Posicion;
  } | null>(null);

  const ultimoIdMostrado = useRef<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const manoActualRef = useRef<number>(estado.manoActual?.numero ?? 0);

  // Cuando cambia la mano, ocultamos cualquier burbuja en curso.
  const manoNum = estado.manoActual?.numero ?? 0;
  useEffect(() => {
    if (manoNum !== manoActualRef.current) {
      manoActualRef.current = manoNum;
      ultimoIdMostrado.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setMostrar(null);
    }
  }, [manoNum]);

  // Detectar nuevo canto/respuesta y mostrar burbuja por DURACION_MS.
  useEffect(() => {
    const ultimo = [...estado.chat]
      .reverse()
      .find((m) => m.evento && DESTACAR.has(m.evento));
    if (!ultimo) return;
    if (ultimoIdMostrado.current === ultimo.id) return;

    ultimoIdMostrado.current = ultimo.id;

    const me = estado.jugadores.find((j) => j.id === miId);
    const habla = estado.jugadores.find((x) => x.id === ultimo.jugadorId);

    let pos: Posicion | undefined;
    if (me && habla) {
      const total = estado.jugadores.length;
      const idx = (habla.asiento - me.asiento + total) % total;
      pos = posicionDesdeIdx(idx, total);
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMostrar({ id: ultimo.id, texto: ultimo.texto, nombre: habla?.nombre, pos });
    timeoutRef.current = window.setTimeout(() => {
      setMostrar(null);
      timeoutRef.current = null;
    }, DURACION_MS);
  }, [estado.chat, estado.jugadores, miId]);

  // Cleanup al desmontar.
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!mostrar) return null;

  return (
    <div
      className={`absolute z-30 pointer-events-none ${claseBubble(mostrar.pos)}`}
    >
      <div
        className="cinta-claim subtitulo-claim text-sm flex items-center gap-2 px-5 py-2 rounded-md parpadeo whitespace-nowrap shadow-lg"
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.4)" }}
      >
        {mostrar.nombre && (
          <span className="text-azul-criollo text-[10px] font-bold normal-case tracking-normal">
            {mostrar.nombre}
          </span>
        )}
        <span className="font-bold text-carbon">{mostrar.texto}</span>
      </div>
    </div>
  );
}

function posicionDesdeIdx(idx: number, total: number): Posicion {
  if (total === 2) return idx === 0 ? "abajo" : "arriba";
  if (total === 4) {
    const map: Posicion[] = ["abajo", "izquierda", "arriba", "derecha"];
    return map[idx] || "arriba";
  }
  return "arriba";
}

/** Burbujas cerca del puesto del que habla. "abajo" (yo) en BR — el resto
 *  en posición cardinal. */
function claseBubble(pos?: Posicion): string {
  switch (pos) {
    case "abajo":
      return "right-3 bottom-28";
    case "arriba":
      return "left-1/2 -translate-x-1/2 top-24";
    case "izquierda":
      return "left-4 top-[58%]";
    case "derecha":
      return "right-4 top-[58%]";
    default:
      return "left-1/2 -translate-x-1/2 top-16";
  }
}
