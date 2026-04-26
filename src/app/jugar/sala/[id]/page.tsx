"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getSocket, guardarSesion, leerSesion } from "@/lib/socket";
import type { Accion, EstadoJuego } from "@/lib/truco/types";
import { Mesa } from "@/components/Mesa";
import { Fosforos } from "@/components/Fosforos";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { Anuncios } from "@/components/Anuncios";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";

export default function SalaPage() {
  const params = useParams<{ id: string }>();
  const salaId = params.id;
  const [estado, setEstado] = useState<EstadoJuego | null>(null);
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unirseForm, setUnirseForm] = useState<{
    nombre: string;
    personaje: string;
    asiento?: number;
  }>({
    nombre: "",
    personaje: "hugui"
  });
  const [linkCopiado, setLinkCopiado] = useState(false);

  // Restaurar sesión local si existe.
  useEffect(() => {
    const s = leerSesion(salaId);
    if (s) setMiId(s.jugadorId);
  }, [salaId]);

  // Conectar socket y suscribir.
  useEffect(() => {
    const sock = getSocket();
    const onEstado = (e: EstadoJuego) => setEstado(e);
    const onError = (msg: string) => setError(msg);
    sock.on("estado", onEstado);
    sock.on("estado_error", onError);
    sock.on("accion_error", onError);

    if (miId) {
      sock.emit("reconectar", { salaId, jugadorId: miId });
    }
    return () => {
      sock.off("estado", onEstado);
      sock.off("estado_error", onError);
      sock.off("accion_error", onError);
    };
  }, [salaId, miId]);

  const ocupadosPorPersonaje = useMemo(
    () => estado?.jugadores.map((j) => j.personaje) ?? [],
    [estado]
  );

  const unirme = useCallback(() => {
    const sock = getSocket();
    sock.emit(
      "unirse_sala",
      {
        salaId,
        nombre: unirseForm.nombre || "Primo",
        personaje: unirseForm.personaje,
        asientoPreferido: unirseForm.asiento
      },
      (resp: { ok: boolean; jugadorId?: string; error?: string }) => {
        if (!resp.ok) return setError(resp.error || "No se pudo entrar.");
        if (resp.jugadorId) {
          setMiId(resp.jugadorId);
          guardarSesion({ salaId, jugadorId: resp.jugadorId });
        }
      }
    );
  }, [salaId, unirseForm]);

  const enviarAccion = useCallback(
    (a: Accion) => {
      if (!miId) return;
      const sock = getSocket();
      sock.emit("accion", { salaId, jugadorId: miId, accion: a });
    },
    [salaId, miId]
  );

  const enviarChat = useCallback(
    (m: { texto?: string; reaccion?: string }) => {
      if (!miId) return;
      const sock = getSocket();
      sock.emit("chat", { salaId, jugadorId: miId, ...m });
    },
    [salaId, miId]
  );

  const iniciar = useCallback(() => {
    const sock = getSocket();
    sock.emit("iniciar_partida", { salaId });
  }, [salaId]);

  const compartirLink = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/jugar/sala/${salaId}`;
    navigator.clipboard.writeText(url);
    setLinkCopiado(true);
    setTimeout(() => setLinkCopiado(false), 2000);
  }, [salaId]);

  if (!estado) {
    return (
      <main className="p-6 text-center">
        <div className="parpadeo">Conectando con la sala…</div>
        <div className="text-cream/40 text-xs mt-2">Sala #{salaId}</div>
      </main>
    );
  }

  const yaSoyJugador = miId && estado.jugadores.some((j) => j.id === miId);
  const total = estado.modo === "2v2" ? 4 : 2;
  const faltan = total - estado.jugadores.length;
  const meEnCurso = estado.iniciada && yaSoyJugador;

  return (
    <main className="min-h-screen px-3 py-4 max-w-6xl mx-auto">
      <header className="flex flex-wrap items-center gap-3 justify-between mb-4">
        <div>
          <Link href="/" className="label-slim hover:text-truco-gold">
            ← Volver
          </Link>
          <h1 className="font-display text-2xl text-truco-gold">
            Sala #{salaId}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={compartirLink} className="btn">
            {linkCopiado ? "¡Link copiado!" : "Copiar link"}
          </button>
          {!estado.iniciada && yaSoyJugador && (
            <button onClick={iniciar} className="btn btn-primary">
              Iniciar partida {faltan > 0 ? `(faltan ${faltan}, completa con bots)` : ""}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-truco-red/30 border border-truco-red text-cream rounded p-2 mb-3 text-sm text-center">
          {error}
        </div>
      )}

      {!yaSoyJugador && !estado.iniciada && (
        <UnirsePanel
          estado={estado}
          form={unirseForm}
          setForm={setUnirseForm}
          ocupadosPersonajes={ocupadosPorPersonaje}
          onUnirse={unirme}
        />
      )}
      {!yaSoyJugador && estado.iniciada && (
        <div className="text-center text-cream/70 italic py-10">
          La partida ya empezó. Esperá la próxima.
        </div>
      )}

      {yaSoyJugador && (
        <>
          <div className="flex flex-wrap justify-center gap-3 mb-3">
            <Fosforos
              puntos={estado.puntos[0]}
              objetivo={estado.puntosObjetivo}
              etiqueta="Equipo 1"
              destacado={estado.jugadores.find((j) => j.id === miId)?.equipo === 0}
            />
            <Fosforos
              puntos={estado.puntos[1]}
              objetivo={estado.puntosObjetivo}
              etiqueta="Equipo 2"
              destacado={estado.jugadores.find((j) => j.id === miId)?.equipo === 1}
            />
          </div>

          <div className="relative">
            <Anuncios estado={estado} />
            <Mesa estado={estado} miId={miId!} />
          </div>

          {meEnCurso && <PanelAcciones estado={estado} miId={miId!} enviar={enviarAccion} />}

          {estado.ganadorPartida !== null && (
            <div className="text-center mt-4 font-display text-3xl text-truco-gold">
              🏆 ¡Equipo {estado.ganadorPartida + 1} ganó la partida!
            </div>
          )}

          <div className="flex justify-center mt-6">
            <Chat estado={estado} miId={miId!} enviar={enviarChat} />
          </div>
        </>
      )}
    </main>
  );
}

function UnirsePanel({
  estado,
  form,
  setForm,
  ocupadosPersonajes,
  onUnirse
}: {
  estado: EstadoJuego;
  form: { nombre: string; personaje: string; asiento?: number };
  setForm: (
    f: { nombre: string; personaje: string; asiento?: number }
  ) => void;
  ocupadosPersonajes: string[];
  onUnirse: () => void;
}) {
  const total = estado.modo === "2v2" ? 4 : 2;
  const ocupadosAsiento = new Set(estado.jugadores.map((j) => j.asiento));
  return (
    <div className="parchment rounded-xl p-5 max-w-xl mx-auto">
      <h2 className="font-display text-2xl text-truco-dark mb-2">Unirse a la sala</h2>
      <p className="text-truco-dark/70 text-sm mb-4">
        Elegí tu nombre, tu primo y, si querés, tu asiento. Equipos: pares en 0/2,
        impares en 1/3.
      </p>
      <input
        value={form.nombre}
        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        placeholder="Tu nombre"
        className="w-full bg-cream border border-truco-dark/30 rounded px-3 py-2 text-truco-dark mb-3"
        maxLength={24}
      />
      <div className="label-slim mb-1 text-truco-red">Tu primo</div>
      <SelectorPersonaje
        seleccionado={form.personaje}
        ocupados={ocupadosPersonajes}
        onSeleccionar={(slug) => setForm({ ...form, personaje: slug })}
      />
      <div className="label-slim mt-4 mb-1 text-truco-red">Tu asiento</div>
      <div className="flex gap-2 flex-wrap">
        {Array.from({ length: total }).map((_, i) => {
          const ocupado = ocupadosAsiento.has(i);
          const equipo = (i % 2) + 1;
          return (
            <button
              key={i}
              type="button"
              disabled={ocupado}
              onClick={() => setForm({ ...form, asiento: i })}
              className={`btn ${form.asiento === i ? "btn-primary" : ""}`}
            >
              Asiento {i + 1} (Equipo {equipo})
              {ocupado && <span className="ml-1 text-xs">— ocupado</span>}
            </button>
          );
        })}
      </div>
      <button onClick={onUnirse} className="btn btn-primary mt-5 w-full">
        Sentarme a la mesa
      </button>
    </div>
  );
}
