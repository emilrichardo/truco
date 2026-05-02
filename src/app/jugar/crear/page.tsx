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
  const [tamanio, setTamanio] = useState<2 | 4>(4);
  const [publica, setPublica] = useState(false);
  // Puntos siempre a 18 (9 malas + 9 buenas) por ahora.
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
      conFlor,
      publica
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

        <Opcion label="Modo">
          <ChoiceModo
            activo={tamanio === 2}
            onClick={() => setTamanio(2)}
            icono="/brand/iconos/1vs1.webp"
            label="Solo a solo"
          />
          <ChoiceModo
            activo={tamanio === 4}
            onClick={() => setTamanio(4)}
            icono="/brand/iconos/2vs2.webp"
            label="En parejas"
          />
        </Opcion>

        <Opcion label="Flor">
          <Choice activo={!conFlor} onClick={() => setConFlor(false)}>
            Sin flor
          </Choice>
          <Choice activo={conFlor} onClick={() => setConFlor(true)}>
            Con flor (+3 pts)
          </Choice>
        </Opcion>

        <label className="flex items-center gap-2 mb-4 cursor-pointer select-none p-2 -mx-2 rounded hover:bg-azul-criollo/10 transition">
          <input
            type="checkbox"
            checked={publica}
            onChange={(e) => setPublica(e.target.checked)}
            className="w-4 h-4 accent-dorado"
          />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-crema font-bold">Sala pública</div>
            <div className="text-[11px] text-text-dim leading-snug">
              Aparece en el home — cualquier primo puede entrar sin que le
              compartas el enlace.
            </div>
          </div>
        </label>

        <div className="mb-4 text-center text-text-dim/70 text-[11px]">
          Partida <span className="text-crema">a 18</span> · 9 malas y 9 buenas
        </div>

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

/** Botón de modo con ícono PNG arriba y label abajo. Mismo criterio
 *  visual que Choice (activo = borde dorado, no fondo lleno). */
function ChoiceModo({
  activo,
  onClick,
  icono,
  label
}: {
  activo: boolean;
  onClick: () => void;
  icono: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition min-h-[120px] ${
        activo
          ? "border-dorado text-dorado"
          : "border-border text-crema hover:border-azul-criollo/60"
      }`}
    >
      <img
        src={icono}
        alt=""
        aria-hidden
        draggable={false}
        className={`w-16 h-16 sm:w-20 sm:h-20 object-contain select-none transition-transform ${
          activo ? "scale-105" : ""
        }`}
      />
      <span className="font-display text-sm sm:text-base leading-tight">
        {label}
      </span>
    </button>
  );
}
