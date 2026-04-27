"use client";
// Reproductor de música ambiental. Lee las pistas de /api/musica (un GET
// que lista los MP3 de /public/audio/musica/) y las pasa al azar, una
// atrás de la otra, en bucle infinito a volumen bajo.
//
// UX:
// - Pill flotante. En partidas (/jugar/solo/partida y /jugar/sala/*) va
//   arriba a la derecha; en el resto, abajo a la izquierda.
// - Botón 🎵 / 🔇 toggleá pausa.
// - Botón ⏭ pasa a la próxima pista al azar.
// - Slider de volumen 0-50%.
// - Estado persistido en localStorage.
//
// Política de autoplay: Howler intenta arrancar el Howl con autoplay; si
// el browser lo bloquea, el primer click en cualquier botón del player
// (o cualquier interacción de la página) lo desbloquea y arranca solo.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Howl, Howler } from "howler";

const STORAGE_KEY = "truco:musica:v1";
const VOLUMEN_DEFAULT = 0.15;

interface Estado {
  silenciado: boolean;
  volumen: number;
}

function leerEstado(): Estado {
  if (typeof window === "undefined") {
    return { silenciado: false, volumen: VOLUMEN_DEFAULT };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { silenciado: false, volumen: VOLUMEN_DEFAULT };
    const p = JSON.parse(raw);
    return {
      silenciado: !!p.silenciado,
      volumen:
        typeof p.volumen === "number" && p.volumen >= 0 && p.volumen <= 1
          ? p.volumen
          : VOLUMEN_DEFAULT
    };
  } catch {
    return { silenciado: false, volumen: VOLUMEN_DEFAULT };
  }
}

function guardarEstado(e: Estado) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(e));
  } catch {
    /* ignorar quota / private mode */
  }
}

function indiceRandom(cantidad: number, prev: number): number {
  if (cantidad <= 1) return 0;
  let n = Math.floor(Math.random() * cantidad);
  if (n === prev) n = (n + 1) % cantidad;
  return n;
}

