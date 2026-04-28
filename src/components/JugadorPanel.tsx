"use client";
import clsx from "clsx";
import { urlPersonaje } from "@/data/jugadores";
import type { CategoriaEvento, Jugador } from "@/lib/truco/types";

type LadoBurbuja = "izquierda" | "derecha" | "arriba" | "abajo";
type LadoNombre = "izquierda" | "derecha";

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
  hablandoSticker,
  ladoBurbuja = "derecha",
  ladoNombre = "derecha",
  ocultarNombre,
  alineacionBurbujaH,
  onAvatarClick,
  avatarTitle
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
  /** URL del sticker enviado — si está presente la burbuja muestra la imagen
   *  en vez del texto. */
  hablandoSticker?: string | null;
  /** Lado del avatar donde apoyar la burbuja. */
  ladoBurbuja?: LadoBurbuja;
  /** De qué lado del avatar va el pill con el nombre. Apuntar siempre al
   *  lado interior de la pantalla así no se sale por el borde. */
  ladoNombre?: LadoNombre;
  /** Si está prendido, no muestra el pill con el nombre. Útil para mi
   *  avatar (ya sé cómo me llamo). */
  ocultarNombre?: boolean;
  /** Para burbujas arriba/abajo: anclar al borde izq/der del avatar
   *  en vez de centrar. Evita que se salga de pantalla cuando el
   *  avatar vive en una esquina. */
  alineacionBurbujaH?: "izq" | "der" | "centro";
  /** Click directo sobre la foto del jugador. */
  onAvatarClick?: () => void;
  avatarTitle?: string;
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
  // Layout horizontal: avatar + pill del nombre del lado interior. La
  // dirección del flex se invierte cuando el nombre va a la izquierda.
  const flexDir = ladoNombre === "izquierda" ? "flex-row-reverse" : "flex-row";
  const nombrePill = (
    <div
      className={clsx(
        "bg-carbon/85 backdrop-blur-sm border border-border rounded-md px-2 py-0.5 leading-tight max-w-[100px] sm:max-w-[140px]",
        "flex flex-col items-start gap-0.5"
      )}
    >
      <div
        className={clsx(
          "text-[11px] sm:text-xs font-bold drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)] truncate w-full",
          esYo ? "text-dorado" : "text-crema"
        )}
        title={jugador.nombre}
      >
        {jugador.nombre}
        {esYo && (
          <span className="text-[9px] ml-1 acento-azul font-bold">(vos)</span>
        )}
      </div>
      {jugador.esBot && (
        <span
          className="bg-transparent text-crema/60 text-[8px] uppercase font-bold tracking-wider leading-none"
          title="Bot"
        >
          bot
        </span>
      )}
    </div>
  );
  const avatarClasses = clsx(
    "aspect-[3/4] rounded-md overflow-hidden border-2 transition shadow-md",
    tam,
    esTurno ? "border-dorado halo" : borderColor,
    !jugador.conectado && "grayscale opacity-60",
    claseHablando,
    onAvatarClick &&
      "cursor-pointer hover:scale-105 focus:outline-none focus:ring-2 focus:ring-dorado focus:ring-offset-2 focus:ring-offset-carbon"
  );
  return (
    <div className={clsx("flex items-center gap-1.5", flexDir)}>
      <div className="relative">
        {onAvatarClick ? (
          <button
            key={hablandoKey || "estatico"}
            type="button"
            onClick={onAvatarClick}
            className={avatarClasses}
            title={avatarTitle}
          >
            <img
              src={urlPersonaje(jugador.personaje)}
              alt={jugador.nombre}
              className="w-full h-full object-cover object-top"
            />
          </button>
        ) : (
          <div key={hablandoKey || "estatico"} className={avatarClasses}>
            <img
              src={urlPersonaje(jugador.personaje)}
              alt={jugador.nombre}
              className="w-full h-full object-cover object-top"
            />
          </div>
        )}
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
        {hablando && (hablandoSticker || hablandoTexto) && (
          <BurbujaCanto
            texto={hablandoTexto || ""}
            sticker={hablandoSticker || undefined}
            lado={ladoBurbuja}
            destacado={hablandoEvento === "respuesta"}
            keyAnim={hablandoKey || ""}
            alineacionH={alineacionBurbujaH}
          />
        )}
      </div>
      {!ocultarNombre && nombrePill}
    </div>
  );
}

/** Burbuja de diálogo pegada al avatar. La cola apunta hacia la foto del
 *  que habla. Borde sutil dorado y cola del MISMO crema que el cuerpo —
 *  antes la cola tenía un borde rojo o dorado oscuro que se notaba como
 *  parche separado. Ahora se ve como una sola pieza. */
function BurbujaCanto({
  texto,
  sticker,
  lado,
  destacado,
  keyAnim,
  alineacionH
}: {
  texto: string;
  sticker?: string;
  lado: LadoBurbuja;
  destacado?: boolean;
  keyAnim: string;
  /** Para lado="arriba"/"abajo": de qué lado del avatar se ancla
   *  horizontalmente. Por defecto centrado. */
  alineacionH?: "izq" | "der" | "centro";
}) {
  // Para burbujas arriba/abajo, el caller puede pedir que se ancle al
  // borde izq o der del avatar para que no se salga de pantalla cuando
  // el avatar vive en una esquina.
  const claseAnclajeH =
    (lado === "arriba" || lado === "abajo")
      ? alineacionH === "izq"
        ? "left-0"
        : alineacionH === "der"
          ? "right-0"
          : "left-1/2 -translate-x-1/2"
      : "";
  return (
    <div
      key={keyAnim}
      className={clsx(
        // z-[400] para quedar por encima de las cartas tiradas en mesa
        // (que llegan a z-index 350 con la lógica de bazas).
        "absolute z-[400] pointer-events-none envido-pop",
        clasePosicion(lado),
        claseAnclajeH
      )}
    >
      <div
        className={clsx(
          "relative rounded-xl",
          sticker ? "bg-transparent p-0" : "bg-crema px-3 py-1.5",
          sticker
            ? "max-w-[40vw] sm:max-w-[120px]"
            : "max-w-[70vw] sm:max-w-[260px] min-w-[140px]"
        )}
        style={
          sticker
            ? undefined
            : {
                boxShadow: destacado
                  ? "0 4px 14px rgba(0,0,0,0.35), 0 0 0 2px rgba(217,164,65,0.35)"
                  : "0 4px 14px rgba(0,0,0,0.35)"
              }
        }
      >
        {sticker ? (
          <img
            src={sticker}
            alt="sticker"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.45)]"
          />
        ) : (
          <div
            className="text-[11px] sm:text-[12px] font-bold leading-tight text-center"
            style={{ color: "var(--carbon)" }}
          >
            {texto}
          </div>
        )}
        {!sticker && (
          // Cola: rombito (square 45deg) bg-crema sin borde — se funde
          // con el cuerpo. La sombra del cuerpo ya da profundidad.
          <div
            aria-hidden
            className={clsx("absolute w-3 h-3 rotate-45 bg-crema", colaPos(lado))}
          />
        )}
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
      // Sin -translate-x-1/2 — la pos horizontal la decide el caller
      // anclando left-0 o right-0 (ver alineacionH).
      return "bottom-full mb-3";
    case "abajo":
      return "top-full mt-3";
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
