"use client";
// Marcador estilo "tablilla de boliche": placa de madera con tiza para los
// fósforos. Compacto, vive arriba del chat en mobile y desktop.
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
  const nos = miEquipoEs0 ? puntosNos : puntosEllos;
  const ellos = miEquipoEs0 ? puntosEllos : puntosNos;
  return (
    <div className="placa-madera px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="subtitulo-claim text-[10px] text-crema/80">Puntos</span>
        <span className="text-crema/70 text-[10px] subtitulo-claim">
          a {objetivo}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Columna titulo="Nos" puntos={nos} destacar />
        <Columna titulo="Ellos" puntos={ellos} />
      </div>
    </div>
  );
}

function Columna({
  titulo,
  puntos,
  destacar
}: {
  titulo: string;
  puntos: number;
  destacar?: boolean;
}) {
  const grupos = Math.floor(puntos / 5);
  const restantes = puntos % 5;
  const items: JSX.Element[] = [];
  for (let g = 0; g < grupos; g++) items.push(<Grupo key={g} completo />);
  if (restantes > 0) items.push(<Grupo key="parcial" parcial={restantes} />);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span
          className={clsx(
            "text-[10px] uppercase tracking-wider font-bold",
            destacar ? "text-dorado" : "text-crema/70"
          )}
        >
          {titulo}
        </span>
        <span
          className={clsx(
            "font-display text-2xl leading-none",
            destacar ? "text-dorado" : "text-crema"
          )}
          style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.6)" }}
        >
          {puntos}
        </span>
      </div>
      <div className="flex gap-1.5 mt-1.5 min-h-[28px] items-end flex-wrap">
        {items}
      </div>
    </div>
  );
}

function Grupo({
  completo,
  parcial = 0
}: {
  completo?: boolean;
  parcial?: number;
}) {
  const palitos = completo ? 4 : Math.min(parcial, 4);
  return (
    <div className="relative h-6 w-7">
      {Array.from({ length: palitos }).map((_, i) => (
        <span
          key={i}
          className="absolute bottom-0 w-[2px] h-6 rounded-sm bg-crema/90"
          style={{
            left: `${i * 5 + 2}px`,
            transform: `rotate(${i % 2 === 0 ? -2 : 2}deg)`,
            boxShadow: "0 0 2px rgba(241,224,184,0.5)"
          }}
        />
      ))}
      {completo && (
        <span
          className="absolute left-0 right-0 top-1/2 h-[2px] bg-dorado rounded-sm"
          style={{
            transform: "rotate(-30deg)",
            boxShadow: "0 0 3px rgba(217,164,65,0.8)"
          }}
        />
      )}
    </div>
  );
}
