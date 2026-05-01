"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  abandonarSalaOnline,
  agregarBotOnline,
  cerrarSalaOnline,
  enviarAccionOnline,
  enviarChatOnline,
  guardarSesion,
  iniciarPartidaOnline,
  leerSesion,
  revanchaOnline,
  unirseSalaOnline,
  useSalaOnline
} from "@/lib/salaOnline";
import { usePersonajeLocal } from "@/lib/personaje";
import { getPersonaje, urlPersonaje } from "@/data/jugadores";
import type { Accion, EstadoJuego, Jugador } from "@/lib/truco/types";
import { Mesa } from "@/components/Mesa";
import { PanelAcciones } from "@/components/PanelAcciones";
import { Chat } from "@/components/Chat";
import { ContadorPuntos } from "@/components/ContadorPuntos";
import { ChatFlotante } from "@/components/ChatFlotante";
import { MenuCompartir } from "@/components/MenuCompartir";
import { SelectorPersonaje } from "@/components/SelectorPersonaje";
import { HeaderMarca } from "@/components/HeaderMarca";
import { MiAvatarBR } from "@/components/MiAvatarBR";
import { useAudioJuego } from "@/lib/audio/useAudioJuego";
import { usePreloadCartas } from "@/lib/preload";
import { decidirAccionBot } from "@/lib/truco/ia";
import {
  deberiaConsultar,
  accionDesdeConsulta,
  type ConsultaCompañero as ConsultaT,
  type DecisionConsulta
} from "@/lib/consultaCompañero";
import { ConsultaCompañero } from "@/components/ConsultaCompañero";
import { ResultadoEnvido } from "@/components/ResultadoEnvido";
import { ResultadoMano } from "@/components/ResultadoMano";
import { AlertaPuntos } from "@/components/AlertaPuntos";

/** Aplica una jugada de carta de forma optimista al estado local —
 *  agrega la carta a la baza actual SIN sacarla todavía de la mano
 *  del jugador. Esa retención permite que la animación de "lanzar" en
 *  PanelAcciones siga visible (la carta vive en cartasOrdenadas) y a
 *  los 280ms de la animación, cartasJugadas la filtra y la canónica
 *  (que ya está en la mesa optimista) toma su lugar sin gap.
 *  Cuando llega el estado canónico vía realtime, sobreescribe esto:
 *  cartasPorJugador queda sin la carta y la baza la mantiene. */
function aplicarJugadaOptimista(
  estado: EstadoJuego,
  miId: string,
  cartaId: string
): EstadoJuego | null {
  if (!estado.manoActual) return null;
  const cartas = estado.manoActual.cartasPorJugador[miId];
  if (!cartas) return null;
  const carta = cartas.find((c) => c.id === cartaId);
  if (!carta) return null;
  const bazaIdx = estado.manoActual.bazas.length - 1;
  const baza = estado.manoActual.bazas[bazaIdx];
  // Si por alguna razón ya estaba en la baza, no duplicar.
  if (baza.jugadas.some((j) => j.carta.id === cartaId)) return null;
  return {
    ...estado,
    manoActual: {
      ...estado.manoActual,
      bazas: estado.manoActual.bazas.map((b, i) =>
        i === bazaIdx
          ? { ...b, jugadas: [...b.jugadas, { jugadorId: miId, carta }] }
          : b
      )
    }
  };
}

