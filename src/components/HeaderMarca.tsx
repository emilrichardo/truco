"use client";
import Link from "next/link";

/** Cabecera con logo. Tres tamaños: hero (home), compacto (subpáginas), mini (sala). */
export function HeaderMarca({
  variante = "compacto",
  conClaim = false,
  href = "/"
}: {
  variante?: "hero" | "compacto" | "mini";
  conClaim?: boolean;
  href?: string | null;
}) {
  const sizes: Record<string, string> = {
    hero: "w-64 md:w-80",
    compacto: "w-40 md:w-48",
    mini: "w-24"
  };
  const claseTamano = sizes[variante];

  const logo = (
    <img
      src="/brand/logo.webp"
      alt="Truco Entre Primos"
      className={`${claseTamano} h-auto select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]`}
      draggable={false}
    />
  );

  return (
    <header className="text-center">
      {href ? (
        <Link href={href} className="inline-block hover:opacity-90 transition">
          {logo}
        </Link>
      ) : (
        <span className="inline-block">{logo}</span>
      )}

      {conClaim && (
        <div className="mt-3 flex justify-center">
          <div className="cinta-claim subtitulo-claim inline-block px-4 py-1 rounded-sm text-[11px]">
            Acá no hay suerte, hay <span className="acento-azul">picardía</span>
          </div>
        </div>
      )}
    </header>
  );
}

/** Divisor ornamental: línea con un sol ✦ en el centro, paleta dorada. */
export function DivisorCriollo({
  azul = false,
  className = ""
}: {
  azul?: boolean;
  className?: string;
}) {
  return (
    <div className={`divisor ${azul ? "divisor-azul" : ""} ${className}`}>
      <span className="text-base leading-none">✦</span>
    </div>
  );
}
