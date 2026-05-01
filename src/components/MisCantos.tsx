"use client";
// Modal "Mis cantos": el jugador puede grabar su voz para cada canto.
// Las grabaciones quedan guardadas en IndexedDB asociadas a su slug
// (personaje), así son persistentes entre sesiones del mismo primo.
// Cuando ese jugador canta en partida, su audio personalizado se
// reproduce localmente y se broadcastea al resto por el chat.
import { useEffect, useRef, useState } from "react";
import {
  CANTOS_CON_AUDIO,
  CantoConAudio,
  borrarAudio,
  guardarAudio,
  leerAudio,
  listarCantosConAudio
} from "@/lib/audiosLocales";

const DURACION_MAX_MS = 4000;
const MIME_PREF = "audio/webm;codecs=opus";

export function MisCantos({
  miSlug,
  onCerrar
}: {
  miSlug: string;
  onCerrar: () => void;
}) {
  const [grabados, setGrabados] = useState<Set<CantoConAudio>>(new Set());
  const [grabandoCanto, setGrabandoCanto] = useState<CantoConAudio | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [reproduciendo, setReproduciendo] = useState<CantoConAudio | null>(
    null
  );
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimeoutRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const refrescarGrabados = async () => {
    try {
      setGrabados(await listarCantosConAudio(miSlug));
    } catch {
      /* sin permiso de IDB → ignoramos */
    }
  };

  useEffect(() => {
    refrescarGrabados();
    return () => {
      if (stopTimeoutRef.current !== null)
        window.clearTimeout(stopTimeoutRef.current);
      if (recRef.current && recRef.current.state !== "inactive") {
        try {
          recRef.current.stop();
        } catch {
          /* ignore */
        }
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miSlug]);

  const empezarGrabacion = async (canto: CantoConAudio) => {
    if (grabandoCanto) return;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      setError(
        e instanceof Error
          ? `No se pudo acceder al micrófono: ${e.message}`
          : "No se pudo acceder al micrófono"
      );
      return;
    }
    const opciones: MediaRecorderOptions = {};
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(MIME_PREF))
      opciones.mimeType = MIME_PREF;
    const rec = new MediaRecorder(stream, opciones);
    chunksRef.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      chunksRef.current = [];
      setGrabandoCanto(null);
      if (blob.size === 0) {
        setError("La grabación quedó vacía.");
        return;
      }
      try {
        await guardarAudio(miSlug, canto, blob);
        await refrescarGrabados();
      } catch (e) {
        setError(
          e instanceof Error ? `No se pudo guardar: ${e.message}` : "Error al guardar"
        );
      }
    };
    recRef.current = rec;
    setGrabandoCanto(canto);
    rec.start();
    // Frenamos automáticamente a los DURACION_MAX_MS para evitar audios
    // largos que después no entren por el chat.
    stopTimeoutRef.current = window.setTimeout(() => {
      if (rec.state !== "inactive") rec.stop();
    }, DURACION_MAX_MS);
  };

  const frenarGrabacion = () => {
    if (stopTimeoutRef.current !== null) {
      window.clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const reproducir = async (canto: CantoConAudio) => {
    setError(null);
    try {
      const blob = await leerAudio(miSlug, canto);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setReproduciendo(canto);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setReproduciendo((c) => (c === canto ? null : c));
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        setReproduciendo(null);
        setError("No se pudo reproducir el audio.");
      };
      await audio.play();
    } catch (e) {
      setError(
        e instanceof Error ? `Error al reproducir: ${e.message}` : "Error al reproducir"
      );
    }
  };

  const borrar = async (canto: CantoConAudio) => {
    try {
      await borrarAudio(miSlug, canto);
      await refrescarGrabados();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sheet-bg"
      onClick={onCerrar}
    >
      <div
        className="card p-4 w-full max-w-md max-h-[90vh] overflow-y-auto border-l-4 border-l-dorado"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-3">
          <div className="titulo-marca text-xl">
            Mis <span className="acento">cantos</span>
          </div>
          <p className="text-xs text-text-dim mt-1 subtitulo-claim">
            Grabá tu voz — la van a escuchar todos cuando cantes.
          </p>
          <p className="text-[10px] text-text-dim/70 mt-1">
            Máx. {DURACION_MAX_MS / 1000}s · queda guardado en este dispositivo
          </p>
        </div>

        {error && (
          <div className="text-red text-xs text-center font-bold mb-2">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          {CANTOS_CON_AUDIO.map(({ canto, label }) => {
            const tieneAudio = grabados.has(canto);
            const estaGrabando = grabandoCanto === canto;
            const otroGrabando = grabandoCanto && !estaGrabando;
            const estaReproduciendo = reproduciendo === canto;
            return (
              <div
                key={canto}
                className="flex items-center gap-2 px-2 py-1.5 rounded border border-border bg-surface/40"
              >
                <span className="flex-1 font-display text-sm">{label}</span>
                {tieneAudio && (
                  <button
                    type="button"
                    onClick={() => reproducir(canto)}
                    disabled={!!grabandoCanto || !!reproduciendo}
                    className="btn btn-ghost !px-2 !py-1 !min-h-0 text-[10px]"
                    title="Escuchar"
                    aria-label={`Escuchar ${label}`}
                  >
                    {estaReproduciendo ? "▶︎ ..." : "▶︎"}
                  </button>
                )}
                {tieneAudio && (
                  <button
                    type="button"
                    onClick={() => borrar(canto)}
                    disabled={!!grabandoCanto}
                    className="btn btn-ghost !px-2 !py-1 !min-h-0 text-[10px]"
                    title="Borrar"
                    aria-label={`Borrar ${label}`}
                  >
                    ✕
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    estaGrabando ? frenarGrabacion() : empezarGrabacion(canto)
                  }
                  disabled={!!otroGrabando}
                  className={`btn !px-3 !py-1.5 !min-h-0 text-xs ${
                    estaGrabando
                      ? "!border-red !text-red parpadeo"
                      : tieneAudio
                        ? ""
                        : "!border-dorado !text-dorado"
                  }`}
                >
                  {estaGrabando
                    ? "■ Frenar"
                    : tieneAudio
                      ? "Regrabar"
                      : "● Grabar"}
                </button>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onCerrar}
          className="btn w-full mt-4"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
