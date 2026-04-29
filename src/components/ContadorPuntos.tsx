"use client";
// Span del marcador que anima el incremento de puntos: cuando el valor
// cambia hacia arriba, el número mostrado va 0, 1, 2, …, N con un
// pequeño tick sonoro por cada paso. Usa usePuntoAnimado por debajo.
import { usePuntoAnimado } from "@/lib/usePuntoAnimado";

export function ContadorPuntos({
  valor,
  esMio
}: {
  valor: number;
  esMio: boolean;
}) {
  const mostrado = usePuntoAnimado(valor, esMio);
  return (
    <span
      className="font-display text-lg text-crema leading-none tabular-nums"
      style={{
        minWidth: "1.4em",
        textAlign: esMio ? "right" : "left"
      }}
    >
      {mostrado}
    </span>
  );
}
