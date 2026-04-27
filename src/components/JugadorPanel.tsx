"use client";
import clsx from "clsx";
import { urlPersonaje } from "@/data/jugadores";
import type { CategoriaEvento, Jugador } from "@/lib/truco/types";

type LadoBurbuja = "izquierda" | "derecha" | "arriba" | "abajo";

export function JugadorPanel({
  jugador,
  esTurno,
  esYo,
  esMano,
  esRival,
  compacto,
  hablando,
  hablandoKey,
  hablandoTexto,
  hablandoEvento,
  ladoBurbuja = "derecha"
}: {
  jugador: Jugador;
  esTurno: boolean;
  esYo?: boolean;
  esMano?: boolean;
  /** Es del equipo contrario — pinta el borde rojizo. */
  esRival?: boolean;
  compacto?: boolean;
  /** Si está hablando (cantó/respondió recién), pulsa más grande. */
  hablando?: boolean;
  /** Cambia cada vez que dice algo nuevo, para reiniciar la animación. */
  hablandoKey?: string | null;
  /** Texto de la burbuja a mostrar al lado de la foto. */
  hablandoTexto?: string | null;
  /** Tipo de evento: respuesta agranda más la foto que un canto inicial. */
  hablandoEvento?: CategoriaEvento | null;
  /** Lado del avatar donde apoyar la burbuja. */
  ladoBurbuja?: LadoBurbuja;
}) {
  // Avatares rectangulares (aspect 3/4) para usar mejor el espacio en mobile.
  const tam = compacto
    ? "w-12 sm:w-14"
    : "w-20 sm:w-24";
  const borderEquipo = jugador.equipo === 0 ? "border-dorado" : "border-azul-criollo";
  const borderColor = esRival ? "border-rojo-rival" : borderEquipo;
  const claseHablando =
    hablando && hablandoEvento === "respuesta"
      ? "hablando-respuesta"
      : hablando
        ? "hablando"
        : null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <div
          key={hablandoKey || "estatico"}
          className={clsx(
            "aspect-[3/4] rounded-md overflow-hidden border-2 transition shadow-md",
            tam,
            esTurno ? "border-dorado halo" : borderColor,
            !jugador.conectado && "grayscale opacity-60",
            claseHablando
          )}
        >
          <img
            src={urlPersonaje(jugador.personaje)}
            alt={jugador.nombre}
            className="w-full h-full object-cover object-top"
          />
        </div>
        {esMano && (
          <span
            className="badge-mano absolute -top-1.5 -left-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider z-10"
            title="Es mano de esta ronda"
          >
            Mano
          </span>
        )}
        {esTurno && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-dorado parpadeo border border-carbon" />
        )}
        {hablando && hablandoTexto && (
          <BurbujaCanto
            texto={hablandoTexto}
            lado={ladoBurbuja}
            destacado={hablandoEvento === "respuesta"}
            keyAnim={hablandoKey || ""}
          />
        )}
      </div>
      {/* BOT label como flex item separado (antes era absolute -bottom-1
       * y se superponía con la imagen). */}
      {jugador.esBot && (
        <span
          className="bg-carbon text-crema/80 border border-dorado/50 rounded text-[8px] px-1.5 py-0.5 uppercase font-bold tracking-wider leading-none"
          title="Bot"
        >
          bot
        </span>
      )}
      <div className="text-center leading-tight">
        <div
          className={clsx(
            "text-sm sm:text-base font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]",
            esYo ? "text-dorado" : "text-crema"
          )}
        >
          {jugador.nombre}
          {esYo && (
            <span className="text-[10px] ml-1 acento-azul font-bold">(vos)</span>
          )}
        </div>
        <div className="text-[10px] text-crema/60 uppercase tracking-wider font-bold">
          Eq {jugador.equipo + 1}
        </div>
      </div>
    </div>
  );
}

/** Burbuja de diálogo pegada al avatar, apuntando con su cola hacia la foto.
 *  Se posiciona a la izquierda/derecha/arriba/abajo según dónde tenga lugar
 *  en pantalla (lo decide el padre que sabe en qué borde está el puesto). */
function BurbujaCanto({
  texto,
  lado,
  destacado,
  keyAnim
}: {
  texto: string;
  lado: LadoBurbuja;
  destacado?: boolean;
  keyAnim: string;
}) {
  return (
    <div
      key={keyAnim}
      className={clsx(
        "absolute z-40 pointer-events-none envido-pop",
        clasePosicion(lado)
      )}
    >
      <div
        className={clsx(
          "relative rounded-xl px-3 py-1.5 shadow-xl",
          "bg-crema",
          "border",
          destacado ? "border-rojo-rival" : "border-dorado-oscuro/70",
          // Ancho mayor para que no se rompa palabra por palabra y se lea
          // de un golpe. whitespace-normal con max razonable.
          "max-w-[70vw] sm:max-w-[260px] min-w-[140px]"
        )}
      >
        <div
          className="text-[11px] sm:text-[12px] font-bold leading-tight text-center"
          style={{ color: "var(--carbon)" }}
        >
          {texto}
        </div>
        <div
          aria-hidden
          className={clsx("absolute w-3 h-3 rotate-45 bg-crema-2", colaPos(lado))}
          style={{
            borderLeftWidth: colaBordes(lado).left,
            borderTopWidth: colaBordes(lado).top,
            borderRightWidth: colaBordes(lado).right,
            borderBottomWidth: colaBordes(lado).bottom,
            borderColor: destacado
              ? "var(--rojo-rival, #b8443a)"
              : "var(--dorado-oscuro, #a07a2e)"
          }}
        />
      </div>
    </div>
  );
}

function clasePosicion(lado: LadoBurbuja): string {
  switch (lado) {
    case "izquierda":
      return "right-full mr-3 top-1/2 -translate-y-1/2";
    case "derecha":
      return "left-full ml-3 top-1/2 -translate-y-1/2";
    case "arriba":
      return "bottom-full mb-3 left-1/2 -translate-x-1/2";
    case "abajo":
      return "top-full mt-3 left-1/2 -translate-x-1/2";
  }
}

function colaPos(lado: LadoBurbuja): string {
  switch (lado) {
    case "izquierda":
      return "right-[-7px] top-1/2 -translate-y-1/2";
    case "derecha":
      return "left-[-7px] top-1/2 -translate-y-1/2";
    case "arriba":
      return "bottom-[-7px] left-1/2 -translate-x-1/2";
    case "abajo":
      return "top-[-7px] left-1/2 -translate-x-1/2";
  }
}

function colaBordes(lado: LadoBurbuja) {
  switch (lado) {
    case "izquierda":
      return { left: 0, top: 0, right: 2, bottom: 2 };
    case "derecha":
      return { left: 2, top: 2, right: 0, bottom: 0 };
    case "arriba":
      return { left: 0, top: 0, right: 2, bottom: 2 };
    case "abajo":
      return { left: 2, top: 2, right: 0, bottom: 0 };
  }
}
