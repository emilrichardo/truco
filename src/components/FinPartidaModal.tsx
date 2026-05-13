"use client";
import { useState, type ReactNode } from "react";
import type {
  Equipo,
  EstadoEnvido,
  EstadoJuego,
  Mano
} from "@/lib/truco/types";

export function FinPartidaModal({
  estado,
  miId,
  acciones
}: {
  estado: EstadoJuego;
  miId: string;
  acciones: ReactNode;
}) {
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const equipoGanador = estado.ganadorPartida ?? 0;
  const miEquipo = estado.jugadores.find((j) => j.id === miId)?.equipo;
  const soyJugador = miEquipo !== undefined;
  const yoGane = miEquipo === equipoGanador;
  const es1v1 = estado.jugadores.length === 2;
  const ganadores = estado.jugadores
    .filter((j) => j.equipo === equipoGanador)
    .map((j) => j.nombre);
  const titulo = !soyJugador
    ? "Partida terminada"
    : es1v1
      ? yoGane
        ? "¡Ganaste!"
        : "Perdiste"
      : yoGane
        ? "¡Ganamos!"
        : "Perdieron";
  const subtitulo =
    ganadores.length > 1
      ? `Ganaron ${ganadores.slice(0, -1).join(", ")} y ${ganadores[ganadores.length - 1]}`
      : `Ganó ${ganadores[0]}`;

  return (
    <div className="absolute inset-0 sheet-bg flex items-center justify-center z-[1000] p-4 overflow-y-auto">
      <div className="papel p-5 text-center max-w-sm w-full my-4 max-h-[calc(100dvh-2rem)] overflow-y-auto">
        {yoGane && <div className="text-5xl mb-2">🏆</div>}
        <div
          className="titulo-marca text-2xl mb-2"
          style={{
            color: "var(--carbon)",
            textShadow: "1px 1px 0 rgba(217,164,65,0.5)"
          }}
        >
          {titulo}
        </div>
        <p
          className="text-sm mb-4 subtitulo-claim"
          style={{ color: "var(--madera-oscura)" }}
        >
          {subtitulo}
        </p>

        <button
          type="button"
          onClick={() => setMostrarResumen((v) => !v)}
          className="btn btn-madera w-full mb-3"
        >
          {mostrarResumen ? "Ocultar resumen" : "Ver resumen"}
        </button>

        {mostrarResumen && (
          <ResumenPartida estado={estado} miEquipo={miEquipo} />
        )}

        <div className="flex flex-col gap-2 mt-3">{acciones}</div>
      </div>
    </div>
  );
}

function ResumenPartida({
  estado,
  miEquipo
}: {
  estado: EstadoJuego;
  miEquipo: Equipo | undefined;
}) {
  const equipoGanador = estado.ganadorPartida ?? 0;
  const equipoPerdedor = equipoGanador === 0 ? 1 : 0;
  const manos = manosDePartida(estado);
  const eventos = manos.flatMap((mano) => mano.puntosOtorgados);
  const ultimoEvento = eventos[eventos.length - 1] ?? null;
  const manoCierre = manos[manos.length - 1] ?? null;
  const cierrePorEnvido =
    !!ultimoEvento && /envido/i.test(ultimoEvento.motivo);
  const envidoCierre = cierrePorEnvido
    ? manoCierre?.envidoResolucion ?? null
    : null;
  const puntosPorTipo = eventos.reduce(
    (acc, ev) => {
      const bucket = /envido/i.test(ev.motivo) ? acc.envido : acc.truco;
      bucket[ev.equipo] += ev.puntos;
      return acc;
    },
    {
      envido: [0, 0] as [number, number],
      truco: [0, 0] as [number, number]
    }
  );

  return (
    <div
      className="text-left rounded border p-3 mb-3"
      style={{
        borderColor: "rgba(61,39,21,0.22)",
        background: "rgba(255,255,255,0.16)"
      }}
    >
      <div
        className="label-slim mb-2"
        style={{ color: "var(--madera-oscura)" }}
      >
        Resumen del partido
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 mb-3">
        <EquipoScore
          titulo={nombreEquipo(estado, equipoGanador, miEquipo)}
          puntos={estado.puntos[equipoGanador]}
          destacado
        />
        <span
          className="font-display text-lg"
          style={{ color: "var(--madera-oscura)" }}
        >
          vs
        </span>
        <EquipoScore
          titulo={nombreEquipo(estado, equipoPerdedor, miEquipo)}
          puntos={estado.puntos[equipoPerdedor]}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-3">
        <DatoResumen label="Manos" valor={String(manos.length)} />
        <DatoResumen label="Objetivo" valor={String(estado.puntosObjetivo)} />
        <DatoResumen
          label="Cierre"
          valor={ultimoEvento ? motivoCorto(ultimoEvento.motivo) : "Partida"}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <DesglosePuntos
          titulo="Envido"
          puntos={puntosPorTipo.envido}
          estado={estado}
          miEquipo={miEquipo}
        />
        <DesglosePuntos
          titulo="Truco"
          puntos={puntosPorTipo.truco}
          estado={estado}
          miEquipo={miEquipo}
        />
      </div>

      {envidoCierre && (
        <DetalleEnvidoCierre
          estado={estado}
          miEquipo={miEquipo}
          ganador={envidoCierre.ganadorEquipo}
          perdedor={envidoCierre.ganadorEquipo === 0 ? 1 : 0}
          tipo={envidoCierre.tipo}
          querido={envidoCierre.querido}
          puntosGanados={envidoCierre.puntos}
          puntosEquipo={envidoCierre.puntosEquipo}
        />
      )}
    </div>
  );
}

