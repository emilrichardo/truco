"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";
import { getPersonaje, urlPersonaje } from "@/data/jugadores";
import { usePersonajeLocal } from "@/lib/personaje";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";
import { IconoIndividual, IconoParejas } from "@/components/IconoModo";
import { usePreloadCartas } from "@/lib/preload";
import { borrarSnapshotLocal } from "@/lib/salaLocal";

export default function SoloPage() {
  const router = useRouter();
  const [miSlug, setMiSlug, listo] = usePersonajeLocal();
  const [cambiar, setCambiar] = useState(false);
  const [tamanio, setTamanio] = useState<2 | 4>(2);
  const [puntos, setPuntos] = useState<15 | 30>(15);
  const [creando, setCreando] = useState(false);

  // Mientras el usuario elige config, ya empezamos a bajar las cartas.
  usePreloadCartas();

  useEffect(() => {
    if (listo && !miSlug) router.replace("/");
  }, [listo, miSlug, router]);

  if (!listo || !miSlug) return <main className="min-h-[100dvh]" />;
  const yo = getPersonaje(miSlug);
  if (!yo) return <main className="min-h-[100dvh]" />;

  const empezar = () => {
    if (creando) return;
    setCreando(true);
    // Forzar partida nueva: limpiar snapshot anterior (chat, cartas, etc.)
    // así no arrastra estado de una partida previa.
    borrarSnapshotLocal();
    router.push(`/jugar/solo/partida?tamanio=${tamanio}&puntos=${puntos}`);
  };

  return (
    <main className="min-h-[100dvh] px-4 py-5 max-w-xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-text-dim text-xs hover:text-dorado transition mb-3"
      >
        <span>←</span> Volver
      </Link>

      <HeaderMarca variante="compacto" />

      <DivisorCriollo className="my-5" />

      <h1 className="titulo-marca text-2xl text-center mb-4">
        Contra la <span className="acento">máquina</span>
      </h1>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
          <img
            src={urlPersonaje(miSlug)}
            alt={yo.nombre}
            className="w-14 h-14 rounded-full object-cover object-top border-2 border-dorado shadow-md"
          />
          <div className="flex-1">
            <div className="label-slim acento-azul">Jugás como</div>
            <div className="font-display text-xl leading-tight">{yo.nombre}</div>
          </div>
          <button
            onClick={() => setCambiar((v) => !v)}
            className="btn btn-ghost !px-3 !py-2 text-xs"
          >
            Cambiar
          </button>
        </div>

        {cambiar && (
          <div className="mb-4">
            <SelectorPersonaje
              seleccionado={miSlug}
              onSeleccionar={(s) => {
                setMiSlug(s);
                setCambiar(false);
              }}
            />
          </div>
        )}

        <Opcion label="Modo">
          <Choice activo={tamanio === 4} onClick={() => setTamanio(4)}>
            <IconoParejas size={22} />
            <span>En parejas</span>
          </Choice>
          <Choice activo={tamanio === 2} onClick={() => setTamanio(2)}>
            <IconoIndividual size={22} />
            <span>Solo a solo</span>
          </Choice>
        </Opcion>
        <Opcion label="A cuántos">
          <Choice activo={puntos === 15} onClick={() => setPuntos(15)}>
            15 corto
          </Choice>
          <Choice activo={puntos === 30} onClick={() => setPuntos(30)}>
            30 largo
          </Choice>
        </Opcion>

        <button
          onClick={empezar}
          disabled={creando}
          className="btn btn-primary w-full mt-2"
        >
          {creando ? "Repartiendo…" : "Empezar partida"}
        </button>
      </div>
    </main>
  );
}

function Opcion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="label-slim mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function Choice({
  activo,
  children,
  onClick
}: {
  activo: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className={`btn ${activo ? "btn-primary" : ""}`}>
      {children}
    </button>
  );
}
