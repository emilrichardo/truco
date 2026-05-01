"use client";
// Pila de cartas (lomo) que aparece en el centro de la mesa al
// arrancar una mano nueva, mientras las cartas vuelan hacia cada
// jugador. Da la sensación de "alguien repartió de un mazo".
// Desaparece después de ~1.5s — los repartos son ~600ms + stagger,
// así para entonces ya está todo repartido.
import { useEffect, useState } from "react";
import { CartaEspanola } from "./CartaEspanola";

const DURACION_MS = 1500;

export function MazoReparto({ manoNumero }: { manoNumero: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (manoNumero <= 0) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), DURACION_MS);
    return () => clearTimeout(t);
  }, [manoNumero]);

  if (!visible) return null;

  // Stack de 5 cartas con offset progresivo en y/x para dar volumen.
  // La de arriba se "vuela" al final con un pequeño fade.
  const cantidad = 5;
  // z-[50]: por debajo de las cartas jugadas (z 100+) — el mazo es
  // decorativo y NO debe tapar la primera carta que tira un mano si
  // juega rápido apenas se reparte.
  return (
    <div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[50] pointer-events-none mazo-reparto-fade"
      aria-hidden
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: `${-i * 1.2}px`,
            left: `${-i * 0.6}px`,
            transform: `translate(-50%, -50%) rotate(${(i % 2 === 0 ? 1 : -1) * (i * 0.6)}deg)`,
            zIndex: i
          }}
        >
          <CartaEspanola oculta tamanio="md" />
        </div>
      ))}
    </div>
  );
}
