"use client";
// Span del marcador que anima el incremento de puntos: cuando el valor
// cambia hacia arriba, el número mostrado va 0, 1, 2, …, N con un
// pequeño tick sonoro por cada paso. Usa usePuntoAnimado por debajo.
//
// Cuando el equipo cruza a las buenas (valor > objetivo/2), aparece un
// punto dorado al lado del número — gesto análogo al puntito que se
// marca en la libreta cuando se "entra a las buenas".
import { usePuntoAnimado } from "@/lib/usePuntoAnimado";

export function ContadorPuntos({
  valor,
  esMio,
  objetivo = 18
}: {
  valor: number;
  esMio: boolean;
  objetivo?: 18 | 30;
}) {
  const mostrado = usePuntoAnimado(valor, esMio);
  const enBuenas = valor > Math.floor(objetivo / 2);
  const punto = enBuenas ? (
    <span
      aria-label="en las buenas"
      className="inline-block w-1.5 h-1.5 rounded-full bg-dorado shadow-[0_0_4px_var(--dorado)] align-middle"
    />
  ) : null;
  return (
    <span
      className="font-display text-lg text-crema leading-none tabular-nums inline-flex items-center gap-1"
      style={{
        minWidth: "1.4em",
        justifyContent: esMio ? "flex-end" : "flex-start"
      }}
    >
      {esMio ? (
        <>
          {punto}
          <span>{mostrado}</span>
        </>
      ) : (
        <>
          <span>{mostrado}</span>
          {punto}
        </>
      )}
    </span>
  );
}
