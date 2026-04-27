"use client";
// Burbuja de diálogo cuando alguien canta o responde — aparece pegada al
// jugador que habla para que se entienda quién dijo qué. Usa una cola
// (tail) que apunta al avatar del que habla.
//
// La duración es proporcional al largo del texto (mínimo 2s, máximo 5s)
// para que las frases largas tipo "¡QUIEROOOOO, changooo!..." se alcancen
// a leer.
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { EstadoJuego } from "@/lib/truco/types";

type Posicion = "arriba" | "abajo" | "izquierda" | "derecha";

const DESTACAR = new Set(["canto", "respuesta"]);

function calcularDuracion(texto: string): number {
  // ~80ms por carácter, mínimo 3s, máximo 7s. Lo bastante para alcanzar
  // a leer las frases largas santiagueñas.
  return Math.max(3000, Math.min(7000, texto.length * 80 + 1500));
}

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

  // Detectar nuevo canto/respuesta y mostrar burbuja.
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
    }, calcularDuracion(ultimo.texto));
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
      className={clsx(
        "absolute z-30 pointer-events-none",
        claseBubble(mostrar.pos)
      )}
    >
      <div
        className={clsx(
          "relative rounded-2xl px-4 py-2.5 shadow-2xl envido-pop",
          "bg-gradient-to-br from-crema via-crema to-crema-2",
          "border-2 border-dorado-oscuro",
          // Ancho razonable que deja respirar las frases largas pero no
          // ocupa todo el viewport.
          "max-w-[60vw] sm:max-w-[280px] min-w-[80px]"
        )}
      >
        {mostrar.nombre && (
          <div
            className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "var(--azul-criollo)" }}
          >
            {mostrar.nombre}
          </div>
        )}
        <div
          className="text-[15px] sm:text-base font-bold leading-snug break-words"
          style={{
            color: "var(--carbon)",
            fontFamily: '"Alfa Slab One", Georgia, serif',
            textShadow: "1px 1px 0 rgba(217,164,65,0.3)"
          }}
        >
          {mostrar.texto}
        </div>
        {/* Cola de la burbuja apuntando al avatar */}
        <div
          aria-hidden
          className={clsx("absolute w-3 h-3 rotate-45 bg-crema-2 border-dorado-oscuro", colaBubble(mostrar.pos))}
          style={{
            borderLeftWidth: colaBordes(mostrar.pos).left,
            borderTopWidth: colaBordes(mostrar.pos).top,
            borderRightWidth: colaBordes(mostrar.pos).right,
            borderBottomWidth: colaBordes(mostrar.pos).bottom
          }}
        />
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

/** Burbujas cerca del puesto del que habla. */
function claseBubble(pos?: Posicion): string {
  switch (pos) {
    case "abajo":
      return "right-3 bottom-32";
    case "arriba":
      return "left-1/2 -translate-x-1/2 top-20";
    case "izquierda":
      return "left-4 top-[55%]";
    case "derecha":
      return "right-4 top-[55%]";
    default:
      return "left-1/2 -translate-x-1/2 top-16";
  }
}

/** Posición de la cola (apunta al avatar del que habla). */
function colaBubble(pos?: Posicion): string {
  switch (pos) {
    case "abajo":
      return "bottom-[-7px] right-6"; // cola hacia abajo-derecha (avatar BR)
    case "arriba":
      return "top-[-7px] left-1/2 -translate-x-1/2"; // cola hacia arriba
    case "izquierda":
      return "left-[-7px] top-1/2 -translate-y-1/2"; // cola hacia la izquierda
    case "derecha":
      return "right-[-7px] top-1/2 -translate-y-1/2"; // cola hacia la derecha
    default:
      return "top-[-7px] left-1/2 -translate-x-1/2";
  }
}

/** Bordes a aplicar al diamante para que sólo dos lados queden visibles
 *  (los que coinciden con el borde de la burbuja). */
function colaBordes(pos?: Posicion) {
  switch (pos) {
    case "abajo":
      return { left: 0, top: 0, right: 2, bottom: 2 };
    case "arriba":
      return { left: 2, top: 2, right: 0, bottom: 0 };
    case "izquierda":
      return { left: 2, top: 0, right: 0, bottom: 2 };
    case "derecha":
      return { left: 0, top: 2, right: 2, bottom: 0 };
    default:
      return { left: 2, top: 2, right: 0, bottom: 0 };
  }
}
