"use client";
// Íconos para los modos de juego: parejas (4 personas) e individual (2 personas
// de distinto color para enfatizar el versus).

export function IconoParejas({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Pareja izquierda (mismo color) */}
      <circle cx={8} cy={11} r={3} />
      <path d="M3 22 c0 -3 2 -5 5 -5 s5 2 5 5" />
      <circle cx={13} cy={9} r={2.4} />
      <path d="M9 17 c0 -2 1.6 -3.5 4 -3.5 s4 1.5 4 3.5" />
      {/* Pareja derecha (otro color visual via opacity) */}
      <g opacity={0.85}>
        <circle cx={24} cy={11} r={3} />
        <path d="M19 22 c0 -3 2 -5 5 -5 s5 2 5 5" />
        <circle cx={19} cy={9} r={2.4} />
        <path d="M15 17 c0 -2 1.6 -3.5 4 -3.5 s4 1.5 4 3.5" />
      </g>
    </svg>
  );
}

export function IconoIndividual({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Persona izquierda — color dorado */}
      <g stroke="var(--dorado)">
        <circle cx={9} cy={11} r={3.2} />
        <path d="M3 24 c0 -3.5 2.5 -6 6 -6 s6 2.5 6 6" />
      </g>
      {/* "vs" central */}
      <text
        x={16}
        y={18}
        textAnchor="middle"
        fontFamily="Georgia, serif"
        fontSize={6}
        fontWeight={700}
        fill="var(--crema)"
        stroke="none"
      >
        vs
      </text>
      {/* Persona derecha — color azul criollo */}
      <g stroke="var(--azul-criollo)">
        <circle cx={23} cy={11} r={3.2} />
        <path d="M17 24 c0 -3.5 2.5 -6 6 -6 s6 2.5 6 6" />
      </g>
    </svg>
  );
}
