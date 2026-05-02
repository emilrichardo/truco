"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { urlPersonaje, getPersonaje } from "@/data/jugadores";
import { usePersonajeLocal } from "@/lib/personaje";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";
import { BotonInstalarApp } from "@/components/BotonInstalarApp";
import { MisCantos } from "@/components/MisCantos";
import {
  leerSalaActiva,
  limpiarSalaActiva,
  listarSalasPublicasOnline,
  type SalaPublicaResumen
} from "@/lib/salaOnline";

export default function HomePage() {
  const [miSlug, setMiSlug, listo] = usePersonajeLocal();
  const [editando, setEditando] = useState(false);
  const [mostrarMisCantos, setMostrarMisCantos] = useState(false);
  const [salaActiva, setSalaActiva] = useState<string | null>(null);
  const [salasPublicas, setSalasPublicas] = useState<SalaPublicaResumen[]>([]);

  // Leer la sala activa al montar y al volver a esta pestaña (focus).
  // Así si el usuario cierra una partida en otra pestaña, el card de
  // "Volver a la partida" desaparece sin recargar.
  useEffect(() => {
    const refrescar = () => setSalaActiva(leerSalaActiva());
    refrescar();
    window.addEventListener("focus", refrescar);
    return () => window.removeEventListener("focus", refrescar);
  }, []);

  // Listar salas públicas. Refrescamos al montar, al volver el foco y
  // cada 15s para ver salas nuevas sin tener que recargar.
  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      const salas = await listarSalasPublicasOnline();
      if (!cancelado) setSalasPublicas(salas);
    };
    cargar();
    window.addEventListener("focus", cargar);
    const interval = window.setInterval(cargar, 15000);
    return () => {
      cancelado = true;
      window.removeEventListener("focus", cargar);
      clearInterval(interval);
    };
  }, []);

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
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setEditando((v) => !v)}
            className="btn btn-ghost !px-3 !py-1.5 !min-h-0 text-[11px]"
          >
            Cambiar
          </button>
          <button
            onClick={() => setMostrarMisCantos(true)}
            className="btn btn-ghost !px-3 !py-1.5 !min-h-0 text-[11px] inline-flex items-center gap-1"
            title="Grabar mis cantos"
          >
            <svg
              viewBox="0 0 24 24"
              width="11"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
              <path d="M9 21h6" />
            </svg>
            Mis cantos
          </button>
        </div>
      </section>

      {mostrarMisCantos && (
        <MisCantos
          miSlug={miSlug}
          onCerrar={() => setMostrarMisCantos(false)}
        />
      )}

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

      {/* Sala en curso: aparece sólo si el usuario tiene una partida
       *  online activa (marcada al unirse, limpiada al cerrar/abandonar
       *  o al terminar la partida). */}
      {salaActiva && (
        <section className="card p-3 mb-5 border-2 border-dorado/60 bg-azul-criollo/10">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🃏</div>
            <div className="flex-1 min-w-0">
              <div className="label-slim acento-azul">Tenés una partida en curso</div>
              <div className="font-display text-base text-crema leading-tight truncate">
                Sala #{salaActiva.slice(0, 6).toUpperCase()}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
            <Link
              href={`/jugar/sala/${salaActiva}`}
              className="btn btn-primary !text-sm !py-2"
            >
              Volver a la partida
            </Link>
            <button
              type="button"
              onClick={() => {
                limpiarSalaActiva();
                setSalaActiva(null);
              }}
              className="btn btn-ghost !text-xs !px-3 !py-2"
              title="Olvidar esta sala (no la cierra, sólo deja de mostrarla acá)"
            >
              Ocultar
            </button>
          </div>
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

      {/* Salas públicas: listado de partidas abiertas marcadas como
       *  "públicas" por sus creadores. Cualquiera puede unirse sin
       *  compartirse el link. */}
      {salasPublicas.length > 0 && (
        <section className="mb-6">
          <div className="label-slim mb-2 flex items-center gap-2">
            <span>Salas abiertas</span>
            <span className="text-text-dim/60 text-[10px] normal-case tracking-normal">
              ({salasPublicas.length})
            </span>
          </div>
          <div className="space-y-2">
            {salasPublicas.map((s) => {
              const llena = s.jugadores >= s.cupos;
              return (
                <Link
                  key={s.id}
                  href={`/jugar/sala/${s.id}`}
                  className="card p-3 flex items-center gap-3 hover:border-dorado/60 transition border-l-4 border-l-azul-criollo"
                  aria-disabled={llena}
                >
                  <div className="text-2xl flex-shrink-0">
                    {s.modo === "2v2" ? "👥" : "🤜"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-sm text-crema truncate">
                      {s.creador ? `Sala de ${s.creador}` : `Sala #${s.id.slice(0, 6).toUpperCase()}`}
                    </div>
                    <div className="text-text-dim text-[11px] flex items-center gap-2 flex-wrap">
                      <span>{s.modo === "2v2" ? "Parejas" : "Mano a mano"}</span>
                      <span className="text-text-dim/40">·</span>
                      <span>{s.jugadores}/{s.cupos} jugadores</span>
                      {s.con_flor && (
                        <>
                          <span className="text-text-dim/40">·</span>
                          <span className="text-dorado">🌸 con flor</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div
                    className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest flex-shrink-0 ${
                      llena
                        ? "bg-text-dim/20 text-text-dim"
                        : "bg-dorado/15 text-dorado"
                    }`}
                  >
                    {llena ? "Llena" : "Entrar"}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
          <span className="text-text-dim/40">·</span>
          <BotonInstalarApp />
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
  // Tras confirmar el primo, abrimos el modal de "Mis cantos" para que
  // pueda grabar su voz para cada canto antes de entrar al juego. Es
  // opcional — el modal tiene "Cerrar" y desde el home siempre puede
  // volver a abrirlo.
  const [grabandoCantos, setGrabandoCantos] = useState<string | null>(null);
  const yo = seleccionado ? getPersonaje(seleccionado) : null;

  const confirmar = () => {
    if (!seleccionado) return;
    setGrabandoCantos(seleccionado);
  };

  const continuar = () => {
    if (!grabandoCantos) return;
    const slug = grabandoCantos;
    setGrabandoCantos(null);
    onElegir(slug);
  };

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
          onClick={confirmar}
          disabled={!seleccionado}
          className="btn btn-primary w-full mt-4"
        >
          {yo ? `Soy ${yo.nombre}` : "Elegí un primo"}
        </button>
      </div>
      {grabandoCantos && (
        <MisCantos
          miSlug={grabandoCantos}
          onCerrar={continuar}
          tituloIntro="Grabá tus cantos (opcional)"
          ctaCerrar="Listo, entrar"
        />
      )}
    </main>
  );
}
