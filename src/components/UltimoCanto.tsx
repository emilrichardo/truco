"use client";
// Banner efímero cuando alguien canta o responde — feedback inmediato visible
// aún si el chat está cerrado (mobile). Estilo cinta dorada con sombra fuerte.
import { useEffect, useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";

const DESTACAR = new Set(["canto", "respuesta"]);

export function UltimoCanto({ estado }: { estado: EstadoJuego }) {
  const [mostrar, setMostrar] = useState<{
    id: string;
    texto: string;
    nombre?: string;
  } | null>(null);

  useEffect(() => {
    const ultimo = [...estado.chat]
      .reverse()
      .find((m) => m.evento && DESTACAR.has(m.evento));
    if (!ultimo) return;
    if (mostrar?.id === ultimo.id) return;
    const j = estado.jugadores.find((x) => x.id === ultimo.jugadorId);
    setMostrar({ id: ultimo.id, texto: ultimo.texto, nombre: j?.nombre });
    const t = setTimeout(() => setMostrar(null), 1800);
    return () => clearTimeout(t);
  }, [estado.chat, estado.jugadores, mostrar?.id]);

  if (!mostrar) return null;
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <div
        className="cinta-claim subtitulo-claim text-sm flex items-center gap-2 px-5 py-2 rounded-md parpadeo"
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
