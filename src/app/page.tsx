"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { urlPersonaje, getPersonaje } from "@/data/jugadores";
import { usePersonajeLocal } from "@/lib/personaje";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";

export default function HomePage() {
  const [miSlug, setMiSlug, listo] = usePersonajeLocal();
  const [editando, setEditando] = useState(false);

  if (!listo) return <main className="min-h-[100dvh]" />;
  if (!miSlug) return <ElegirPrimero onElegir={(s) => setMiSlug(s)} />;

  const yo = getPersonaje(miSlug);
  if (!yo) return <ElegirPrimero onElegir={(s) => setMiSlug(s)} />;

  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-2xl mx-auto">
      <HeaderMarca variante="hero" href={null} />

      <DivisorCriollo className="my-6" />

      {/* Tarjeta del primo seleccionado */}
      <section className="card p-3 mb-5 flex items-center gap-3 border-l-4 border-l-dorado">
        <img
          src={urlPersonaje(miSlug)}
          alt={yo.nombre}
          className="w-14 h-14 rounded-full object-cover object-top border-2 border-dorado flex-shrink-0 shadow-md"
        />
        <div className="flex-1 min-w-0">
          <div className="label-slim acento-azul">Vas a jugar como</div>
          <div className="font-display text-xl text-crema leading-tight truncate">
            {yo.nombre}
          </div>
        </div>
        <button
          onClick={() => setEditando((v) => !v)}
          className="btn btn-ghost !px-3 !py-2 text-xs"
        >
          Cambiar
        </button>
      </section>

      {editando && (
        <section className="card p-3 mb-5">
          <div className="label-slim mb-2">Elegí otro primo</div>
          <SelectorPersonaje
            seleccionado={miSlug}
            onSeleccionar={(slug) => {
              setMiSlug(slug);
              setEditando(false);
            }}
          />
        </section>
      )}

      {/* Acción principal: una sola CTA — adentro de la sala
       *  decidís si sumás bots o invitás primos. */}
      <section className="mb-6 text-center">
        <Link
          href="/jugar/crear"
          className="btn btn-primary w-full !text-base !py-3.5"
        >
          Crear partida de truco
        </Link>
        <p className="text-text-dim text-xs mt-2 leading-snug">
          Invitá a tus primos a jugar online o sumá bots para arrancar ya
        </p>
      </section>

      <footer className="text-center mt-20 sm:mt-24 pt-6 border-t border-border/40 space-y-2">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/reglas"
            className="inline-flex items-center gap-1.5 text-text-dim hover:text-dorado transition text-xs subtitulo-claim"
          >
            📖 Reglas
          </Link>
          <span className="text-text-dim/40">·</span>
          <Link
            href="/ranking"
            className="inline-flex items-center gap-1.5 text-text-dim hover:text-dorado transition text-xs subtitulo-claim"
          >
            🏆 Tabla de posiciones
          </Link>
          <span className="text-text-dim/40">·</span>
          <BotonCompartirJuego />
        </div>
        <div className="text-text-dim/60 text-[10px] subtitulo-claim">
          Hecho con asado y mate · {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}

/** Botón de "Compartir el juego" para invitar primos al sitio (no a una
 *  sala puntual). Usa la Web Share API en mobile y cae en copiar al
 *  clipboard en desktop. Mensaje pensado para WhatsApp: emoji + claim
 *  + URL para que el preview de OG complete con el logo. */
function BotonCompartirJuego() {
  const [tieneShare, setTieneShare] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    setTieneShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const compartir = async () => {
    const url =
      typeof window !== "undefined" ? window.location.origin : "";
    const texto =
      "🃏 Truco entre Primos — jugá truco argentino online, gratis, sin registro. Sumate:";
    const datos = { title: "Truco Entre Primos", text: texto, url };

    if (tieneShare) {
      try {
        await navigator.share(datos);
        return;
      } catch {
        /* usuario canceló — no hacemos nada */
        return;
      }
    }
    // Fallback desktop: copiar al clipboard.
    try {
      await navigator.clipboard.writeText(`${texto} ${url}`);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copiá este enlace:", url);
    }
  };

  return (
    <button
      type="button"
      onClick={compartir}
      className="inline-flex items-center gap-1.5 text-text-dim hover:text-dorado transition text-xs subtitulo-claim"
      aria-label="Compartir el juego con amigos"
    >
      {copiado ? (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
      )}
      <span>{copiado ? "Enlace copiado" : "Compartir con amigos"}</span>
    </button>
  );
}

function ElegirPrimero({ onElegir }: { onElegir: (slug: string) => void }) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const yo = seleccionado ? getPersonaje(seleccionado) : null;
  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-xl mx-auto">
      <HeaderMarca variante="compacto" href={null} />
      <p className="text-center text-text-dim text-sm mt-4 mb-5">
        Antes de jugar, elegí qué primo te representa.
      </p>
      <div className="card p-4">
        <SelectorPersonaje
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
        />
        <button
          onClick={() => seleccionado && onElegir(seleccionado)}
          disabled={!seleccionado}
          className="btn btn-primary w-full mt-4"
        >
          {yo ? `Soy ${yo.nombre}` : "Elegí un primo"}
        </button>
      </div>
    </main>
  );
}
