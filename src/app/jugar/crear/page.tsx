"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { crearSalaOnline, guardarSesion } from "@/lib/salaOnline";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";
import { getPersonaje, urlPersonaje } from "@/data/jugadores";
import { usePersonajeLocal } from "@/lib/personaje";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";
import { usePreloadCartas } from "@/lib/preload";

export default function CrearSalaPage() {
  const router = useRouter();
  const [miSlug, setMiSlug, listo] = usePersonajeLocal();
  const [cambiar, setCambiar] = useState(false);
  const [conFlor, setConFlor] = useState(false);
  // Por ahora la única modalidad ofrecida es 2v2 a 18 (9 malas + 9 buenas).
  const tamanio = 4 as const;
  const puntos = 18 as const;
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mientras el usuario elige config, precargamos las cartas en background.
  usePreloadCartas();

  useEffect(() => {
    if (listo && !miSlug) router.replace("/");
  }, [listo, miSlug, router]);

  if (!listo || !miSlug) return <main className="min-h-[100dvh]" />;
  const yo = getPersonaje(miSlug);
  if (!yo) return <main className="min-h-[100dvh]" />;

  const crear = async () => {
    if (creando) return;
    setCreando(true);
    setError(null);
    const r = await crearSalaOnline({
      nombre: yo.nombre,
      personaje: miSlug,
      tamanio,
      puntosObjetivo: puntos,
      conFlor
    });
    if (!r.ok || !r.sala_id || !r.jugador_id) {
      setError(r.error || "No se pudo crear la sala.");
      setCreando(false);
      return;
    }
    guardarSesion({
      salaId: r.sala_id,
      jugadorId: r.jugador_id,
      perfilId: r.perfil_id
    });
    router.push(`/jugar/sala/${r.sala_id}`);
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
        Crear <span className="acento">partida</span>
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

        <div className="mb-4 text-center text-text-dim text-xs">
          Partida en parejas <span className="text-crema">a 18</span>
          <span className="text-text-dim/60"> · 9 malas y 9 buenas</span>
        </div>

        <Opcion label="Flor">
          <Choice activo={!conFlor} onClick={() => setConFlor(false)}>
            Sin flor
          </Choice>
          <Choice activo={conFlor} onClick={() => setConFlor(true)}>
            Con flor (+3 pts)
          </Choice>
        </Opcion>

        <button
          onClick={crear}
          disabled={creando}
          className="btn btn-primary w-full mt-2"
        >
          {creando ? "Entrando…" : "Entrar"}
        </button>
        {error && (
          <p className="text-red text-xs mt-2 text-center font-bold">{error}</p>
        )}
        <p className="text-text-dim text-xs mt-3 text-center italic">
          Adentro podés sumar bots o compartir el enlace con los primos.
        </p>
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
  onClick,
  children
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Activo: solo se diferencia por borde dorado + texto dorado, sin
  // pintar el fondo (queda más sobrio que btn-primary lleno).
  return (
    <button
      onClick={onClick}
      aria-pressed={activo}
      className={`btn ${
        activo
          ? "!border-dorado !text-dorado"
          : ""
      }`}
    >
      {children}
    </button>
  );
}
