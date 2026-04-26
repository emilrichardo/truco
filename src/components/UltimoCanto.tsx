"use client";
// Banner efímero cuando alguien canta o responde — aparece pegado al jugador
// que habla para que se entienda quién dijo qué. Estilo cinta dorada.
import { useEffect, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

type Posicion = "arriba" | "abajo" | "izquierda" | "derecha";

const DESTACAR = new Set(["canto", "respuesta"]);

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

  useEffect(() => {
    const ultimo = [...estado.chat]
      .reverse()
      .find((m) => m.evento && DESTACAR.has(m.evento));
    if (!ultimo) return;
    if (mostrar?.id === ultimo.id) return;
    const me = estado.jugadores.find((j) => j.id === miId);
    const habla = estado.jugadores.find((x) => x.id === ultimo.jugadorId);

    let pos: Posicion | undefined;
    if (me && habla) {
      const total = estado.jugadores.length;
      const idx = (habla.asiento - me.asiento + total) % total;
      pos = posicionDesdeIdx(idx, total);
    }

    setMostrar({ id: ultimo.id, texto: ultimo.texto, nombre: habla?.nombre, pos });
    const t = setTimeout(() => setMostrar(null), 1800);
    return () => clearTimeout(t);
  }, [estado.chat, estado.jugadores, miId, mostrar?.id]);

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

/** Posición del banner debajo (o cerca) del jugador que habla. */
function claseBubble(pos?: Posicion): string {
  switch (pos) {
    case "arriba":
      // Avatar pegado al borde superior; el banner cae justo debajo de su nombre.
      return "left-1/2 -translate-x-1/2 top-24";
    case "abajo":
      // Soy yo. Banner sobre mi avatar (que está abajo) para no taparlo.
      return "left-1/2 -translate-x-1/2 bottom-24";
    case "izquierda":
      // Avatar a la izquierda en centro vertical; banner debajo de su nombre.
      return "left-4 top-[58%]";
    case "derecha":
      return "right-4 top-[58%]";
    default:
      return "left-1/2 -translate-x-1/2 top-16";
  }
}