export default function SalaPage() {
  // Preload de cartas al entrar a la sala — si el usuario abrió el link
  // directo o refrescó, no pasó por el lobby y nadie precargó. Idempotente.
  usePreloadCartas();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const salaId = params.id;
  const [miSlug, setMiSlug, listoSlug] = usePersonajeLocal();
  const [miId, setMiId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [unidoIntentado, setUnidoIntentado] = useState(false);
  const [chatNoVisto, setChatNoVisto] = useState(0);
  const [confirmSalir, setConfirmSalir] = useState(false);
  const [menuCompartir, setMenuCompartir] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [avisoAbandono, setAvisoAbandono] = useState<string | null>(null);
  const lastChatLen = useRef(0);
  const ultimaListaJugadores = useRef<
    { id: string; nombre: string; conectado: boolean }[]
  >([]);
  const avisoTimerRef = useRef<number | null>(null);
  const botTimerRef = useRef<number | null>(null);
  const [consulta, setConsulta] = useState<ConsultaT | null>(null);
  // Para evitar despachar dos veces la misma acción del bot cuando el
  // estado se actualiza por realtime y el effect re-corre antes de que
  // llegue el estado pos-acción.
  const ultimaAccionBotRef = useRef<{ jugadorId: string; version: number } | null>(
    null
  );

  const { estado, salaMeta, error: errorSala, setEstado } = useSalaOnline(salaId);
  const chatVisibleCount = useMemo(() => {
    if (!estado || !miId) return 0;
    return estado.chat.filter(
      (m) =>
        // Excluimos mensajes solo-audio (audioCantoDataUrl sin texto):
        // son canal lateral para los cantos personalizados, no cuentan
        // como notificación de chat.
        !(m.audioCantoDataUrl && !m.texto && !m.reaccion && !m.sticker) &&
        (!m.destinatarioId || m.destinatarioId === miId || m.jugadorId === miId)
    ).length;
  }, [estado, miId]);

  // Audio del juego: cantos, cartas, reacciones.
  useAudioJuego(estado, miId);

  // Dispatcher de bots: cualquier humano conectado en la sala puede
  // despachar las acciones de los bots. El primero gana — el server
  // rechaza dispatches duplicados via el turn check del motor (una vez
  // que el bot actúa, el turno se mueve y los siguientes dispatches
  // del mismo bot fallan silenciosamente). Antes lo limitamos al
  // asiento 0 (creador) pero si el creador cerraba la pestaña los
  // bots se quedaban quietos.
  const RETARDO_BOT_MS = 1500;
  const RETARDO_PROX_MANO_MS = 3500;
  useEffect(() => {
    if (!estado || !miId || !estado.iniciada) return;
    if (estado.ganadorPartida !== null) return;
    const yo = estado.jugadores.find((j) => j.id === miId);
    if (!yo || yo.esBot) return; // sólo humanos despachan
    const mano = estado.manoActual;
    if (!mano) return;

    if (botTimerRef.current) {
      clearTimeout(botTimerRef.current);
      botTimerRef.current = null;
    }

    // Mano cerrada — el humano de menor asiento dispara la próxima
    // (jitter mínimo entre clientes para que no manden los dos al
    // mismo tiempo y uno coma el ya_terminada).
    if (mano.fase === "terminada") {
      const humanos = estado.jugadores
        .filter((j) => !j.esBot)
        .sort((a, b) => a.asiento - b.asiento);
      const soyElPrimero = humanos[0]?.id === miId;
      if (!soyElPrimero) return;
      botTimerRef.current = window.setTimeout(() => {
        enviarAccionOnline(salaId, miId, {
          tipo: "iniciar_prox_mano",
          jugadorId: ""
        }).catch((e) => console.warn("[bot-dispatch] iniciar_prox_mano", e));
      }, RETARDO_PROX_MANO_MS);
      return () => {
        if (botTimerRef.current) {
          clearTimeout(botTimerRef.current);
          botTimerRef.current = null;
        }
      };
    }

    // ¿Quién actúa ahora si es bot? Mismo criterio que salaLocal.
    let actor: typeof yo | undefined;
    if (mano.envidoCantoActivo) {
      const eq = mano.envidoCantoActivo.equipoQueDebeResponder;
      const tieneHumano = estado.jugadores.some(
        (j) => j.equipo === eq && !j.esBot
      );
      if (!tieneHumano) {
        actor = estado.jugadores.find((j) => j.equipo === eq && j.esBot);
      }
    } else if (mano.trucoCantoActivo) {
      const eq = mano.trucoCantoActivo.equipoQueDebeResponder;
      const tieneHumano = estado.jugadores.some(
        (j) => j.equipo === eq && !j.esBot
      );
      if (!tieneHumano) {
        actor = estado.jugadores.find((j) => j.equipo === eq && j.esBot);
      }
    } else {
      actor = estado.jugadores.find(
        (j) => j.id === mano.turnoJugadorId && j.esBot
      );
    }
    if (!actor) {
      console.debug("[bot-dispatch] sin actor", {
        turno: mano.turnoJugadorId,
        envido: !!mano.envidoCantoActivo,
        truco: !!mano.trucoCantoActivo,
        version: estado.version
      });
      setConsulta(null);
      return;
    }
    console.debug("[bot-dispatch] actor detectado", {
      bot: actor.id,
      asiento: actor.asiento,
      esMiTurno: mano.turnoJugadorId === actor.id,
      version: estado.version
    });

    // ¿Debería consultarle al humano antes de actuar?
    //   - Envido (baza 1, ventana abierta, bot es pie): consulta envido.
    //   - Jugar (baza 2/3 cuando el bot abre la baza): consulta jugá/vení.
    //   - Truco: si la IA quiere cantar truco/retruco/vale4 y el bot
    //     tiene compañero humano, le pedimos permiso al humano antes.
    const c = deberiaConsultar(estado, actor);
    let consultaFinal: ConsultaT | null = null;
    if (c) {
      consultaFinal = c;
      if (c.tipo === "jugar") {
        const accionPreview = decidirAccionBot(estado, actor.id);
        if (accionPreview.tipo !== "jugar_carta") consultaFinal = null;
      }
    }
    // Si no hay consulta de envido/jugar, evaluamos la acción que la IA
    // tomaría — si es un canto de truco y el bot tiene compañero humano,
    // disparamos la consulta de truco.
    if (!consultaFinal) {
      const accionPreview = decidirAccionBot(estado, actor.id);
      const esCantoTruco =
        accionPreview.tipo === "cantar_truco" ||
        accionPreview.tipo === "cantar_retruco" ||
        accionPreview.tipo === "cantar_vale4";
      const tieneCompañeroHumano = estado.jugadores.some(
        (j) => j.equipo === actor.equipo && j.id !== actor.id && !j.esBot
      );
      if (esCantoTruco && tieneCompañeroHumano) {
        consultaFinal = {
          tipo: "truco",
          botJugadorId: actor.id,
          cantoTipo: accionPreview.tipo as
            | "cantar_truco"
            | "cantar_retruco"
            | "cantar_vale4"
        };
      }
    }
    if (consultaFinal) {
      setConsulta((prev) => {
        if (
          prev &&
          prev.botJugadorId === consultaFinal!.botJugadorId &&
          prev.tipo === consultaFinal!.tipo
        )
          return prev;
        return consultaFinal;
      });
      return;
    }
    setConsulta(null);

    // Anti-doble dispatch: si ya despachamos una acción para este bot
    // a esta versión del estado, no la repetimos. Cuando el estado se
    // actualice (post-acción), version subirá y volvemos a evaluar.
    const ultimaAccion = ultimaAccionBotRef.current;
    if (
      ultimaAccion &&
      ultimaAccion.jugadorId === actor.id &&
      ultimaAccion.version === estado.version
    ) {
      return;
    }

    // Para evitar que dos clientes dispatchen al mismo bot, el humano
    // de menor asiento es el "primario". Los demás esperan un poco más
    // (fallback) por si el primario está offline.
    const humanos = estado.jugadores
      .filter((j) => !j.esBot)
      .sort((a, b) => a.asiento - b.asiento);
    const idxYo = humanos.findIndex((j) => j.id === miId);
    const retraso = RETARDO_BOT_MS + idxYo * 800;

    botTimerRef.current = window.setTimeout(() => {
      const accion = decidirAccionBot(estado, actor!.id);
      const versionAlMandar = estado.version;
      console.debug(
        "[bot-dispatch] enviando",
        { bot: actor!.id, accion: accion.tipo, version: versionAlMandar }
      );
      enviarAccionOnline(salaId, miId, accion)
        .then((r) => {
          if (r.ok) {
            // Sólo bloqueamos retries si el server aceptó. Antes seteábamos
            // el ref antes de mandar — un rechazo del server dejaba el bot
            // trabado para siempre en esa versión (no había retry).
            ultimaAccionBotRef.current = {
              jugadorId: actor!.id,
              version: versionAlMandar
            };
          } else {
            console.warn(
              "[bot-dispatch] rechazado",
              { bot: actor!.id, accion: accion.tipo, error: r.error }
            );
            setError(`Bot trabado: ${r.error || "rechazo del server"}`);
          }
        })
        .catch((e) =>
          console.warn("[bot-dispatch] error red", actor!.id, e)
        );
    }, retraso);

    return () => {
      if (botTimerRef.current) {
        clearTimeout(botTimerRef.current);
        botTimerRef.current = null;
      }
    };
  }, [estado, miId, salaId]);

  useEffect(() => {
    if (errorSala) setError(errorSala);
  }, [errorSala]);

  // No redirigimos a "/" si no hay personaje — mostramos un selector inline
  // (ver más abajo) para que la persona que entra por un link compartido
  // elija su primo y se sume directamente a esta sala.

  useEffect(() => {
    const s = leerSesion(salaId);
    if (s) setMiId(s.jugadorId);
  }, [salaId]);

  // Contador de chat no visto cuando el drawer está cerrado.
  useEffect(() => {
    if (!estado) return;
    if (chatAbierto) {
      lastChatLen.current = chatVisibleCount;
      return;
    }
    if (chatVisibleCount > lastChatLen.current) {
      setChatNoVisto((n) => n + (chatVisibleCount - lastChatLen.current));
      lastChatLen.current = chatVisibleCount;
    }
  }, [estado, chatVisibleCount, chatAbierto]);

  // Auto-unirse a la sala si ya tengo perfil pero no estoy en jugadores.
  useEffect(() => {
    if (!estado || !miSlug || unidoIntentado) return;
    const yaSoy = miId && estado.jugadores.some((j) => j.id === miId);
    if (yaSoy || (salaMeta?.iniciada ?? false)) return;
    setUnidoIntentado(true);
    (async () => {
      const r = await unirseSalaOnline({
        salaId,
        nombre: getPersonaje(miSlug)?.nombre || "Primo",
        personaje: miSlug
      });
      if (!r.ok || !r.jugador_id) {
        setError(r.error || "No se pudo entrar.");
        return;
      }
      setMiId(r.jugador_id);
      guardarSesion({
        salaId,
        jugadorId: r.jugador_id,
        perfilId: r.perfil_id
      });
    })();
  }, [estado, miSlug, miId, unidoIntentado, salaId, salaMeta?.iniciada]);

  const enviarAccion = useCallback(
    async (a: Accion) => {
      if (!miId) return;
      // UX optimista para "jugar_carta": removemos la carta de mi mano
      // y la agregamos a la baza actual al toque, sin esperar el
      // round-trip de Supabase. Cuando el realtime trae el estado
      // canónico (~500-1000ms después), reemplaza al optimista
      // (mismo carta, misma baza → no hay flicker). Antes la carta
      // arrastrada quedaba "esperando" en el slot hasta que llegara
      // la canónica → más de 1s de espera percibida.
      if (a.tipo === "jugar_carta" && estado && a.cartaId) {
        const opt = aplicarJugadaOptimista(estado, miId, a.cartaId);
        if (opt) setEstado(opt);
      }
      const r = await enviarAccionOnline(salaId, miId, a);
      if (!r.ok) setError(r.error || "Acción rechazada.");
    },
    [salaId, miId, estado, setEstado]
  );
  const resolverConsulta = useCallback(
    (decision: DecisionConsulta) => {
      if (!estado || !consulta || !miId) return;
      const accion = accionDesdeConsulta(
        estado,
        consulta.botJugadorId,
        decision,
        consulta
      );
      setConsulta(null);
      enviarAccionOnline(salaId, miId, accion);
    },
    [estado, consulta, salaId, miId]
  );
  const enviarChat = useCallback(
    async (m: {
      texto?: string;
      reaccion?: string;
      sticker?: string;
      destinatarioId?: string;
    }) => {
      if (!miId) return;
      await enviarChatOnline(salaId, miId, m);
    },
    [salaId, miId]
  );
  const iniciar = useCallback(
    async (mezclarEquipos: boolean) => {
      const r = await iniciarPartidaOnline(
        salaId,
        miId ?? undefined,
        mezclarEquipos
      );
      if (!r.ok) setError(r.error || "No se pudo iniciar.");
    },
    [salaId, miId]
  );
  // Asiento del modal abierto: cuando el creador pulsa "Sumar bot" en un
  // slot, abrimos un selector de primo; null = cerrado.
  const [asientoElegirBot, setAsientoElegirBot] = useState<number | null>(null);
  const sumarBot = useCallback(
    async (asiento: number, personaje: string) => {
      // UX optimista: pintamos el bot en el asiento al toque y disparamos
      // la edge function en paralelo. Cuando vuelve por realtime con el
      // id real, reemplaza al optimista (mismo asiento + mismo personaje
      // → no hay flicker visible).
      const meta = getPersonaje(personaje);
      if (estado && meta) {
        const optimista: Jugador = {
          id: `tmp-${asiento}-${Date.now()}`,
          nombre: meta.nombre,
          personaje,
          equipo: (asiento % 2) as 0 | 1,
          asiento,
          conectado: true,
          esBot: true
        };
        setEstado({
          ...estado,
          jugadores: [...estado.jugadores, optimista]
        });
      }
      const r = await agregarBotOnline(
        salaId,
        miId ?? undefined,
        asiento,
        personaje
      );
      if (!r.ok) setError(r.error || "No se pudo agregar bot.");
    },
    [salaId, miId, estado, setEstado]
  );
  const quitarBot = useCallback(
    async (botId: string) => {
      const r = await abandonarSalaOnline(salaId, botId);
      if (!r.ok) setError(r.error || "No se pudo quitar el bot.");
    },
    [salaId]
  );
  const [revanchaPedida, setRevanchaPedida] = useState(false);
  // Cuando el server resetea la sala (ganadorPartida vuelve a null), limpiamos
  // el flag para que el botón pueda ser usado en futuras partidas.
  useEffect(() => {
    if (estado?.ganadorPartida === null) setRevanchaPedida(false);
  }, [estado?.ganadorPartida]);
  const pedirRevancha = useCallback(async () => {
    if (!miId || revanchaPedida) return;
    setRevanchaPedida(true);
    const r = await revanchaOnline(salaId, miId);
    if (!r.ok) {
      setError(r.error || "No se pudo iniciar la revancha.");
      setRevanchaPedida(false);
    }
    // Si ok, el realtime trae el nuevo estado y el modal desaparece solo
    // (ganadorPartida vuelve a null).
  }, [salaId, miId, revanchaPedida]);
  const cerrarSala = useCallback(async () => {
    if (cerrando) return;
    setCerrando(true);
    await cerrarSalaOnline(salaId, miId ?? undefined);
    router.replace("/");
  }, [salaId, miId, cerrando, router]);
  const abandonarSala = useCallback(async () => {
    if (cerrando || !miId) return;
    setCerrando(true);
    await abandonarSalaOnline(salaId, miId);
    router.replace("/");
  }, [salaId, miId, cerrando, router]);
  const abrirChat = useCallback(() => {
    // En mobile abre el sheet, en desktop muestra el sidebar.
    setChatAbierto(true);
    setSidebarVisible(true);
    setChatNoVisto(0);
  }, []);

  const urlSala =
    typeof window !== "undefined"
      ? `${window.location.origin}/jugar/sala/${salaId}`
      : "";

  const jugadoresReales = useMemo(
    () => estado?.jugadores.filter((j) => !j.esBot) || [],
    [estado]
  );

  // Detectar abandonos: si la lista de jugadores se achica o uno pasa a
  // desconectado, mostramos un cartel arriba con quién se fue.
  // (El botón de música ahora está siempre visible — antes lo ocultábamos
  // en la pantalla de espera porque chocaba con "Compartir enlace", pero
  // el usuario pidió que esté siempre arriba a la derecha.)

  useEffect(() => {
    if (!estado) return;
    const actuales = estado.jugadores.map((j) => ({
      id: j.id,
      nombre: j.nombre,
      conectado: j.conectado !== false
    }));
    const previa = ultimaListaJugadores.current;
    if (previa.length > 0) {
      const idsActuales = new Set(actuales.map((a) => a.id));
      const previosConectadosPorId = new Map(
        previa.filter((p) => p.conectado).map((p) => [p.id, p])
      );
      // Sacaron a alguien (espera) o uno pasó de conectado a desconectado.
      const removido = previa.find(
        (p) => p.conectado && !idsActuales.has(p.id)
      );
      const desconectado = actuales.find(
        (a) => !a.conectado && previosConectadosPorId.has(a.id)
      );
      const idoNombre = removido?.nombre || desconectado?.nombre;
      if (idoNombre) {
        setAvisoAbandono(`${idoNombre} se fue de la mesa`);
        if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
        avisoTimerRef.current = window.setTimeout(() => {
          setAvisoAbandono(null);
          avisoTimerRef.current = null;
        }, 3500);
      }
    }
    ultimaListaJugadores.current = actuales;
    return () => {
      if (avisoTimerRef.current) {
        clearTimeout(avisoTimerRef.current);
        avisoTimerRef.current = null;
      }
    };
  }, [estado]);

  if (!estado) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center text-center px-4">
        <div>
          <img
            src="/brand/logo.webp"
            alt="Truco Entre Primos"
            className="w-32 mx-auto mb-4 opacity-80 parpadeo"
          />
          <div className="text-dorado font-display text-xl">
            Conectando…
          </div>
          <div className="text-text-dim text-xs mt-2 subtitulo-claim">
            Sala #{salaId}
          </div>
        </div>
      </main>
    );
  }

  // Llegué por un link compartido sin tener primo elegido todavía: mostramos
  // un selector inline para que elija acá mismo y se sume automáticamente.
  if (listoSlug && !miSlug) {
    return (
      <ElegirPrimoEnSala
        salaId={salaId}
        modo={estado.modo}
        onElegir={(slug) => setMiSlug(slug)}
      />
    );
  }

  const yaSoyJugador = miId && estado.jugadores.some((j) => j.id === miId);
  const total = estado.modo === "2v2" ? 4 : 2;
  const realesNecesarios = total - jugadoresReales.length;
  const meEnCurso = estado.iniciada && yaSoyJugador;
  const miEquipoEs0 =
    estado.jugadores.find((j) => j.id === miId)?.equipo === 0;
  // Soy el creador si soy el jugador en asiento 0 — sólo el creador
  // puede agregar/quitar bots y disparar el inicio de la partida.
  const soyCreador =
    !!miId && estado.jugadores.find((j) => j.id === miId)?.asiento === 0;
  // Para el marcador inline en el header (igual al modo Solo). En 1v1
  // mostramos los nombres reales; en 2v2 los rótulos genéricos.
  const yo = estado.jugadores.find((j) => j.id === miId);
  const es1v1 = estado.modo === "1v1";
  const rivalParaTitulo = es1v1
    ? estado.jugadores.find((j) => j.id !== miId)
    : undefined;
  const tituloNos = es1v1 && yo ? yo.nombre : "Nos";
  const tituloEllos = es1v1 && rivalParaTitulo ? rivalParaTitulo.nombre : "Ellos";

  return (
    <main className="h-[100dvh] w-screen flex flex-col overflow-hidden bg-bg">
      {/* Header: en lobby muestra el alias de la sala + compartir; en
       *  partida usa el mismo layout que el modo Solo (back arrow + score
       *  inline centrado). El chat y la música son botones flotantes. */}
      {!estado.iniciada ? (
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
          <button
            onClick={() => setConfirmSalir(true)}
            className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs shrink-0"
            title="Salir de la sala"
          >
            ←
          </button>
          <Link href="/" className="hidden sm:inline-block">
            <img
              src="/brand/logo.webp"
              alt="Truco Entre Primos"
              className="h-7 w-auto opacity-90 hover:opacity-100 transition"
            />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-text-dim subtitulo-claim leading-none">
              Sala
            </div>
            <div className="font-display text-base sm:text-lg text-dorado leading-tight truncate">
              {salaId}
            </div>
          </div>
          <button
            onClick={() => setMenuCompartir(true)}
            className="btn btn-primary !px-3 !py-1.5 !min-h-0 text-xs flex items-center gap-1.5 shrink-0 font-bold"
            title="Invitar a un primo"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M10 13a5 5 0 0 0 7.07 0l3.54-3.54a5 5 0 0 0-7.07-7.07l-1.41 1.41" />
              <path d="M14 11a5 5 0 0 0-7.07 0l-3.54 3.54a5 5 0 0 0 7.07 7.07l1.41-1.41" />
            </svg>
            <span>Invitar a un primo</span>
          </button>
        </header>
      ) : (
        <header className="relative flex items-center px-2 py-1.5 border-b border-border z-30 bg-surface/40 backdrop-blur-sm">
          <button
            onClick={() => setConfirmSalir(true)}
            className="btn btn-ghost !px-2 !py-1 !min-h-0 text-xs shrink-0"
            title="Salir de la partida"
          >
            ←
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider pointer-events-none">
            <div className="flex items-center gap-1.5">
              <span className="text-dorado truncate max-w-[90px]">
                {tituloNos}
              </span>
              <ContadorPuntos
                valor={miEquipoEs0 ? estado.puntos[0] : estado.puntos[1]}
                esMio
                objetivo={estado.puntosObjetivo}
              />
            </div>
            <span className="text-dorado/60 text-base">—</span>
            <div className="flex items-center gap-1.5">
              <ContadorPuntos
                valor={miEquipoEs0 ? estado.puntos[1] : estado.puntos[0]}
                esMio={false}
                objetivo={estado.puntosObjetivo}
              />
              <span className="text-crema truncate max-w-[90px]">
                {tituloEllos}
              </span>
            </div>
          </div>
        </header>
      )}

      {error && (
        <ErrorModal mensaje={error} onCerrar={() => setError(null)} />
      )}

      {!estado.iniciada && !yaSoyJugador && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="card p-5 text-center max-w-sm border-l-4 border-l-azul-criollo">
            <div className="titulo-marca text-xl mb-2">
              Esperando que se <span className="acento">sienten</span>
            </div>
            <p className="text-sm text-text-dim">
              La partida no empezó. Si querés jugar, volvé al inicio y elegí tu primo.
            </p>
          </div>
        </div>
      )}

      {!estado.iniciada && yaSoyJugador && (
        <SalaEspera
          estado={estado}
          miId={miId}
          onIniciar={iniciar}
          onAbrirSumarBot={
            soyCreador ? (asiento) => setAsientoElegirBot(asiento) : undefined
          }
          onQuitarBot={soyCreador ? quitarBot : undefined}
          onAutoCompletarBots={
            soyCreador
              ? async () => {
                  const total = estado.modo === "2v2" ? 4 : 2;
                  const ocupados = new Set(
                    estado.jugadores.map((j) => j.asiento)
                  );
                  // Serializamos las llamadas: si las disparamos en
                  // paralelo, las ediciones concurrentes a salas.estado
                  // (JSONB) pisan unas a otras → quedan bots fantasma.
                  // Slug vacío → server elige uno random entre los libres.
                  for (let i = 0; i < total; i++) {
                    if (!ocupados.has(i)) await sumarBot(i, "");
                  }
                }
              : undefined
          }
          onCerrar={() => setConfirmSalir(true)}
          cerrando={cerrando}
        />
      )}

      {/* Modal: elegir primo para el bot */}
      {asientoElegirBot !== null && (
        <ElegirBotModal
          ocupados={estado.jugadores.map((j) => j.personaje)}
          onCerrar={() => setAsientoElegirBot(null)}
          onConfirmar={async (slug) => {
            const asiento = asientoElegirBot;
            setAsientoElegirBot(null);
            if (asiento !== null) await sumarBot(asiento, slug);
          }}
        />
      )}

      {/* Layout principal: mesa flexible + chat lateral en desktop / drawer en mobile */}
      {estado.iniciada && yaSoyJugador && (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Columna principal */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="flex-1 relative min-h-0">
              <Mesa estado={estado} miId={miId!} enviarChat={enviarChat} />
              {/* Mi avatar: BR del área de mesa (encima del PanelAcciones)
               * para que quede arriba de mi mano de cartas. */}
              <MiAvatarBR estado={estado} miId={miId!} />
              {/* Toast efímero del envido cuando se resuelve. */}
              <ResultadoEnvido estado={estado} miId={miId!} />
              {/* Banner grande del cierre de mano (puntos ganados/perdidos). */}
              <ResultadoMano estado={estado} miId={miId!} />
              {/* Toast en tiempo real cuando se otorgan puntos en la mano
               * (envido no querido, truco no querido, ir al mazo, etc.). */}
              <AlertaPuntos estado={estado} miId={miId!} />
              {consulta && (
                <ConsultaCompañero
                  consulta={consulta}
                  estado={estado}
                  onResolver={resolverConsulta}
                />
              )}
              {/* Burbuja con últimos 3 mensajes humanos */}
              <ChatFlotante
                estado={estado}
                miId={miId!}
                onAbrir={abrirChat}
                oculto={chatAbierto}
              />
            </div>
            {meEnCurso && (
              <PanelAcciones
                estado={estado}
                miId={miId!}
                enviar={enviarAccion}
                enviarChat={enviarChat}
                miSlug={miSlug || undefined}
              />
            )}
          </div>

          {/* Chat: panel lateral en desktop (oculto si sidebarVisible=false) */}
          {sidebarVisible && (
            <aside className="hidden md:flex w-80 lg:w-96 border-l border-border flex-col p-2 overflow-hidden relative">
              <button
                onClick={() => setSidebarVisible(false)}
                className="absolute top-2 right-2 z-10 btn btn-ghost !px-2 !py-1 !min-h-0 text-xs"
                title="Ocultar chat"
              >
                ✕
              </button>
              <Chat estado={estado} miId={miId!} enviar={enviarChat} />
            </aside>
          )}
          {/* Chat: drawer en mobile */}
          {chatAbierto && (
            <div
              className="fixed inset-0 sheet-bg z-[600] md:hidden flex items-end"
              onClick={() => setChatAbierto(false)}
            >
              <div
                className="bg-bg w-full h-[85vh] rounded-t-xl border-t border-border p-2 flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center px-1 pb-2">
                  <span className="label-slim">Mesa</span>
                  <button
                    onClick={() => setChatAbierto(false)}
                    className="btn btn-ghost !py-1 !px-2 !min-h-0 text-xs"
                  >
                    Cerrar ✕
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <Chat estado={estado} miId={miId!} enviar={enviarChat} />
                </div>
              </div>
            </div>
          )}


          {/* Modal ganador con nombres y botón Revancha (sólo creador). */}
          {estado.ganadorPartida !== null && (() => {
            const equipoGanador = estado.ganadorPartida ?? 0;
            const yoGane = miEquipoEs0 === (equipoGanador === 0);
            const ganadores = estado.jugadores
              .filter((j) => j.equipo === equipoGanador)
              .map((j) => j.nombre);
            const titulo = es1v1
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
              <div className="absolute inset-0 sheet-bg flex items-center justify-center z-[1000] p-4">
                <div className="papel p-5 text-center max-w-sm w-full">
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
                  <div className="flex flex-col gap-2">
                    {soyCreador && (
                      <button
                        type="button"
                        onClick={pedirRevancha}
                        disabled={revanchaPedida}
                        className="btn btn-primary disabled:opacity-60"
                      >
                        {revanchaPedida ? "Repartiendo…" : "Revancha"}
                      </button>
                    )}
                    {!soyCreador && (
                      <p className="text-xs text-text-dim italic">
                        Esperando que el creador inicie revancha…
                      </p>
                    )}
                    <Link href="/" className="btn btn-ghost text-xs">
                      Volver al inicio
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Menú de compartir enlace */}
      {menuCompartir && (
        <MenuCompartir
          salaId={salaId}
          url={urlSala}
          onCerrar={() => setMenuCompartir(false)}
        />
      )}

      {/* Confirmación cerrar sala */}
      {confirmSalir && (
        <div
          className="fixed inset-0 sheet-bg flex items-center justify-center z-[1000] p-4"
          onClick={() => setConfirmSalir(false)}
        >
          <div
            className="card p-5 max-w-sm w-full text-center border-t-4 border-t-red"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="titulo-marca text-xl mb-2">
              ¿Cerrar la <span className="acento">sala</span>?
            </div>
            <p className="text-text-dim text-sm mb-4">
              {estado.iniciada
                ? "La partida se va a dar por terminada para todos."
                : "La sala se elimina y los primos invitados no van a poder entrar."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmSalir(false)}
                className="btn flex-1"
              >
                Volver
              </button>
              <button
                onClick={cerrarSala}
                disabled={cerrando}
                className="btn btn-danger flex-1"
              >
                {cerrando ? "Cerrando…" : "Cerrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/** Sala en espera: layout grid 1×2 (solo a solo) o 2×2 (en parejas) que
 * ocupa la pantalla, con barra de acciones abajo (Cerrar / Iniciar). */
function SalaEspera({
  estado,
  miId,
  onIniciar,
  onCerrar,
  onAbrirSumarBot,
  onQuitarBot,
  onAutoCompletarBots,
  cerrando
}: {
  estado: EstadoJuego;
  miId: string | null;
  onIniciar: (mezclarEquipos: boolean) => void;
  onCerrar: () => void;
  onAbrirSumarBot?: (asiento: number) => void;
  onQuitarBot?: (botId: string) => void;
  /** Llena los slots vacíos con bots aleatorios. Sólo lo provee el creador. */
  onAutoCompletarBots?: () => void | Promise<void>;
  cerrando: boolean;
}) {
  const total = estado.modo === "2v2" ? 4 : 2;
  const slots = Array.from({ length: total }).map((_, i) => {
    const j = estado.jugadores.find((x) => x.asiento === i);
    return { i, j };
  });
  const ocupados = slots.filter((s) => !!s.j).length;
  const faltan = total - ocupados;
  const todosListos = faltan === 0;
  const [mezclarEquipos, setMezclarEquipos] = useState(false);
  const [completarConBots, setCompletarConBots] = useState(false);
  // Si el usuario activó "Completar con bots", al iniciar lanzamos
  // primero un sumarBot por cada asiento libre y después invocamos
  // onIniciar con un pequeño delay (el server necesita ver los bots ya
  // sentados). Habilitamos el botón Iniciar aunque falten primos.
  const puedeIniciar = todosListos || (completarConBots && !!onAutoCompletarBots);
  const handleIniciar = async () => {
    if (!puedeIniciar) return;
    if (faltan > 0 && completarConBots && onAutoCompletarBots) {
      await onAutoCompletarBots();
    }
    onIniciar(mezclarEquipos);
  };

  // Grid: 2 cols × 1 fila (1v1) o 2 cols × 2 filas (2v2). En 1v1 no
  // estiramos el grid (sin `flex-1`) — sino el slot único ocupaba toda
  // la altura libre y la tarjeta quedaba enorme. En 2v2 sí se estira
  // para repartir las 2 filas en el espacio disponible.
  const gridCls =
    total === 4
      ? "flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-3 sm:p-4"
      : "grid grid-cols-2 auto-rows-min gap-3 p-3 sm:p-4";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className={gridCls}>
        {slots.map(({ i, j }) => (
          <SlotEspera
            key={i}
            asiento={i}
            jugador={j}
            esYo={j?.id === miId}
            onSumarBot={
              !j && onAbrirSumarBot ? () => onAbrirSumarBot(i) : undefined
            }
            onQuitarBot={
              j?.esBot && onQuitarBot ? () => onQuitarBot(j.id) : undefined
            }
          />
        ))}
      </div>
      {/* Toggles estilo botón ocupando media pantalla cada uno. En 1v1
       *  el "Sortear compañeros" no tiene sentido, así que el "Completar
       *  con bots" toma todo el ancho. */}
      <div className="px-2 sm:px-4 py-2 grid grid-cols-2 gap-2">
        {total === 4 && (
          <ToggleBoton
            activo={mezclarEquipos}
            onClick={() => setMezclarEquipos((v) => !v)}
            icono={<IconoBarajar />}
            label="Sortear"
            sublabel="Al azar"
          />
        )}
        {onAutoCompletarBots && (
          <ToggleBoton
            activo={completarConBots}
            onClick={() => setCompletarConBots((v) => !v)}
            icono={<IconoBotAuto />}
            label="Completar"
            sublabel={
              faltan > 0
                ? `${faltan} bot${faltan === 1 ? "" : "s"}`
                : "Listos"
            }
            disabled={faltan === 0}
          />
        )}
      </div>
      <div className="border-t border-border bg-surface/40 p-3 flex items-center gap-2">
        <button
          onClick={onCerrar}
          disabled={cerrando}
          className="btn btn-danger flex-1 sm:flex-initial sm:px-6"
        >
          Cerrar sala
        </button>
        <div className="flex-1 text-center text-xs subtitulo-claim">
          {todosListos ? (
            <span className="text-dorado">¡Todos listos!</span>
          ) : completarConBots ? (
            <span className="text-dorado">Completaremos con bots</span>
          ) : (
            <span className="text-text-dim">
              {faltan === 1 ? "Falta 1 primo" : `Faltan ${faltan} primos`}
            </span>
          )}
        </div>
        <button
          onClick={handleIniciar}
          disabled={!puedeIniciar}
          className="btn btn-primary flex-1 sm:flex-initial sm:px-6"
          title={
            puedeIniciar
              ? "Empezar partida"
              : "Esperá a que se sienten todos o tocá Completar con bots"
          }
        >
          Iniciar
        </button>
      </div>
    </div>
  );
}

/** Botón estilo toggle compacto. Diseñado para entrar en mobile en 2
 *  columnas. Cuando está activo, borde y texto dorados, con un check
 *  chiquito en la esquina. */
function ToggleBoton({
  activo,
  onClick,
  icono,
  label,
  sublabel,
  disabled
}: {
  activo: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activo}
      className={`relative flex items-center gap-1.5 px-2 py-1.5 rounded-lg border-2 transition text-left min-w-0 ${
        disabled
          ? "border-border/40 bg-surface/20 opacity-50 cursor-not-allowed"
          : activo
            ? "border-dorado bg-dorado/10 text-dorado"
            : "border-border bg-surface/60 text-crema hover:border-azul-criollo/60"
      }`}
    >
      <span
        className={`flex-shrink-0 w-7 h-7 rounded flex items-center justify-center border ${
          activo ? "border-dorado/60 bg-dorado/15" : "border-border bg-carbon/40"
        }`}
      >
        {icono}
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block font-display text-[11px] sm:text-xs leading-tight truncate">
          {label}
        </span>
        {sublabel && (
          <span className="block text-[9px] text-text-dim leading-tight truncate">
            {sublabel}
          </span>
        )}
      </span>
      {activo && (
        <span
          className="absolute top-1 right-1 w-3 h-3 rounded-full bg-dorado flex items-center justify-center"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--carbon)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-2.5 h-2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      )}
    </button>
  );
}

function IconoBarajar() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 3h5v5" />
      <path d="M4 20l17-17" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

function IconoBotAuto() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 8V4M9 4h6" />
      <circle cx="9" cy="14" r="1" fill="currentColor" />
      <circle cx="15" cy="14" r="1" fill="currentColor" />
      <path d="M3 13h-1M21 13h1" />
    </svg>
  );
}

function SlotEspera({
  asiento,
  jugador,
  esYo,
  onSumarBot,
  onQuitarBot
}: {
  asiento: number;
  jugador?: Jugador;
  esYo: boolean;
  onSumarBot?: () => void;
  onQuitarBot?: () => void;
}) {
  const equipo = (asiento % 2) as 0 | 1;
  const colorEquipo = equipo === 0 ? "border-dorado" : "border-azul-criollo";
  return (
    <div
      className={`relative card flex flex-col items-center justify-center gap-2 p-3 sm:p-4 transition ${
        jugador
          ? `border-l-4 ${colorEquipo}`
          : "border-2 border-dashed border-border/60 bg-transparent"
      }`}
    >
      <div className="absolute top-2 right-2 text-[9px] text-text-dim subtitulo-claim font-bold">
        Eq {equipo + 1}
      </div>
      {jugador ? (
        <>
          <div className="relative">
            <img
              src={urlPersonaje(jugador.personaje)}
              alt={jugador.nombre}
              className={`w-20 sm:w-24 aspect-[3/4] rounded-md object-cover object-top border-2 shadow-md ${
                esYo ? "border-dorado halo" : colorEquipo
              }`}
            />
            {esYo && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-dorado text-carbon text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded">
                vos
              </span>
            )}
            {jugador.esBot && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-carbon border border-dorado/50 text-crema/80 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded">
                bot
              </span>
            )}
            {jugador.esBot && onQuitarBot && (
              <button
                type="button"
                onClick={onQuitarBot}
                className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red text-crema text-sm font-black flex items-center justify-center shadow-lg ring-2 ring-carbon transition hover:scale-110 hover:bg-red/80"
                title={`Quitar a ${jugador.nombre}`}
                aria-label={`Quitar a ${jugador.nombre}`}
              >
                ✕
              </button>
            )}
          </div>
          <div className="text-center">
            <div className="font-display text-base sm:text-lg leading-tight truncate max-w-[140px]">
              {jugador.nombre}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-20 sm:w-24 aspect-[3/4] rounded-md border-2 border-dashed border-border/60 flex items-center justify-center text-text-dim/40 text-3xl">
            ?
          </div>
          <div className="text-center text-text-dim/70 text-xs italic subtitulo-claim">
            Esperando primo
          </div>
          {onSumarBot && (
            <button
              type="button"
              onClick={onSumarBot}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border-2 border-dorado/60 bg-gradient-to-br from-dorado/15 to-surface text-dorado text-xs font-bold uppercase tracking-wider hover:border-dorado hover:from-dorado/25 transition shadow-md"
              title="Sumar un bot en este asiento"
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="8" width="18" height="12" rx="2" />
                <path d="M12 8V4M9 4h6" />
                <circle cx="9" cy="14" r="1" fill="currentColor" />
                <circle cx="15" cy="14" r="1" fill="currentColor" />
              </svg>
              <span>Sumar bot</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** Pantalla intermedia: alguien que abre el link compartido sin tener primo
 *  guardado. Elige acá mismo y queda dentro de la sala (no rebota al home). */
function ElegirPrimoEnSala({
  salaId,
  modo,
  onElegir
}: {
  salaId: string;
  modo: "1v1" | "2v2";
  onElegir: (slug: string) => void;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  return (
    <main className="min-h-[100dvh] px-4 py-6 max-w-xl mx-auto">
      <HeaderMarca variante="compacto" />
      <div className="card p-4 mt-5 mb-3 text-center border-l-4 border-l-azul-criollo">
        <div className="label-slim acento-azul">Te invitaron a</div>
        <div className="font-display text-xl text-dorado">{salaId}</div>
        <div className="text-text-dim text-xs mt-1 subtitulo-claim">
          {modo === "2v2" ? "Partida en parejas" : "Solo a solo"}
        </div>
      </div>
      <p className="text-center text-text-dim text-sm mb-4">
        Elegí qué primo te representa para entrar.
      </p>
      <div className="card p-4">
        <SelectorPersonaje
          seleccionado={seleccionado}
          onSeleccionar={setSeleccionado}
        />
        <button
          onClick={() => seleccionado && onElegir(seleccionado)}
          disabled={!seleccionado}
          className="btn btn-primary w-full mt-4"
        >
          {seleccionado ? "Entrar a la sala" : "Elegí un primo"}
        </button>
      </div>
    </main>
  );
}

/** Mapa de códigos crudos del backend → mensaje legible para el usuario.
 *  Incluye los del CLI/edge function y algunos errores comunes del motor.
 *  Si no hay match, devolvemos el mensaje original. */
function legibilizarError(crudo: string): string {
  // Los errores vienen como "fn-name: codigo". Sacamos el codigo solo.
  const m = crudo.match(/(?:^|: )([a-z_][a-z0-9_]*)\s*$/i);
  const code = m ? m[1] : crudo;
  const map: Record<string, string> = {
    solo_el_creador: "Sólo el creador de la sala puede hacer eso.",
    solo_creador: "Sólo el creador puede hacer eso.",
    solo_creador_despacha_bots: "Sólo el creador despacha a los bots.",
    sala_no_encontrada: "La sala ya no existe.",
    sala_llena: "La sala ya está completa.",
    target_no_es_bot: "Sólo se puede quitar a los bots.",
    no_iniciada: "La partida todavía no empezó.",
    ya_terminada: "La partida ya terminó.",
    creador_no_puede_abandonar:
      "El creador no puede abandonar — usá Cerrar sala.",
    ya_empezo: "La partida ya empezó.",
    "No es tu turno.": "No es tu turno.",
    "Acción rechazada.": "Acción rechazada."
  };
  return map[code] || crudo;
}

/** Modal: el creador elige qué primo entra como bot. Filtra los primos
 *  ya ocupados (tanto humanos como bots ya sentados). */
function ElegirBotModal({
  ocupados,
  onCerrar,
  onConfirmar
}: {
  ocupados: string[];
  onCerrar: () => void;
  onConfirmar: (slug: string) => void;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sheet-bg"
      onClick={onCerrar}
    >
      <div
        className="card p-4 max-w-md w-full max-h-[90vh] overflow-y-auto border-l-4 border-l-dorado"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-3">
          <div className="titulo-marca text-xl">
            Elegí un <span className="acento">primo</span>
          </div>
          <p className="text-xs text-text-dim mt-1 subtitulo-claim">
            Va a jugar como bot en este asiento.
          </p>
        </div>
        <SelectorPersonaje
          seleccionado={seleccionado}
          ocupados={ocupados}
          onSeleccionar={setSeleccionado}
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onCerrar} className="btn flex-1">
            Cancelar
          </button>
          <button
            onClick={() => seleccionado && onConfirmar(seleccionado)}
            disabled={!seleccionado}
            className="btn btn-primary flex-1"
          >
            Sumar bot
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal de error: aparece centrado, se cierra al click o solo a los 4s. */
function ErrorModal({
  mensaje,
  onCerrar
}: {
  mensaje: string;
  onCerrar: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onCerrar, 4000);
    return () => clearTimeout(t);
  }, [mensaje, onCerrar]);
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sheet-bg"
      onClick={onCerrar}
    >
      <div
        className="card p-4 max-w-sm w-full text-center border-l-4 border-l-red shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-3xl mb-2">⚠️</div>
        <div className="text-sm text-crema mb-3">
          {legibilizarError(mensaje)}
        </div>
        <button onClick={onCerrar} className="btn btn-ghost text-xs w-full">
          Cerrar
        </button>
      </div>
    </div>
  );
}
