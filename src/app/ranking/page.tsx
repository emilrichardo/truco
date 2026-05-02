"use client";
// Ranking de primos: agregados de partidas terminadas. Pestañas:
//   - Entre primos: sólo partidas donde TODOS los jugadores fueron
//     humanos (ningún bot en la mesa).
//   - Con bots: partidas donde participó al menos un bot.
// El view `ranking` calcula ambos conteos en paralelo.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { tryGetSupabase } from "@/lib/supabase/cliente";
import { urlPersonaje } from "@/data/jugadores";
import { HeaderMarca, DivisorCriollo } from "@/components/HeaderMarca";

interface FilaRanking {
  perfil_id: string;
  nombre: string;
  personaje: string;
  partidas_jugadas: number;
  ganadas: number;
  perdidas: number;
  winrate: number;
  partidas_humanos: number;
  ganadas_humanos: number;
  perdidas_humanos: number;
  winrate_humanos: number;
  partidas_bots: number;
  ganadas_bots: number;
  perdidas_bots: number;
  winrate_bots: number;
}

type Pestana = "humanos" | "bots";

export default function RankingPage() {
  const [filas, setFilas] = useState<FilaRanking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("humanos");

  useEffect(() => {
    const sb = tryGetSupabase();
    if (!sb) {
      setError("Supabase no está configurado en este deploy.");
      return;
    }
    (async () => {
      const { data, error: errSel } = await sb
        .from("ranking")
        .select("*")
        .limit(50);
      if (errSel) {
        setError(errSel.message);
        return;
      }
      setFilas(data as FilaRanking[]);
    })();
  }, []);

  // Filtrar y ordenar según pestaña activa. Sólo se muestran perfiles
  // que tengan al menos 1 partida en la categoría — sino el podio se
  // llena de jugadores con 0/0/0%.
  const filasOrdenadas = useMemo(() => {
    if (!filas) return null;
    const conPartidas = filas.filter((f) =>
      pestana === "humanos" ? f.partidas_humanos > 0 : f.partidas_bots > 0
    );
    return conPartidas.sort((a, b) => {
      const gA = pestana === "humanos" ? a.ganadas_humanos : a.ganadas_bots;
      const gB = pestana === "humanos" ? b.ganadas_humanos : b.ganadas_bots;
      if (gA !== gB) return gB - gA;
      const wA = pestana === "humanos" ? a.winrate_humanos : a.winrate_bots;
      const wB = pestana === "humanos" ? b.winrate_humanos : b.winrate_bots;
      return wB - wA;
    });
  }, [filas, pestana]);

  return (
    <main className="min-h-[100dvh] px-4 py-5 max-w-2xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-text-dim text-xs hover:text-dorado transition mb-3"
      >
        <span>←</span> Volver
      </Link>

      <HeaderMarca variante="compacto" />

      <DivisorCriollo className="my-5" />

      <h1 className="titulo-marca text-2xl md:text-3xl text-center mb-2">
        Tabla de <span className="acento">posiciones</span>
      </h1>
      <p className="text-center text-text-dim text-xs subtitulo-claim mb-4">
        Solo no cuenta. Pestaña activa filtra el conteo.
      </p>

      {/* Tabs */}
      <div className="flex justify-center gap-1.5 mb-4">
        <button
          type="button"
          onClick={() => setPestana("humanos")}
          className={clsx(
            "px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition border",
            pestana === "humanos"
              ? "bg-dorado/15 text-dorado border-dorado/60"
              : "bg-surface-2/40 text-text-dim border-border hover:text-crema"
          )}
        >
          Entre primos
        </button>
        <button
          type="button"
          onClick={() => setPestana("bots")}
          className={clsx(
            "px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition border",
            pestana === "bots"
              ? "bg-azul-criollo/20 text-azul-claro border-azul-criollo/60"
              : "bg-surface-2/40 text-text-dim border-border hover:text-crema"
          )}
        >
          Con bots
        </button>
      </div>

      {error && (
        <div className="card p-3 text-red text-sm text-center">{error}</div>
      )}

      {!filasOrdenadas && !error && (
        <div className="card p-3 text-text-dim text-sm text-center parpadeo">
          Cargando…
        </div>
      )}

      {filasOrdenadas && filasOrdenadas.length === 0 && (
        <div className="card p-5 text-text-dim text-sm text-center">
          {pestana === "humanos"
            ? "Todavía no hay partidas online sólo entre humanos. Jugá una y volvé."
            : "Todavía no hay partidas registradas con bots."}
        </div>
      )}

      {filasOrdenadas && filasOrdenadas.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2/60">
              <tr className="text-[10px] uppercase tracking-wider text-text-dim font-bold">
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Primo</th>
                <th className="px-2 py-2 text-right">G</th>
                <th className="px-2 py-2 text-right">P</th>
                <th className="px-2 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {filasOrdenadas.map((f, i) => {
                const g =
                  pestana === "humanos" ? f.ganadas_humanos : f.ganadas_bots;
                const p =
                  pestana === "humanos" ? f.perdidas_humanos : f.perdidas_bots;
                const w =
                  pestana === "humanos" ? f.winrate_humanos : f.winrate_bots;
                return (
                  <tr
                    key={f.perfil_id}
                    className="border-t border-border hover:bg-surface-2/40 transition"
                  >
                    <td className="px-2 py-2 text-text-dim font-bold">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={urlPersonaje(f.personaje)}
                          alt={f.nombre}
                          className={`w-9 h-9 rounded-full object-cover object-top border-2 ${
                            i === 0
                              ? "border-dorado shadow-md"
                              : i < 3
                              ? "border-azul-criollo"
                              : "border-border"
                          }`}
                        />
                        <span className="font-bold truncate">{f.nombre}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right font-display text-dorado">
                      {g}
                    </td>
                    <td className="px-2 py-2 text-right text-text-dim">{p}</td>
                    <td className="px-2 py-2 text-right font-bold">{w}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DivisorCriollo azul className="my-6" />
    </main>
  );
}
