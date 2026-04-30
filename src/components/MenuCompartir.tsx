"use client";
// Menú de compartir enlace de la sala. Muestra WhatsApp, copiar y, si el
// browser lo soporta, el share sheet nativo (mobile típicamente).
import { useEffect, useState } from "react";

export function MenuCompartir({
  salaId,
  url,
  onCerrar
}: {
  salaId: string;
  url: string;
  onCerrar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [tieneShare, setTieneShare] = useState(false);

  useEffect(() => {
    setTieneShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const texto = `🃏 ¡Sumate a la mesa de truco entre primos!\nSala: *${salaId}*\n${url}`;

  const compartirWA = () => {
    const wa = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(wa, "_blank", "noopener,noreferrer");
    onCerrar();
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => onCerrar(), 800);
    } catch {
      // Fallback prompt
      window.prompt("Copiá este enlace:", url);
      onCerrar();
    }
  };

  const compartirNativo = async () => {
    try {
      await navigator.share({
        title: "Truco entre Primos",
        text: texto,
        url
      });
    } catch {
      /* usuario canceló */
    }
    onCerrar();
  };

  return (
    <div
      className="fixed inset-0 sheet-bg z-50 flex items-center justify-center p-3"
      onClick={onCerrar}
    >
      <div
        className="card p-3 w-full max-w-sm space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-2">
          <div className="label-slim acento-azul">Invitar a un primo</div>
          <div className="font-display text-lg text-dorado">{salaId}</div>
        </div>

        <button
          onClick={compartirWA}
          className="btn w-full justify-start"
          style={{
            background: "#25d366",
            borderColor: "#1ea952",
            color: "#fff"
          }}
        >
          <span>💬</span>
          <span>Compartir por WhatsApp</span>
        </button>

        <button onClick={copiar} className="btn w-full justify-start">
          <span>{copiado ? "✓" : "📋"}</span>
          <span>{copiado ? "Copiado" : "Copiar enlace"}</span>
        </button>

        {tieneShare && (
          <button
            onClick={compartirNativo}
            className="btn btn-azul w-full justify-start"
          >
            <span>📲</span>
            <span>Más opciones…</span>
          </button>
        )}

        <button onClick={onCerrar} className="btn btn-ghost w-full">
          Cancelar
        </button>
      </div>
    </div>
  );
}
