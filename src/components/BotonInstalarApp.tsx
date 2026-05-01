"use client";
// Botón "Instalar como app". Lógica multi-plataforma:
//  - Android (Chrome/Edge): el navegador dispara `beforeinstallprompt`
//    cuando la PWA cumple los criterios (manifest, https, etc.). Lo
//    capturamos y al click llamamos prompt() — el OS muestra el sheet
//    nativo de "Agregar a inicio".
//  - iOS (Safari): no hay API programática. Mostramos un mini-modal
//    con el paso a paso (botón Compartir → "Agregar a pantalla de
//    inicio").
//  - Si la app ya corre en standalone (instalada), ocultamos el botón.
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function esIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad reciente reporta MacIntel + maxTouchPoints — chequeamos ambas.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function yaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  // display-mode: standalone es lo que indica que se abrió desde el ícono.
  // navigator.standalone es el legacy de iOS Safari.
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function BotonInstalarApp() {
  const [promptEvt, setPromptEvt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [instalada, setInstalada] = useState(false);
  const [esIOSState, setEsIOSState] = useState(false);
  const [mostrarTipsIOS, setMostrarTipsIOS] = useState(false);

  useEffect(() => {
    setInstalada(yaInstalada());
    setEsIOSState(esIOS());

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvt(null);
      setInstalada(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (instalada) return null;
  // Mostramos siempre el botón (excepto si la app ya está instalada).
  // En navegadores que no soportan instalación (desktop Firefox, etc.)
  // hacemos fallback a las instrucciones de iOS — son lo más cercano
  // a "agregar a inicio" que tiene el usuario disponible.

  const onClick = async () => {
    if (promptEvt) {
      await promptEvt.prompt();
      const choice = await promptEvt.userChoice;
      if (choice.outcome === "accepted") setInstalada(true);
      setPromptEvt(null);
      return;
    }
    // Sin prompt API (iOS Safari + desktop sin support): mostramos
    // las instrucciones del menú compartir.
    setMostrarTipsIOS(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-text-dim hover:text-dorado transition text-xs subtitulo-claim"
        aria-label="Instalar como aplicación"
      >
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
          <path d="M12 3v12" />
          <polyline points="7 10 12 15 17 10" />
          <path d="M5 21h14" />
        </svg>
        <span>Instalar app</span>
      </button>
      {mostrarTipsIOS && (
        <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-4 sheet-bg"
          onClick={() => setMostrarTipsIOS(false)}
        >
          <div
            className="card p-4 max-w-sm w-full border-l-4 border-l-dorado"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-3">
              <div className="titulo-marca text-lg">
                Instalar la <span className="acento">app</span>
              </div>
              <p className="text-xs text-text-dim mt-1 subtitulo-claim">
                {esIOSState
                  ? "Safari no permite instalar con un click — pero es fácil:"
                  : "Tu navegador no muestra el prompt de instalación. Probá desde el menú:"}
              </p>
            </div>
            <ol className="text-sm text-crema space-y-2 my-4 list-decimal list-inside">
              {esIOSState ? (
                <>
                  <li>
                    Tocá el botón <strong className="text-dorado">Compartir</strong>{" "}
                    <span aria-hidden>⬆️</span> en la barra de Safari.
                  </li>
                  <li>
                    Bajá hasta{" "}
                    <strong className="text-dorado">
                      &ldquo;Agregar a pantalla de inicio&rdquo;
                    </strong>
                    .
                  </li>
                  <li>
                    Confirmá con <strong className="text-dorado">Agregar</strong>.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Abrí el menú del navegador (los <strong className="text-dorado">⋮</strong>{" "}
                    arriba a la derecha).
                  </li>
                  <li>
                    Buscá{" "}
                    <strong className="text-dorado">
                      &ldquo;Instalar app&rdquo;
                    </strong>{" "}
                    o{" "}
                    <strong className="text-dorado">
                      &ldquo;Agregar a pantalla de inicio&rdquo;
                    </strong>
                    .
                  </li>
                  <li>Confirmá y listo — queda como app nativa.</li>
                </>
              )}
            </ol>
            <button
              type="button"
              onClick={() => setMostrarTipsIOS(false)}
              className="btn w-full"
            >
              Listo
            </button>
          </div>
        </div>
      )}
    </>
  );
}