export function MusicaAmbiental() {
  const pathname = usePathname();
  const enPartida =
    !!pathname &&
    (pathname.startsWith("/jugar/solo/partida") ||
      pathname.startsWith("/jugar/sala/"));
  const [hidratado, setHidratado] = useState(false);
  const [estado, setEstadoLocal] = useState<Estado>({
    silenciado: false,
    volumen: VOLUMEN_DEFAULT
  });
  const [pistas, setPistas] = useState<string[]>([]);
  const [actualIdx, setActualIdx] = useState(-1);
  const howlRef = useRef<Howl | null>(null);

  // Cargar preferencias guardadas (cliente).
  useEffect(() => {
    setEstadoLocal(leerEstado());
    setHidratado(true);
    // Howler: autoUnlock está activo por default, pero lo forzamos por las
    // dudas — es la pieza que destraba el audio en el primer gesto.
    Howler.autoUnlock = true;
  }, []);

  // Cargar lista de pistas. Cuando llegan, elegimos una al azar.
  useEffect(() => {
    let vivo = true;
    fetch("/api/musica")
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (Array.isArray(d.pistas) && d.pistas.length > 0) {
          setPistas(d.pistas);
          setActualIdx(Math.floor(Math.random() * d.pistas.length));
        }
      })
      .catch(() => {
        /* sin red, sin música */
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Crear Howl para la pista actual. autoplay=true delega en Howler la
  // espera del primer gesto del usuario para destrabar.
  useEffect(() => {
    if (pistas.length === 0 || actualIdx < 0) return;
    const pista = pistas[actualIdx % pistas.length];
    const h = new Howl({
      src: [`/audio/musica/${encodeURIComponent(pista)}`],
      volume: estado.volumen,
      html5: true, // streamea archivos largos
      autoplay: !estado.silenciado,
      onend: () => {
        // Próxima pista al azar, distinta a la que acaba de sonar.
        setActualIdx((a) => indiceRandom(pistas.length, a));
      },
      onplayerror: () => {
        // Browser bloqueó el play. Reintentar cuando Howler destrabe.
        h.once("unlock", () => {
          if (!estado.silenciado) h.play();
        });
      },
      onloaderror: () => {
        // Si la pista no carga, saltamos a la siguiente automáticamente.
        setActualIdx((a) => indiceRandom(pistas.length, a));
      }
    });
    howlRef.current = h;

    return () => {
      h.stop();
      h.unload();
      if (howlRef.current === h) howlRef.current = null;
    };
    // No depende de silenciado/volumen — esos se aplican en otro effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pistas, actualIdx]);

  // Aplicar cambios de silenciar/volumen sin recrear el Howl.
  useEffect(() => {
    const h = howlRef.current;
    if (!h) return;
    h.volume(estado.volumen);
    if (estado.silenciado) {
      if (h.playing()) h.pause();
    } else {
      if (!h.playing()) h.play();
    }
  }, [estado.silenciado, estado.volumen]);

  // Pausar al cambiar de pestaña / minimizar y retomar al volver.
  // No tocamos `estado.silenciado` para que la preferencia del usuario se
  // respete: si silenció a mano, no le arrancamos la música al regresar.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      const h = howlRef.current;
      if (!h) return;
      if (document.hidden) {
        if (h.playing()) h.pause();
      } else if (!estado.silenciado && !h.playing()) {
        h.play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [estado.silenciado]);

  const setEstado = (parc: Partial<Estado>) => {
    setEstadoLocal((prev) => {
      const next = { ...prev, ...parc };
      guardarEstado(next);
      return next;
    });
  };

  const cambiarPista = () => {
    if (pistas.length <= 1) return;
    setActualIdx((a) => indiceRandom(pistas.length, a));
    // Si está silenciado y el usuario quiere cambiar de tema, asumimos
    // que también quiere escuchar.
    if (estado.silenciado) setEstado({ silenciado: false });
  };

  if (!hidratado || pistas.length === 0) return null;

  return (
    <div
      className={
        enPartida
          ? "fixed top-1.5 right-2 z-50 flex items-center gap-1 bg-surface/80 backdrop-blur-sm border border-border rounded-full pl-0.5 pr-1.5 py-0.5 shadow-lg"
          : "fixed bottom-2 left-2 z-50 flex items-center gap-1 bg-surface/80 backdrop-blur-sm border border-border rounded-full pl-0.5 pr-1.5 py-0.5 shadow-lg"
      }
      style={
        enPartida
          ? undefined
          : { paddingBottom: "max(0.125rem, env(safe-area-inset-bottom))" }
      }
    >
      <button
        type="button"
        onClick={() => setEstado({ silenciado: !estado.silenciado })}
        className="w-7 h-7 rounded-full hover:bg-surface-2 flex items-center justify-center transition leading-none text-text"
        title={estado.silenciado ? "Activar música" : "Silenciar música"}
        aria-label={estado.silenciado ? "Activar música" : "Silenciar música"}
      >
        {estado.silenciado ? (
          // Speaker mute SVG
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-text-dim"
            aria-hidden
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          // Music note SVG
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 text-dorado"
            aria-hidden
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={cambiarPista}
        disabled={pistas.length <= 1}
        className="w-7 h-7 rounded-full hover:bg-surface-2 flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
        title="Cambiar de tema"
        aria-label="Cambiar de tema"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-4 h-4 text-text-dim"
          aria-hidden
        >
          <polygon points="5 4 15 12 5 20 5 4" />
          <line x1="19" y1="5" x2="19" y2="19" />
        </svg>
      </button>

      <input
        type="range"
        min={0}
        max={0.5}
        step={0.01}
        value={estado.volumen}
        onChange={(e) =>
          setEstado({
            volumen: parseFloat(e.target.value),
            silenciado: false
          })
        }
        className="w-14 accent-[var(--dorado)] cursor-pointer"
        title={`Volumen: ${Math.round(estado.volumen * 100)}%`}
        aria-label="Volumen"
      />
    </div>
  );
}
