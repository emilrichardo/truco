"use client";
// Marcador minimalista: sólo palitos formando un cuadrado con una diagonal
// para representar cada grupo de 5 puntos. Dos columnas (Nos / Ellos)
// apiladas verticalmente, compacto para vivir arriba a la derecha de la mesa.
import { usePuntoAnimado } from "@/lib/usePuntoAnimado";

const TAM = 18; // px de cada cuadradito

export function Marcador({
  puntosNos,
  puntosEllos,
  miEquipoEs0,
  tituloNos = "Nos",
  tituloEllos = "Ellos"
}: {
  puntosNos: number;
  puntosEllos: number;
  /** Mantenido por compatibilidad — ya no se muestra header. */
  objetivo?: 15 | 30;
  miEquipoEs0: boolean;
  /** En 1v1 se pasan los nombres reales (yo / rival) en vez de "Nos / Ellos". */
  tituloNos?: string;
  tituloEllos?: string;
}) {
  const nos = miEquipoEs0 ? puntosNos : puntosEllos;
  const ellos = miEquipoEs0 ? puntosEllos : puntosNos;
  // Animamos los dos contadores con tick — los palitos van apareciendo
  // de a uno con su sonidito y se siente que la mano sumó.
  const nosAnim = usePuntoAnimado(nos, true);
  const ellosAnim = usePuntoAnimado(ellos, false);
  return (
    <div className="placa-madera p-1.5 flex gap-2 items-start">
      <Columna puntos={nosAnim} color="var(--dorado)" titulo={tituloNos} />
      <div className="w-px self-stretch bg-crema/15" />
      <Columna puntos={ellosAnim} color="var(--crema)" titulo={tituloEllos} />
    </div>
  );
}

function Columna({
  puntos,
  color,
  titulo
}: {
  puntos: number;
  color: string;
  titulo: string;
}) {
  // Repartir puntos en grupos de 0..5
  const grupos: number[] = [];
  let restante = puntos;
  while (restante > 0) {
    grupos.push(Math.min(5, restante));
    restante -= 5;
  }
  if (grupos.length === 0) grupos.push(0); // caja vacía cuando 0
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-[9px] uppercase tracking-wider font-bold leading-none mb-0.5"
        style={{ color }}
        title={titulo}
      >
        {titulo}
      </span>
      {grupos.map((c, i) => (
        <Grupo key={i} count={c} color={color} />
      ))}
    </div>
  );
}

/** Cuadrado de 4 palitos (top, right, bottom, left) + diagonal al llegar a 5. */
function Grupo({ count, color }: { count: number; color: string }) {
  const sw = 1.6;
  // Dibujamos los 4 lados según cuenta y agregamos la diagonal en 5.
  const showTop = count >= 1;
  const showRight = count >= 2;
  const showBottom = count >= 3;
  const showLeft = count >= 4;
  const showDiag = count >= 5;
  return (
    <svg
      width={TAM}
      height={TAM}
      viewBox="0 0 20 20"
      className="block"
      aria-label={`${count} de 5`}
    >
      {showTop && (
        <line
          x1={2}
          y1={2}
          x2={18}
          y2={2}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {showRight && (
        <line
          x1={18}
          y1={2}
          x2={18}
          y2={18}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {showBottom && (
        <line
          x1={18}
          y1={18}
          x2={2}
          y2={18}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {showLeft && (
        <line
          x1={2}
          y1={18}
          x2={2}
          y2={2}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )}
      {showDiag && (
        <line
          x1={2}
          y1={18}
          x2={18}
          y2={2}
          stroke={color}
          strokeWidth={sw + 0.4}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
