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

// Estado externo para esconder el UI del player desde otros componentes
// (por ejemplo, en la pantalla de espera de sala donde el player se
// superpone con el botón de Compartir). El audio sigue corriendo, solo
// se oculta el botón.
let uiOculto = false;
const subsUiOculto = new Set<() => void>();
export function setMusicaUIOculta(oculto: boolean) {
  uiOculto = oculto;
  subsUiOculto.forEach((fn) => fn());
}
function useMusicaUIOculta(): boolean {
  const [, set] = useState(0);
  useEffect(() => {
    const fn = () => set((n) => n + 1);
    subsUiOculto.add(fn);
    return () => {
      subsUiOculto.delete(fn);
    };
  }, []);
  return uiOculto;
}

interface Estado {
  silenciado: boolean;
  volumen: number;
}

function leerEstado(): Estado {
  if (typeof window === "undefined") {
    return { silenciado: true, volumen: VOLUMEN_DEFAULT };
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
    return { silenciado: true, volumen: VOLUMEN_DEFAULT };
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
    silenciado: true,
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

  // Crear Howl SÓLO cuando hay música activa (no silenciado). Cuando el
  // usuario silencia, hacemos unload() completo: el `<audio>` element sale
  // del DOM y iOS suelta la sesión de audio, así otras apps (Spotify,
  // YouTube, etc.) recuperan su volumen normal. Si quedaba `pause()` la
  // sesión se quedaba colgada y bajaba el volumen ajeno hasta cerrar la
  // pestaña.
  useEffect(() => {
    if (estado.silenciado) return;
    if (pistas.length === 0 || actualIdx < 0) return;
    const pista = pistas[actualIdx % pistas.length];
    const h = new Howl({
      src: [`/audio/musica/${encodeURIComponent(pista)}`],
      volume: estado.volumen,
      html5: true, // streamea archivos largos
      onend: () => {
        setActualIdx((a) => indiceRandom(pistas.length, a));
      },
      onplayerror: () => {
        // Browser bloqueó el play (típico en iOS antes del primer gesto).
        // Reintentamos en el próximo unlock event.
        h.once("unlock", () => {
          if (!estado.silenciado) h.play();
        });
      },
      onloaderror: () => {
        setActualIdx((a) => indiceRandom(pistas.length, a));
      }
    });
    howlRef.current = h;

    // Intento 1: arrancar de una (desktop sin restricciones).
    h.play();

    // Intento 2: si el browser bloquea, esperamos al primer gesto del
    // usuario (iOS / Chrome móvil) y disparamos play() ahí mismo. Tiene
    // que ejecutarse SÍNCRONAMENTE dentro del handler para que cuente
    // como "user gesture" en iOS.
    const arrancarConGesto = () => {
      if (h.playing()) return;
      h.play();
    };
    window.addEventListener("touchstart", arrancarConGesto, {
      once: true,
      passive: true
    });
    window.addEventListener("click", arrancarConGesto, { once: true });

    return () => {
      window.removeEventListener("touchstart", arrancarConGesto);
      window.removeEventListener("click", arrancarConGesto);
      h.stop();
      h.unload();
      if (howlRef.current === h) howlRef.current = null;
    };
    // El volumen se aplica en otro effect sin recrear el Howl.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pistas, actualIdx, estado.silenciado]);

  // Cambios de volumen — sin tocar el Howl si está silenciado (no existe).
  useEffect(() => {
    const h = howlRef.current;
    if (h) h.volume(estado.volumen);
  }, [estado.volumen]);

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

  const ocultoExterno = useMusicaUIOculta();
  if (!hidratado || pistas.length === 0 || ocultoExterno) return null;

  // Único UI: un botón compacto fijo arriba a la derecha (en partida) o
  // abajo a la izquierda (en home). Solo togglea silencio. Antes había
  // skip y volumen — los sacamos para no ensuciar el header. El volumen
  // queda en su default y el skip se puede agregar más adelante si se
  // pide.
  const claseFija = enPartida
    ? "fixed top-1.5 right-2 z-50"
    : "fixed bottom-2 left-2 z-50";
  return (
    <button
      type="button"
      onClick={() => setEstado({ silenciado: !estado.silenciado })}
      className={`${claseFija} w-9 h-9 rounded-full bg-surface/80 backdrop-blur-sm border border-border hover:bg-surface-2 flex items-center justify-center transition shadow-lg`}
      title={estado.silenciado ? "Activar música" : "Silenciar música"}
      aria-label={estado.silenciado ? "Activar música" : "Silenciar música"}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`w-4 h-4 ${estado.silenciado ? "text-text-dim" : "text-dorado"}`}
        aria-hidden
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
        {estado.silenciado && <line x1="3" y1="3" x2="21" y2="21" />}
      </svg>
    </button>
  );
}
