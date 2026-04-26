"use client";
import { useState } from "react";
import type { EstadoJuego } from "@/lib/truco/types";
import { urlPersonaje } from "@/data/jugadores";

const REACCIONES = ["👏", "🔥", "😂", "🤔", "🤬", "🥱", "🍷", "🧉"];
const FRASES = [
  "¡Mazo!",
  "Faltaba",
  "Andá a lavar los platos",
  "Mucha cancha",
  "Te vi"
];

export function Chat({
  estado,
  miId,
  enviar
}: {
  estado: EstadoJuego;
  miId: string;
  enviar: (m: { texto?: string; reaccion?: string }) => void;
}) {
  const [texto, setTexto] = useState("");
  return (
    <div className="parchment rounded-lg p-3 md:p-4 max-w-md w-full">
      <div className="label-slim text-truco-red mb-2">Chat de mesa</div>
      <div className="bg-cream/40 rounded p-2 h-44 overflow-y-auto text-sm text-truco-dark space-y-1">
        {estado.chat.length === 0 && (
          <div className="text-truco-dark/40 italic">Sin mensajes todavía.</div>
        )}
        {estado.chat.map((m) => {
          const j = estado.jugadores.find((x) => x.id === m.jugadorId);
          return (
            <div key={m.id} className="flex items-start gap-2">
              {j && (
                <img
                  src={urlPersonaje(j.personaje)}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover object-top flex-shrink-0"
                />
              )}
              <div>
                <span className="font-display text-xs">{j?.nombre}: </span>
                {m.reaccion ? (
                  <span className="text-xl">{m.reaccion}</span>
                ) : (
                  <span>{m.texto}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {REACCIONES.map((r) => (
          <button
            key={r}
            type="button"
            className="text-xl hover:scale-125 transition"
            onClick={() => enviar({ reaccion: r })}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {FRASES.map((f) => (
          <button
            key={f}
            type="button"
            className="text-[11px] uppercase tracking-wider bg-truco-dark/10 hover:bg-truco-dark/20 text-truco-dark px-2 py-0.5 rounded"
            onClick={() => enviar({ texto: f })}
          >
            {f}
          </button>
        ))}
      </div>
      <form
        className="flex gap-1 mt-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!texto.trim()) return;
          enviar({ texto: texto.trim() });
          setTexto("");
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribí un mensaje…"
          className="flex-1 bg-cream/60 border border-truco-dark/30 rounded px-2 py-1 text-sm text-truco-dark placeholder:text-truco-dark/40 focus:outline-none focus:ring-1 focus:ring-truco-red"
          maxLength={200}
        />
        <button className="btn btn-primary px-3 py-1 text-xs">Enviar</button>
      </form>
    </div>
  );
}