function EquipoScore({
  titulo,
  puntos,
  destacado = false
}: {
  titulo: string;
  puntos: number;
  destacado?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div
        className="text-[10px] uppercase tracking-wider font-bold truncate"
        style={{ color: "var(--madera-oscura)" }}
      >
        {titulo}
      </div>
      <div
        className="font-display text-3xl leading-none"
        style={{
          color: destacado ? "var(--dorado-oscuro)" : "var(--carbon)"
        }}
      >
        {puntos}
      </div>
    </div>
  );
}

function DatoResumen({ label, valor }: { label: string; valor: string }) {
  return (
    <div
      className="rounded px-2 py-1.5"
      style={{ background: "rgba(61,39,21,0.1)" }}
    >
      <div
        className="text-[9px] uppercase tracking-wider font-bold"
        style={{ color: "var(--madera-oscura)" }}
      >
        {label}
      </div>
      <div className="font-display text-base leading-tight truncate">
        {valor}
      </div>
    </div>
  );
}

function DesglosePuntos({
  titulo,
  puntos,
  estado,
  miEquipo
}: {
  titulo: string;
  puntos: [number, number];
  estado: EstadoJuego;
  miEquipo: Equipo | undefined;
}) {
  return (
    <div
      className="rounded p-2"
      style={{ background: "rgba(61,39,21,0.1)" }}
    >
      <div
        className="text-[9px] uppercase tracking-wider font-bold mb-1"
        style={{ color: "var(--madera-oscura)" }}
      >
        {titulo}
      </div>
      {[0, 1].map((eq) => (
        <div
          key={eq}
          className="flex items-center justify-between gap-2 text-xs"
          style={{ color: "var(--carbon)" }}
        >
          <span className="truncate">
            {nombreEquipo(estado, eq as Equipo, miEquipo)}
          </span>
          <span className="font-bold tabular-nums">{puntos[eq]}</span>
        </div>
      ))}
    </div>
  );
}

function DetalleEnvidoCierre({
  estado,
  miEquipo,
  ganador,
  perdedor,
  tipo,
  querido,
  puntosGanados,
  puntosEquipo
}: {
  estado: EstadoJuego;
  miEquipo: Equipo | undefined;
  ganador: Equipo;
  perdedor: Equipo;
  tipo: EstadoEnvido | undefined;
  querido: boolean | undefined;
  puntosGanados: number;
  puntosEquipo: [number, number] | undefined;
}) {
  return (
    <div
      className="rounded border p-2"
      style={{
        borderColor: "rgba(217,164,65,0.5)",
        background: "rgba(217,164,65,0.14)"
      }}
    >
      <div
        className="text-[9px] uppercase tracking-wider font-bold mb-1"
        style={{ color: "var(--madera-oscura)" }}
      >
        Cierre por {nombreEnvido(tipo)} {querido === false ? "no querido" : ""}
      </div>
      <div
        className="text-xs leading-relaxed"
        style={{ color: "var(--carbon)" }}
      >
        <div className="flex justify-between gap-2">
          <span>{nombreEquipo(estado, ganador, miEquipo)} sumó</span>
          <strong className="tabular-nums">+{puntosGanados}</strong>
        </div>
        {puntosEquipo ? (
          <>
            <div className="flex justify-between gap-2">
              <span>Tantos ganador</span>
              <strong className="tabular-nums">{puntosEquipo[ganador]}</strong>
            </div>
            <div className="flex justify-between gap-2">
              <span>Tantos perdedor</span>
              <strong className="tabular-nums">{puntosEquipo[perdedor]}</strong>
            </div>
          </>
        ) : (
          <div className="text-[11px] opacity-80">
            No se mostraron tantos porque el canto no fue querido.
          </div>
        )}
      </div>
    </div>
  );
}

function manosDePartida(estado: EstadoJuego): Mano[] {
  const manos = [...estado.historialManos];
  if (estado.manoActual) {
    const yaEsta = manos.some((m) => m.numero === estado.manoActual?.numero);
    if (!yaEsta) manos.push(estado.manoActual);
  }
  return manos;
}

function nombreEquipo(
  estado: EstadoJuego,
  equipo: Equipo,
  miEquipo: Equipo | undefined
): string {
  if (estado.jugadores.length === 2) {
    return (
      estado.jugadores.find((j) => j.equipo === equipo)?.nombre ??
      `Equipo ${equipo + 1}`
    );
  }
  if (miEquipo !== undefined) return equipo === miEquipo ? "Nos" : "Ellos";
  return `Equipo ${equipo + 1}`;
}

function nombreEnvido(tipo: EstadoEnvido | undefined): string {
  if (tipo === "falta_envido") return "falta envido";
  if (tipo === "real_envido") return "real envido";
  return "envido";
}

function motivoCorto(motivo: string): string {
  return motivo.replace(/\s*\(\+\d+\)\s*$/, "");
}
