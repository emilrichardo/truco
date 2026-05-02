"use client";
// Ranking + historial de partidas. Pestañas:
//   - Entre primos: ranking agregado, partidas sin bots.
//   - Con bots: ranking agregado, partidas que tuvieron bots.
//   - Historial: lista cronológica de partidas terminadas (ambos
//     equipos visibles, fecha + hora + ganador).
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

interface JugadorPartida {
  perfil_id: string | null;
  nombre: string;
  personaje: string;
  equipo: 0 | 1;
  asiento: number;
  es_bot: boolean;
  gano: boolean;
  puntos: number;
}

interface PartidaReciente {
  id: string;
  modo: "1v1" | "2v2";
  puntos_objetivo: number;
  ganador_equipo: 0 | 1;
  duracion_seg: number;
  created_at: string;
  jugadores: JugadorPartida[];
}

type Pestana = "humanos" | "bots" | "historial";

export default function RankingPage() {
  const [filas, setFilas] = useState<FilaRanking[] | null>(null);
  const [partidas, setPartidas] = useState<PartidaReciente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>("humanos");

  useEffect(() => {
    const sb = tryGetSupabase();
    if (!sb) {
      setError("Supabase no está configurado en este deploy.");
      return;
    }
    (async () => {
      const [r1, r2] = await Promise.all([
        sb.from("ranking").select("*").limit(50),
        sb.from("partidas_recientes").select("*").limit(40)
      ]);
      if (r1.error) {
        setError(r1.error.message);
        return;
      }
      if (r2.error) {
        setError(r2.error.message);
        return;
      }
      setFilas(r1.data as FilaRanking[]);
      setPartidas(r2.data as PartidaReciente[]);
    })();
  }, []);

  // Filtrar y ordenar el ranking según pestaña activa.
  const filasOrdenadas = useMemo(() => {
    if (!filas) return null;
    if (pestana === "historial") return null;
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
      <div className="flex justify-center gap-1.5 mb-4 flex-wrap">
        <TabBtn activa={pestana === "humanos"} onClick={() => setPestana("humanos")} color="dorado">
          Entre primos
        </TabBtn>
        <TabBtn activa={pestana === "bots"} onClick={() => setPestana("bots")} color="azul">
          Con bots
        </TabBtn>
        <TabBtn activa={pestana === "historial"} onClick={() => setPestana("historial")} color="dorado">
          Historial
        </TabBtn>
      </div>

      {error && (
        <div className="card p-3 text-red text-sm text-center">{error}</div>
      )}

      {/* RANKING AGREGADO (humanos / bots) */}
      {pestana !== "historial" && (
        <>
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
                        <td className="px-2 py-2 text-right font-display text-dorado">{g}</td>
                        <td className="px-2 py-2 text-right text-text-dim">{p}</td>
                        <td className="px-2 py-2 text-right font-bold">{w}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* HISTORIAL: lista cronológica de partidas terminadas */}
      {pestana === "historial" && (
        <>
          {!partidas && !error && (
            <div className="card p-3 text-text-dim text-sm text-center parpadeo">
              Cargando…
            </div>
          )}

          {partidas && partidas.length === 0 && (
            <div className="card p-5 text-text-dim text-sm text-center">
              No hay partidas terminadas todavía.
            </div>
          )}

          {partidas && partidas.length > 0 && (
            <div className="space-y-2">
              {partidas.map((p) => (
                <PartidaCard key={p.id} partida={p} />
              ))}
            </div>
          )}
        </>
      )}

      <DivisorCriollo azul className="my-6" />
    </main>
  );
}

function TabBtn({
  activa,
  onClick,
  color,
  children
}: {
  activa: boolean;
  onClick: () => void;
  color: "dorado" | "azul";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "px-3 py-1.5 rounded-md text-xs uppercase tracking-wider font-bold transition border",
        activa
          ? color === "dorado"
            ? "bg-dorado/15 text-dorado border-dorado/60"
            : "bg-azul-criollo/20 text-azul-claro border-azul-criollo/60"
          : "bg-surface-2/40 text-text-dim border-border hover:text-crema"
      )}
    >
      {children}
    </button>
  );
}

function PartidaCard({ partida }: { partida: PartidaReciente }) {
  const fecha = new Date(partida.created_at);
  const fechaStr = fecha.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
  const equipo0 = (partida.jugadores || [])
    .filter((j) => j.equipo === 0)
    .sort((a, b) => a.asiento - b.asiento);
  const equipo1 = (partida.jugadores || [])
    .filter((j) => j.equipo === 1)
    .sort((a, b) => a.asiento - b.asiento);
  const ganador = partida.ganador_equipo;
  const tuvoBots = (partida.jugadores || []).some((j) => j.es_bot);
  const minutos = Math.round(partida.duracion_seg / 60);

  return (
    <div
      className={clsx(
        "card p-3 border-l-4",
        tuvoBots ? "border-l-azul-criollo/70" : "border-l-dorado"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-wider text-text-dim font-bold">
          {fechaStr} · {partida.modo === "2v2" ? "Parejas" : "Mano a mano"}
          {minutos > 0 && ` · ${minutos} min`}
        </div>
        {tuvoBots && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-azul-criollo/20 text-azul-claro font-bold">
            con bots
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <EquipoLado jugadores={equipo0} ganador={ganador === 0} alineacion="izq" />
        <div className="text-text-dim text-[10px] font-bold">VS</div>
        <EquipoLado jugadores={equipo1} ganador={ganador === 1} alineacion="der" />
      </div>
    </div>
  );
}

function EquipoLado({
  jugadores,
  ganador,
  alineacion
}: {
  jugadores: JugadorPartida[];
  ganador: boolean;
  alineacion: "izq" | "der";
}) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-1",
        alineacion === "der" ? "items-end" : "items-start"
      )}
    >
      {jugadores.map((j) => (
        <div
          key={`${j.asiento}-${j.nombre}`}
          className={clsx(
            "flex items-center gap-1.5",
            alineacion === "der" && "flex-row-reverse"
          )}
        >
          <img
            src={urlPersonaje(j.personaje)}
            alt={j.nombre}
            className={clsx(
              "w-7 h-7 rounded-full object-cover object-top border-2",
              ganador ? "border-dorado" : "border-border opacity-60",
              j.es_bot && "grayscale"
            )}
          />
          <div
            className={clsx(
              "leading-tight",
              alineacion === "der" ? "text-right" : "text-left"
            )}
          >
            <div
              className={clsx(
                "text-xs font-bold truncate max-w-[7rem]",
                ganador ? "text-crema" : "text-text-dim"
              )}
            >
              {j.nombre}
              {j.es_bot && (
                <span className="ml-1 text-[8px] text-text-dim/60 font-normal">
                  bot
                </span>
              )}
            </div>
            <div className="text-[10px] text-text-dim">{j.puntos} pts</div>
          </div>
        </div>
      ))}
      {ganador && (
        <div
          className={clsx(
            "text-[10px] font-bold text-dorado uppercase tracking-wider mt-0.5",
            alineacion === "der" ? "self-end" : "self-start"
          )}
        >
          🏆 Ganó
        </div>
      )}
    </div>
  );
}
