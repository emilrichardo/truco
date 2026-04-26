"use client";
// Marcador estilo libreta de truco con palitos verticales y rayas cruzadas.
// Imita el cuaderno de los juegos clásicos: "ELLOS / NOS" con un "A 30" arriba.
import clsx from "clsx";

export function Marcador({
  puntosNos,
  puntosEllos,
  objetivo,
  miEquipoEs0
}: {
  puntosNos: number;
  puntosEllos: number;
  objetivo: 15 | 30;
  miEquipoEs0: boolean;
}) {
  // "Nos" = mi equipo. Si soy del equipo 1, intercambio.
  const nos = miEquipoEs0 ? puntosNos : puntosEllos;
  const ellos = miEquipoEs0 ? puntosEllos : puntosNos;
  return (
    <div className="relative">
      <div className="bg-[#fbf3d6] rounded-md shadow-2xl border border-[#b8893a] px-3 py-2 min-w-[260px]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0 22px, rgba(180,140,60,0.18) 22px 23px)"
        }}
      >
        <div className="flex items-baseline justify-between border-b border-[#7a4f1f]/40 pb-1 mb-1">
          <span className="font-display uppercase text-truco-dark/70 text-[11px] tracking-widest">
            Truco
          </span>
          <span className="font-display text-truco-red text-base">
            <span className="text-[10px] mr-0.5 align-top">A</span>
            {objetivo}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#7a4f1f]/50" />
          <Columna titulo="ELLOS" puntos={ellos} objetivo={objetivo} />
          <Columna titulo="NOS" puntos={nos} objetivo={objetivo} destacar />
        </div>
      </div>
    </div>
  );
}

function Columna({
  titulo,
  puntos,
  objetivo,
  destacar
}: {
  titulo: string;
  puntos: number;
  objetivo: 15 | 30;
  destacar?: boolean;
}) {
  // Cada grupo: 4 palitos verticales + 1 cruzado en diagonal = 5 puntos.
  const grupos = Math.floor(puntos / 5);
  const restantes = puntos % 5;
  const totalGrupos = objetivo / 5;

  const items: JSX.Element[] = [];
  for (let g = 0; g < totalGrupos; g++) {
    const completo = g < grupos;
    const parcial = g === grupos ? restantes : 0;
    items.push(<Grupo key={g} completo={completo} parcial={parcial} />);
  }

  return (
    <div className="px-2">
      <div className={clsx(
        "text-center font-display uppercase tracking-widest text-[11px] mb-1",
        destacar ? "text-truco-red" : "text-truco-dark/70"
      )}>
        {titulo}
      </div>
      <div className="flex flex-wrap gap-2 min-h-[56px] items-end justify-center">
        {items}
      </div>
      <div className={clsx(
        "text-center font-display mt-1 leading-none",
        destacar ? "text-truco-red text-xl" : "text-truco-dark/70 text-xl"
      )}>
        {puntos}
      </div>
    </div>
  );
}

/** Un grupo de 5: 4 palitos verticales y 1 diagonal "tachando". */
function Grupo({ completo, parcial }: { completo: boolean; parcial: number }) {
  const palitos = completo ? 4 : Math.min(parcial, 4);
  const cruzar = completo;
  return (
    <div className="relative h-9 w-8" aria-label={`grupo ${cruzar ? 5 : palitos}`}>
      {Array.from({ length: 4 }).map((_, i) => (
        <span
          key={i}
          className={clsx(
            "absolute bottom-0 w-[2px] h-9 rounded-sm",
            i < palitos ? "bg-truco-dark" : "bg-truco-dark/10"
          )}
          style={{ left: `${i * 6 + 2}px`, transform: `rotate(${(i % 2 === 0 ? -2 : 2)}deg)` }}
        />
      ))}
      {cruzar && (
        <span
          className="absolute left-0 right-0 top-1/2 h-[2px] bg-truco-red rounded-sm"
          style={{ transform: "rotate(-25deg)" }}
        />
      )}
      {parcial === 5 && !completo && (
        <span
          className="absolute left-0 right-0 top-1/2 h-[2px] bg-truco-red rounded-sm"
          style={{ transform: "rotate(-25deg)" }}
        />
      )}
    </div>
  );
}
