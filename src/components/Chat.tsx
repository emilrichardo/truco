"use client";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type {
  CategoriaEvento,
  EstadoJuego,
  MensajeChat
} from "@/lib/truco/types";
import { urlPersonaje } from "@/data/jugadores";
import { ICONOS_COMPANERO, ORDENES_COMPANERO } from "@/lib/chatRapido";

const REACCIONES = ["👏", "🔥", "😂", "🤔", "🤬", "🧉"];
const FRASES = ["Mazo", "Faltaba", "Mucha cancha", "Te vi"];
// Stickers santiagueños/criollos. La URL es relativa a /public.
const STICKERS: { url: string; alt: string }[] = [
  { url: "/brand/stickers/fernet.png", alt: "Fernet" }
];

const COLOR_EVENTO: Record<CategoriaEvento, string> = {
  carta: "text-text-dim",
  canto: "text-dorado font-bold",
  respuesta: "text-crema",
  puntos: "text-dorado",
  mano: "text-azul-criollo font-bold",
  sistema: "text-text-dim italic"
};

export function Chat({
  estado,
  miId,
  enviar
}: {
  estado: EstadoJuego;
  miId: string;
  /** @deprecated ya no se usa; el Marcador se renderiza fuera. */
  miEquipoEs0?: boolean;
  enviar: (m: {
    texto?: string;
    reaccion?: string;
    sticker?: string;
    destinatarioId?: string;
  }) => void;
}) {
  const [texto, setTexto] = useState("");
  // Default "todo" para que se vea la conversación completa de la partida
  // actual: mensajes humanos + eventos del juego en orden cronológico.
  const [filtro, setFiltro] = useState<
    "todo" | "jugadas" | "charla" | "companiero"
  >("todo");
  const scrollRef = useRef<HTMLDivElement>(null);
  const yo = estado.jugadores.find((j) => j.id === miId);
  const companiero = yo
    ? estado.jugadores.find((j) => j.id !== miId && j.equipo === yo.equipo)
    : undefined;
  const destinatarioId = filtro === "companiero" ? companiero?.id : undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [estado.chat.length, filtro]);

  const items = estado.chat.filter((m) => {
    // Mensajes solo-audio (canto personalizado broadcasteado al chat)
    // no se muestran como burbuja — son un canal lateral para audio.
    if (m.audioCantoDataUrl && !m.texto && !m.reaccion && !m.sticker)
      return false;
    if (!esVisibleParaMi(m, miId)) return false;
    if (filtro === "companiero") {
      return (
        !!companiero &&
        !m.evento &&
        (m.destinatarioId === companiero.id || m.jugadorId === companiero.id)
      );
    }
    if (filtro === "charla") return !m.evento;
    if (filtro === "jugadas") return !!m.evento;
    return true;
  });

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface-2/50">
          <span className="subtitulo-claim text-[10px] text-dorado">
            ✦ Mesa
          </span>
          <div className="flex gap-1 text-[10px]">
            <Tab activo={filtro === "todo"} onClick={() => setFiltro("todo")}>
              Todo
            </Tab>
            <Tab
              activo={filtro === "jugadas"}
              onClick={() => setFiltro("jugadas")}
            >
              Jugadas
            </Tab>
            <Tab
              activo={filtro === "charla"}
              onClick={() => setFiltro("charla")}
            >
              Charla
            </Tab>
            {companiero && (
              <Tab
                activo={filtro === "companiero"}
                onClick={() => setFiltro("companiero")}
              >
                Compa
              </Tab>
            )}
          </div>
        </div>
        {companiero && (
          <div className="px-2 py-2 border-b border-border bg-carbon/30">
            <div className="flex items-center gap-2">
              <img
                src={urlPersonaje(companiero.personaje)}
                alt=""
                className="w-8 h-8 rounded-full object-cover object-top border border-dorado/60"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-widest text-dorado font-bold">
                  Señas con tu compañero
                </div>
                <div className="text-xs text-crema truncate">
                  {companiero.nombre}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setFiltro(filtro === "companiero" ? "todo" : "companiero")
                }
                className={clsx(
                  "text-[10px] uppercase tracking-wider px-2 py-1 rounded border font-bold transition",
                  filtro === "companiero"
                    ? "bg-dorado text-carbon border-dorado"
                    : "bg-surface text-text-dim border-border hover:text-crema"
                )}
              >
                {filtro === "companiero" ? "Privado" : "Abrir"}
              </button>
            </div>
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5"
        >
          {items.length === 0 && (
            <div className="text-text-dim italic text-xs px-1 text-center py-4">
              Acá vas a ver las jugadas y mensajes de la mesa.
            </div>
          )}
          {items.map((m) => {
            const j = estado.jugadores.find((x) => x.id === m.jugadorId);
            const esYo = m.jugadorId === miId;
            if (m.evento)
              return <ItemEvento key={m.id} m={m} jugadorNombre={j?.nombre} />;
            const destinatario = m.destinatarioId
              ? estado.jugadores.find((x) => x.id === m.destinatarioId)
              : undefined;
            return (
              <ItemMensaje
                key={m.id}
                m={m}
                jugador={j}
                destinatario={destinatario}
                esYo={esYo}
              />
            );
          })}
        </div>

        {companiero && (
          <div className="border-t border-border p-1.5 bg-dorado/5">
            <div className="grid grid-cols-2 gap-1">
              {ORDENES_COMPANERO.map((o) => (
                <button
                  key={o.texto}
                  type="button"
                  className="flex items-center gap-1.5 rounded border border-dorado/30 bg-carbon/40 px-2 py-1 text-left text-[10px] uppercase tracking-wider text-crema hover:bg-dorado/15 transition font-bold"
                  onClick={() =>
                    enviar({
                      texto: `${o.icono} ${o.texto}`,
                      destinatarioId: companiero.id
                    })
                  }
                  title={`Enviar a ${companiero.nombre}`}
                >
                  <span className="text-sm leading-none">{o.icono}</span>
                  <span className="truncate">{o.texto}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Reacciones rápidas */}
        <div className="border-t border-border p-1.5 flex flex-wrap gap-1 bg-surface-2/30">
          {REACCIONES.map((r) => (
            <button
              key={r}
              type="button"
              className="text-xl active:scale-90 transition px-1.5 hover:bg-surface rounded"
              onClick={() => enviar({ reaccion: r, destinatarioId })}
            >
              {r}
            </button>
          ))}
          {companiero &&
            ICONOS_COMPANERO.map((r) => (
              <button
                key={`priv-${r}`}
                type="button"
                className="text-xl active:scale-90 transition px-1.5 hover:bg-dorado/15 rounded border border-dorado/20"
                onClick={() =>
                  enviar({ reaccion: r, destinatarioId: companiero.id })
                }
                title={`Seña para ${companiero.nombre}`}
              >
                {r}
              </button>
            ))}
        </div>
        <div className="px-1.5 pb-1.5 flex flex-wrap gap-1 bg-surface-2/30">
          {FRASES.map((f) => (
            <button
              key={f}
              type="button"
              className="text-[10px] uppercase tracking-wider bg-surface hover:bg-azul-criollo/30 hover:text-crema text-text-dim px-2 py-1 rounded border border-border transition font-bold"
              onClick={() => enviar({ texto: f, destinatarioId })}
            >
              {f}
            </button>
          ))}
        </div>
        {STICKERS.length > 0 && (
          <div className="px-1.5 pb-1.5 flex flex-wrap gap-1 bg-surface-2/30">
            {STICKERS.map((s) => (
              <button
                key={s.url}
                type="button"
                className="active:scale-90 hover:bg-surface rounded p-1 transition"
                onClick={() => enviar({ sticker: s.url, destinatarioId })}
                title={s.alt}
              >
                <img
                  src={s.url}
                  alt={s.alt}
                  className="w-9 h-9 object-contain"
                />
              </button>
            ))}
          </div>
        )}
        <form
          className="flex gap-1 p-2 border-t border-border"
          onSubmit={(e) => {
            e.preventDefault();
            if (!texto.trim()) return;
            enviar({ texto: texto.trim(), destinatarioId });
            setTexto("");
          }}
        >
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              destinatarioId && companiero
                ? `Mensaje privado a ${companiero.nombre}…`
                : "Mensaje…"
            }
            className="input-marca flex-1"
            maxLength={200}
          />
          <button className="btn btn-primary !px-3 !py-2 text-xs">
            {destinatarioId ? "Seña" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}

function esVisibleParaMi(m: MensajeChat, miId: string): boolean {
  return (
    !m.destinatarioId || m.destinatarioId === miId || m.jugadorId === miId
  );
}

function Tab({
  activo,
  children,
  onClick
}: {
  activo: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "uppercase tracking-wider px-2 py-1 rounded transition font-bold",
        activo
          ? "bg-dorado text-carbon"
          : "text-text-dim hover:text-crema hover:bg-surface"
      )}
    >
      {children}
    </button>
  );
}

function ItemEvento({
  m,
  jugadorNombre
}: {
  m: MensajeChat;
  jugadorNombre?: string;
}) {
  const cat = m.evento || "sistema";
  // Eventos de puntos y cierre de mano se destacan con un "ribbon" para
  // que sea fácil ubicar lo importante: quién ganó qué.
  const destacado = cat === "puntos" || cat === "mano";
  if (destacado) {
    const colorTop =
      cat === "puntos" ? "border-t-dorado" : "border-t-azul-criollo";
    return (
      <div
        className={clsx(
          "rounded-md border border-border bg-surface-2/70 px-2 py-1.5 my-1 border-t-2",
          colorTop
        )}
      >
        <div className="flex items-baseline gap-1.5">
          <span className="text-dorado text-[9px] uppercase tracking-widest font-bold shrink-0">
            {cat === "puntos" ? "✦ Puntos" : "✦ Mano"}
          </span>
          <div
            className={clsx(
              "text-sm font-bold leading-snug",
              cat === "puntos" ? "text-dorado" : "text-azul-criollo"
            )}
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.4)" }}
          >
            {jugadorNombre && (
              <span className="text-crema mr-1">{jugadorNombre}:</span>
            )}
            {m.texto}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-baseline gap-1.5 leading-snug">
      <span className="text-text-dim/50 text-[9px] uppercase tracking-wider w-12 shrink-0 text-right font-bold">
        {cat}
      </span>
      <div className={clsx("text-xs", COLOR_EVENTO[cat])}>
        {jugadorNombre && (
          <span className="font-bold mr-1">{jugadorNombre}:</span>
        )}
        {m.texto}
      </div>
    </div>
  );
}

function ItemMensaje({
  m,
  jugador,
  destinatario,
  esYo
}: {
  m: MensajeChat;
  jugador?: { personaje: string; nombre: string };
  destinatario?: { nombre: string };
  esYo: boolean;
}) {
  const esDirecto = !!m.destinatarioId || !!m.directo;
  return (
    <div className={clsx("flex items-start gap-2", esYo && "flex-row-reverse")}>
      {jugador && (
        <img
          src={urlPersonaje(jugador.personaje)}
          alt=""
          className={clsx(
            "w-7 h-7 rounded-full object-cover object-top flex-shrink-0 border",
            esYo ? "border-dorado" : "border-border"
          )}
        />
      )}
      <div
        className={clsx(
          "rounded-md px-2.5 py-1.5 max-w-[80%] text-sm shadow-sm",
          esDirecto
            ? "bg-dorado/10 border border-dorado/70 text-crema"
            : esYo
            ? "bg-dorado/15 border border-dorado/50 text-crema"
            : "bg-surface-2 border border-border text-crema"
        )}
      >
        {esDirecto && (
          <div className="text-[9px] text-dorado uppercase tracking-widest mb-0.5 font-bold">
            {esYo
              ? `Seña a ${destinatario?.nombre || "compañero"}`
              : "Seña privada"}
          </div>
        )}
        {jugador && !esYo && (
          <div className="text-[10px] text-azul uppercase tracking-wider mb-0.5 font-bold">
            {jugador.nombre}
          </div>
        )}
        {m.sticker ? (
          <img
            src={m.sticker}
            alt="sticker"
            className="w-20 h-20 object-contain"
          />
        ) : m.reaccion ? (
          <span className="text-2xl">{m.reaccion}</span>
        ) : (
          <span>{m.texto}</span>
        )}
      </div>
    </div>
  );
}
