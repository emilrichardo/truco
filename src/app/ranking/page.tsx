"use client";
// Ranking de primos: agregados de partidas terminadas (online sólo).
// Las partidas vs máquina no entran en este cálculo.
import { useEffect, useState } from "react";
import Link from "next/link";
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
}

export default function RankingPage() {
  const [filas, setFilas] = useState<FilaRanking[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <p className="text-center text-text-dim text-xs subtitulo-claim mb-5">
        Sólo partidas online entre primos · solo no cuenta
      </p>

      {error && (
        <div className="card p-3 text-red text-sm text-center">{error}</div>
      )}

      {!filas && !error && (
        <div className="card p-3 text-text-dim text-sm text-center parpadeo">
          Cargando…
        </div>
      )}

      {filas && filas.length === 0 && (
        <div className="card p-5 text-text-dim text-sm text-center">
          Todavía no hay partidas terminadas. Jugá una online y volvé.
        </div>
      )}

      {filas && filas.length > 0 && (
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
              {filas.map((f, i) => (
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
                    {f.ganadas}
                  </td>
                  <td className="px-2 py-2 text-right text-text-dim">
                    {f.perdidas}
                  </td>
                  <td className="px-2 py-2 text-right font-bold">
                    {f.winrate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DivisorCriollo azul className="my-6" />
    </main>
  );
}
