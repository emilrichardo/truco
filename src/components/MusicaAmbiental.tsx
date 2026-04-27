"use client";
// Reproductor de música ambiental. Lee las pistas de /api/musica (un GET
// que lista los MP3 de /public/audio/musica/) y las pasa una atrás de la
// otra a volumen bajo. Vive en el layout root, así sobrevive a la
// navegación entre páginas y el usuario lo controla desde una sola UI.
//
// UX:
// - Botón flotante en bottom-left con 🎵 / 🔇.
// - Click toggleá silenciar/reproducir.
// - Slider de volumen al lado (0-50%).
// - Estado persistido en localStorage para que el usuario no tenga que
//   pulsar mute en cada partida.
//
// Política de autoplay del browser: hasta que el usuario interactúe (un
// click cualquiera), el AudioContext está suspendido y la música no arranca.
// Escuchamos el primer click/touch para "desbloquear".
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Howl } from "howler";

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

export function MusicaAmbiental() {
  const pathname = usePathname();
  // En partida (solo o sala) lo ponemos arriba a la derecha — donde antes
  // estaba el botón de chat. En el resto de la app, abajo a la izquierda.
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
  const [arrancada, setArrancada] = useState(false);
  const [actualIdx, setActualIdx] = useState(0);
  const howlRef = useRef<Howl | null>(null);

  // Cargar preferencias guardadas (cliente sólo).
  useEffect(() => {
    setEstadoLocal(leerEstado());
    setHidratado(true);
  }, []);

  // Cargar lista de pistas.
  useEffect(() => {
    let vivo = true;
    fetch("/api/musica")
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        if (Array.isArray(d.pistas)) setPistas(d.pistas);
      })
      .catch(() => {
        /* sin red, sin música */
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Desbloquear audio en la primera interacción del usuario.
  useEffect(() => {
    const desbloquear = () => {
      setArrancada(true);
      window.removeEventListener("click", desbloquear);
      window.removeEventListener("touchstart", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
    window.addEventListener("click", desbloquear);
    window.addEventListener("touchstart", desbloquear);
    window.addEventListener("keydown", desbloquear);
    return () => {
      window.removeEventListener("click", desbloquear);
      window.removeEventListener("touchstart", desbloquear);
      window.removeEventListener("keydown", desbloquear);
    };
  }, []);

  // Crear/reemplazar la pista actual.
  useEffect(() => {
    if (!arrancada || pistas.length === 0) return;
    const pista = pistas[actualIdx % pistas.length];
    const h = new Howl({
      src: [`/audio/musica/${encodeURIComponent(pista)}`],
      volume: estado.silenciado ? 0 : estado.volumen,
      html5: true, // streamea archivos largos en vez de bajarlos enteros
      autoplay: true,
      onend: () => {
        setActualIdx((a) => (a + 1) % pistas.length);
      }
    });
    howlRef.current = h;

    return () => {
      h.stop();
      h.unload();
      if (howlRef.current === h) howlRef.current = null;
    };
    // estado.silenciado / estado.volumen se aplican en otro useEffect para
    // no recrear el Howl en cada cambio de volumen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrancada, pistas, actualIdx]);

  // Aplicar cambios de silenciar/volumen sin recrear el Howl.
  useEffect(() => {
    const h = howlRef.current;
    if (!h) return;
    if (estado.silenciado) {
      h.pause();
    } else {
      h.volume(estado.volumen);
      if (!h.playing()) h.play();
    }
  }, [estado.silenciado, estado.volumen]);

  const setEstado = (parc: Partial<Estado>) => {
    setEstadoLocal((prev) => {
      const next = { ...prev, ...parc };
      guardarEstado(next);
      return next;
    });
  };

  // Mientras no esté hidratado, no mostramos UI (evita mismatch SSR).
  // Si no hay pistas en la carpeta, tampoco mostramos nada.
  if (!hidratado || pistas.length === 0) return null;

  return (
    <div
      className={
        enPartida
          ? "fixed top-1.5 right-2 z-50 flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm border border-border rounded-full pl-1 pr-2 py-0.5 shadow-lg"
          : "fixed bottom-2 left-2 z-50 flex items-center gap-1.5 bg-surface/80 backdrop-blur-sm border border-border rounded-full pl-1 pr-2 py-0.5 shadow-lg"
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
        className="w-7 h-7 rounded-full hover:bg-surface-2 flex items-center justify-center text-base transition leading-none"
        title={estado.silenciado ? "Activar música" : "Silenciar música"}
        aria-label={estado.silenciado ? "Activar música" : "Silenciar música"}
      >
        {estado.silenciado ? "🔇" : "🎵"}
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
            // mover el slider implícitamente reactiva la música
            silenciado: false
          })
        }
        className="w-16 accent-[var(--dorado)] cursor-pointer"
        title={`Volumen: ${Math.round(estado.volumen * 100)}%`}
        aria-label="Volumen de música ambiental"
      />
    </div>
  );
}
