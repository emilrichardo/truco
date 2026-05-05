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
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${mostrado} puntos`}>
      {enBuenas && esMio && <Buenas />}
      <span className="sr-only">{mostrado}</span>
      <span
        className="inline-flex flex-wrap items-center gap-[2px] max-w-[78px] sm:max-w-[96px]"
        aria-hidden
        title={`${mostrado} puntos`}
      >
        {gruposDeCinco(mostrado).map((count, i) => (
          <GrupoFosforos key={`${i}-${count}`} count={count} />
        ))}
      </span>
      {enBuenas && !esMio && <Buenas />}
    </span>
  );
}

function gruposDeCinco(valor: number): number[] {
  const grupos: number[] = [];
  let restante = Math.max(0, valor);
  while (restante > 0) {
    grupos.push(Math.min(5, restante));
    restante -= 5;
  }
  return grupos.length ? grupos : [0];
}

function Buenas() {
  return (
    <span
      aria-label="en las buenas"
      className="inline-block w-1.5 h-1.5 rounded-full bg-dorado shadow-[0_0_4px_var(--dorado)] align-middle shrink-0"
    />
  );
}

function GrupoFosforos({ count }: { count: number }) {
  return (
    <span className="relative inline-block w-[13px] h-[13px] shrink-0">
      {count >= 1 && <Fosforo className="left-[2px] top-0 rotate-0" />}
      {count >= 2 && <Fosforo className="right-[2px] top-0 rotate-0" />}
      {count >= 3 && <Fosforo className="left-[1px] bottom-[2px] rotate-90" />}
      {count >= 4 && <Fosforo className="right-[1px] bottom-[2px] rotate-90" />}
      {count >= 5 && (
        <Fosforo className="left-[5px] top-[1px] rotate-45 scale-[1.18]" />
      )}
    </span>
  );
}

function Fosforo({ className }: { className: string }) {
  return (
    <span
      className={`absolute block w-[2px] h-[12px] rounded-full bg-[#e8d4a0] shadow-[0_0_1px_rgba(0,0,0,0.8)] origin-center ${className}`}
    >
      <span className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-[4px] h-[4px] rounded-full bg-dorado border border-carbon/40" />
    </span>
  );
}
