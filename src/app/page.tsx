"use client";
import Link from "next/link";
import { useState } from "react";
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
      <HeaderMarca variante="hero" conClaim href={null} />

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

      {/* Acciones principales: dos caminos lado a lado */}
      <section className="grid grid-cols-2 gap-3 mb-6">
        <OpcionMenu
          href="/jugar/crear"
          icono="/brand/iconos/online.png"
          titulo="Crear sala online"
          subtitulo="Generá un link para los primos"
          variante="primario"
        />
        <OpcionMenu
          href="/jugar/solo"
          icono="/brand/iconos/maquina.png"
          titulo="Contra la máquina"
          subtitulo="1 vs 1 o 2 vs 2 con bots"
          variante="secundario"
        />
      </section>

      <footer className="text-center mt-8 space-y-2">
        <Link
          href="/reglas"
          className="inline-flex items-center gap-1.5 text-text-dim hover:text-dorado transition text-xs subtitulo-claim"
        >
          📖 Reglas del truco
        </Link>
        <div className="text-text-dim/60 text-[10px] subtitulo-claim">
          Hecho con asado y mate · {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}

function OpcionMenu({
  href,
  icono,
  titulo,
  subtitulo,
  variante
}: {
  href: string;
  icono: string;
  titulo: string;
  subtitulo: string;
  variante: "primario" | "secundario";
}) {
  const esPrimario = variante === "primario";
  return (
    <Link
      href={href}
      className={`card p-5 flex flex-col items-center text-center gap-2 transition group min-h-[180px] justify-center ${
        esPrimario
          ? "border-2 border-dorado bg-gradient-to-br from-dorado/15 to-surface hover:from-dorado/25"
          : "border-2 border-azul-criollo/60 bg-gradient-to-br from-azul-criollo/10 to-surface hover:border-azul-criollo"
      }`}
    >
      <img
        src={icono}
        alt=""
        aria-hidden
        draggable={false}
        className="w-20 h-20 sm:w-24 sm:h-24 object-contain select-none drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)] group-hover:scale-110 transition-transform"
      />
      <div className="flex-1 flex flex-col justify-center">
        <div
          className={`font-display text-base sm:text-lg leading-tight ${
            esPrimario ? "text-dorado" : "text-crema"
          }`}
        >
          {titulo}
        </div>
        <div className="text-text-dim text-[11px] mt-1 leading-snug">
          {subtitulo}
        </div>
      </div>
    </Link>
  );
}

function ElegirPrimero({ onElegir }: { onElegir: (slug: string) => void }) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const yo = seleccionado ? getPersonaje(seleccionado) : null;
  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-xl mx-auto">
      <HeaderMarca variante="compacto" conClaim href={null} />
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
