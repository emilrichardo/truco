// Decide y aplica una acción de bot usando NVIDIA NIM cuando hay API key.
// La key vive como secret de Supabase Edge Functions: NVIDIA_API_KEY.
import { admin, fail, ok, preflight, readJson } from "../_shared/lib.ts";
import { accionesLegales, aplicarAccion } from "../_shared/truco/motor.ts";
import {
  calcularEnvido,
  jerarquia,
  nombreCarta,
} from "../_shared/truco/cartas.ts";
import {
  finalizarSalaConGanador,
  registrarPartidaTerminada,
  salaExpirada,
} from "../_shared/salaLifecycle.ts";
import type {
  Accion,
  AccionTipo,
  Carta,
  EstadoJuego,
  Jugador,
  MensajeChat,
} from "../_shared/truco/types.ts";

interface Payload {
  sala_id: string;
  jugador_id: string;
  bot_jugador_id: string;
  accion_base?: Partial<Accion>;
  version_esperada?: number;
}

interface BotIARespuesta {
  accion?: Partial<Accion>;
  chat?: {
    texto?: string;
    reaccion?: string;
    emocion?: MensajeChat["emocion"];
  };
  razon?: string;
}

type ChatIA = {
  texto?: string;
  reaccion?: string;
  emocion?: MensajeChat["emocion"];
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_MODEL_DEFAULT = "google/gemma-3n-e4b-it";
const IA_PENSANDO_TTL_MS = 15_000;
const MIN_PENSAR_MS = 1100;
const FETCH_TIMEOUT_MS = 6500;
const REACCIONES = [
  "😄",
  "😡",
  "😤",
  "😂",
  "🤔",
  "😎",
  "🔥",
  "👏",
  "😬",
  "🙄",
  "💪",
];
const EMOCIONES = new Set([
  "alegria",
  "enojo",
  "picardia",
  "sorpresa",
  "neutral",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return fail("method_not_allowed", 405);

  const body = await readJson<Payload>(req);
  if (!body || !body.sala_id || !body.jugador_id || !body.bot_jugador_id) {
    return fail("missing_fields");
  }

  const sb = admin();
  const inicio = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);

  const { data: salaInicial, error: errSel } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errSel || !salaInicial) return fail("sala_no_encontrada", 404);
  if (!salaInicial.iniciada) return fail("no_iniciada", 409);
  if (salaInicial.terminada) return fail("ya_terminada", 409);
  if (salaExpirada(salaInicial)) {
    try {
      await finalizarSalaConGanador(
        sb,
        salaInicial,
        "La sala superó 1 hora de duración. Se termina por tiempo y gana el equipo que iba arriba.",
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error), 500);
    }
    return fail("sala_expirada", 409);
  }

  const estadoInicial = salaInicial.estado as EstadoJuego;
  const validacion = validarDispatcher(
    estadoInicial,
    body.jugador_id,
    body.bot_jugador_id,
  );
  if (validacion) return fail(validacion, 403);

  if (
    typeof body.version_esperada === "number" &&
    estadoInicial.version !== body.version_esperada
  ) {
    return ok({ stale: true, ms: Date.now() - inicio });
  }

  limpiarPensando(estadoInicial);
  if (estaPensando(estadoInicial, body.bot_jugador_id)) {
    return ok({ pensando: true, ms: Date.now() - inicio });
  }

  marcarPensando(estadoInicial, body.bot_jugador_id, requestId, true);
  const { error: errPensando } = await sb
    .from("salas")
    .update({ estado: estadoInicial })
    .eq("id", body.sala_id);
  if (errPensando) return fail(`thinking: ${errPensando.message}`, 500);

  const legalesIniciales = accionesLegales(
    estadoInicial,
    body.bot_jugador_id,
  );
  const contexto = construirContexto(
    estadoInicial,
    body.bot_jugador_id,
    legalesIniciales,
    body.accion_base,
  );
  const iaPromise = consultarNvidia(contexto).catch((error) => {
    console.warn("[sala-bot-ia] nvidia", error);
    return null;
  });
  const [respuestaIA] = await Promise.all([
    iaPromise,
    sleep(MIN_PENSAR_MS),
  ]);

  const { data: salaFresh, error: errFresh } = await sb
    .from("salas")
    .select("*")
    .eq("id", body.sala_id)
    .single();
  if (errFresh || !salaFresh) return fail("sala_no_encontrada", 404);
  const estado = salaFresh.estado as EstadoJuego;

  const actorActual = quienActuaSiBot(estado);
  if (!actorActual || actorActual.id !== body.bot_jugador_id) {
    marcarPensando(estado, body.bot_jugador_id, requestId, false);
    const { error: errUpd } = await sb
      .from("salas")
      .update({ estado })
      .eq("id", body.sala_id);
    if (errUpd) return fail(`update: ${errUpd.message}`, 500);
    return ok({ stale: true, ms: Date.now() - inicio });
  }

  const legales = accionesLegales(estado, body.bot_jugador_id);
  const accionIA = normalizarAccion(
    respuestaIA?.accion,
    estado,
    body.bot_jugador_id,
    legales,
  );
  const accionFallback = accionFallbackSegura(
    estado,
    body.bot_jugador_id,
    body.accion_base,
    legales,
  );
  let accion = accionIA ?? accionFallback;

  const r = aplicarAccion(estado, accion);
  if (!r.ok && accionIA) {
    const fallback = accionFallbackSegura(
      estado,
      body.bot_jugador_id,
      body.accion_base,
      accionesLegales(estado, body.bot_jugador_id),
    );
    const rFallback = aplicarAccion(estado, fallback);
    if (!rFallback.ok) {
      marcarPensando(estado, body.bot_jugador_id, requestId, false);
      await sb.from("salas").update({ estado }).eq("id", body.sala_id);
      return fail(rFallback.error || r.error || "accion_invalida");
    }
    accion = fallback;
  } else if (!r.ok) {
    marcarPensando(estado, body.bot_jugador_id, requestId, false);
    await sb.from("salas").update({ estado }).eq("id", body.sala_id);
    return fail(r.error || "accion_invalida");
  }

  const chat = normalizarChat(respuestaIA?.chat) ??
    chatFallback(estado, accion);
  if (chat) insertarChatIA(estado, body.bot_jugador_id, chat);
  marcarPensando(estado, body.bot_jugador_id, requestId, false);

  const updates: Record<string, unknown> = { estado };
  if (estado.ganadorPartida !== null) {
    updates.terminada = true;
    updates.ganador_equipo = estado.ganadorPartida;
    updates.terminada_at = new Date().toISOString();
    await registrarPartidaTerminada(sb, salaFresh, estado);
  }

  const { error: errUpd } = await sb
    .from("salas")
    .update(updates)
    .eq("id", body.sala_id);
  if (errUpd) return fail(`update: ${errUpd.message}`, 500);

  return ok({
    accion: accion.tipo,
    ia: !!accionIA,
    modelo: Deno.env.get("NVIDIA_AI_MODEL") || NVIDIA_MODEL_DEFAULT,
    ms: Date.now() - inicio,
  });
});

function validarDispatcher(
  estado: EstadoJuego,
  dispatcherId: string,
  botId: string,
): string | null {
  const dispatcher = estado.jugadores.find((j) => j.id === dispatcherId);
  const bot = estado.jugadores.find((j) => j.id === botId);
  if (!dispatcher || dispatcher.esBot) return "solo_humano_despacha_bots";
  if (!bot || !bot.esBot) return "target_no_es_bot";
  const actor = quienActuaSiBot(estado);
  if (!actor || actor.id !== botId) return "bot_no_actua";
  return null;
}

function quienActuaSiBot(estado: EstadoJuego): Jugador | undefined {
  const mano = estado.manoActual;
  if (!mano) return undefined;
  if (mano.envidoCantoActivo) {
    const eq = mano.envidoCantoActivo.equipoQueDebeResponder;
    const tieneHumano = estado.jugadores.some((j) =>
      j.equipo === eq && !j.esBot
    );
    if (tieneHumano) return undefined;
    return estado.jugadores.find((j) => j.equipo === eq && j.esBot);
  }
  if (mano.trucoCantoActivo) {
    const eq = mano.trucoCantoActivo.equipoQueDebeResponder;
    const tieneHumano = estado.jugadores.some((j) =>
      j.equipo === eq && !j.esBot
    );
    if (tieneHumano) return undefined;
    return estado.jugadores.find((j) => j.equipo === eq && j.esBot);
  }
  return estado.jugadores.find((j) => j.id === mano.turnoJugadorId && j.esBot);
}

function limpiarPensando(estado: EstadoJuego) {
  if (!estado.iaPensando?.length) return;
  const now = Date.now();
  const ids = new Set(estado.jugadores.map((j) => j.id));
  estado.iaPensando = estado.iaPensando.filter(
    (p) => ids.has(p.jugadorId) && now - p.desde < IA_PENSANDO_TTL_MS,
  );
}

function estaPensando(estado: EstadoJuego, jugadorId: string): boolean {
  return !!estado.iaPensando?.some((p) => p.jugadorId === jugadorId);
}

function marcarPensando(
  estado: EstadoJuego,
  jugadorId: string,
  requestId: string,
  encendido: boolean,
) {
  limpiarPensando(estado);
  const actuales = estado.iaPensando || [];
  if (encendido) {
    estado.iaPensando = [
      ...actuales.filter((p) => p.jugadorId !== jugadorId),
      { jugadorId, desde: Date.now(), requestId },
    ];
  } else {
    estado.iaPensando = actuales.filter(
      (p) => p.jugadorId !== jugadorId && p.requestId !== requestId,
    );
  }
  estado.version = (estado.version || 0) + 1;
}

function construirContexto(
  estado: EstadoJuego,
  botId: string,
  legales: AccionTipo[],
  accionBase?: Partial<Accion>,
) {
  const mano = estado.manoActual!;
  const bot = estado.jugadores.find((j) => j.id === botId)!;
  const equipoRival = bot.equipo === 0 ? 1 : 0;
  const cartasBot = mano.cartasPorJugador[botId] || [];
  const cartasJugadasBot = mano.bazas.flatMap((b) =>
    b.jugadas.filter((j) => j.jugadorId === botId).map((j) => j.carta)
  );
  const originalesBot = [...cartasBot, ...cartasJugadasBot];
  const cartasAliadas = estado.jugadores
    .filter((j) => j.equipo === bot.equipo && j.id !== bot.id)
    .flatMap((j) => mano.cartasPorJugador[j.id] || []);
  return {
    objetivo:
      "Elegir una acción legal y una reacción breve de bot para Truco Argentino.",
    reglasSalida:
      'Respondé únicamente JSON válido: {"accion":{"tipo":"","cartaId":""},"chat":{"texto":"","reaccion":"","emocion":"picardia"},"razon":""}.',
    tono:
      "Picante de mesa argentina. Podés chicanear o usar insultos leves como boludo/pecho frío, sin odio, amenazas, sexual explícito ni ataques discriminatorios.",
    estrategia:
      "Jugá fuerte: cuidá cartas altas, calculá envido, leé marcador, mentí sólo cuando sea creíble y usá truco/envido para presionar.",
    bot: {
      id: bot.id,
      nombre: bot.nombre,
      equipo: bot.equipo,
      asiento: bot.asiento,
      envido: calcularEnvido(originalesBot),
      cartas: cartasBot.map(cartaResumen),
      cartasAliadas: cartasAliadas.map(cartaResumen),
    },
    marcador: {
      equipoBot: estado.puntos[bot.equipo],
      equipoRival: estado.puntos[equipoRival],
      objetivo: estado.puntosObjetivo,
      valorMano: mano.valorMano,
    },
    mano: {
      numero: mano.numero,
      fase: mano.fase,
      turnoJugadorId: mano.turnoJugadorId,
      manoJugadorId: mano.manoJugadorId,
      trucoEstado: mano.trucoEstado,
      envidoEstado: mano.envidoEstado,
      envidoPendiente: mano.envidoCantoActivo,
      trucoPendiente: mano.trucoCantoActivo,
      bazas: mano.bazas.map((b, i) => ({
        numero: i + 1,
        ganadorEquipo: b.ganadorEquipo,
        pardada: b.pardada,
        jugadas: b.jugadas.map((j) => {
          const jugador = estado.jugadores.find((p) => p.id === j.jugadorId);
          return {
            jugadorId: j.jugadorId,
            nombre: jugador?.nombre,
            equipo: jugador?.equipo,
            carta: cartaResumen(j.carta),
            tapada: !!j.tapada,
          };
        }),
      })),
    },
    jugadores: estado.jugadores.map((j) => ({
      id: j.id,
      nombre: j.nombre,
      equipo: j.equipo,
      asiento: j.asiento,
      esBot: j.esBot,
      conectado: j.conectado,
      cartasRestantes: mano.cartasPorJugador[j.id]?.length || 0,
    })),
    legales,
    cartasJugables: cartasBot.map(cartaResumen),
    accionBase,
    chatReciente: estado.chat
      .filter((m) => (m.texto || m.reaccion) && !m.destinatarioId)
      .slice(-8)
      .map((m) => ({
        nombre: estado.jugadores.find((j) => j.id === m.jugadorId)?.nombre,
        texto: m.texto,
        reaccion: m.reaccion,
        evento: m.evento,
        ia: !!m.ia,
      })),
  };
}

function cartaResumen(c: Carta) {
  return {
    id: c.id,
    nombre: nombreCarta(c),
    palo: c.palo,
    numero: c.numero,
    jerarquia: jerarquia(c),
  };
}

async function consultarNvidia(
  contexto: unknown,
): Promise<BotIARespuesta | null> {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(NVIDIA_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("NVIDIA_AI_MODEL") || NVIDIA_MODEL_DEFAULT,
        messages: [
          {
            role: "user",
            content:
              "Sos un bot experto de Truco Argentino. Analizá este estado y devolvé sólo JSON válido, sin markdown.\n\n" +
              JSON.stringify(contexto),
          },
        ],
        max_tokens: 512,
        temperature: 0.35,
        top_p: 0.75,
        frequency_penalty: 0,
        presence_penalty: 0,
        stream: false,
      }),
    });
    if (!res.ok) {
      console.warn("[sala-bot-ia] nvidia status", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return extraerJson(content) as BotIARespuesta | null;
  } finally {
    clearTimeout(timeout);
  }
}

function extraerJson(texto: string): unknown | null {
  const limpio = texto.trim().replace(/^```json\s*/i, "").replace(/```$/i, "");
  try {
    return JSON.parse(limpio);
  } catch {
    const match = limpio.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizarAccion(
  raw: Partial<Accion> | undefined,
  estado: EstadoJuego,
  botId: string,
  legales: AccionTipo[],
): Accion | null {
  if (!raw || typeof raw.tipo !== "string") return null;
  const tipo = raw.tipo as AccionTipo;
  if (!legales.includes(tipo)) return null;
  if (tipo === "jugar_carta") {
    const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
    const cartaId = typeof raw.cartaId === "string" ? raw.cartaId : "";
    if (!cartas.some((c) => c.id === cartaId)) return null;
    return {
      tipo,
      jugadorId: botId,
      cartaId,
      cartaTapada: raw.cartaTapada === true,
    };
  }
  return { tipo, jugadorId: botId };
}

function accionFallbackSegura(
  estado: EstadoJuego,
  botId: string,
  accionBase: Partial<Accion> | undefined,
  legales: AccionTipo[],
): Accion {
  const base = normalizarAccion(accionBase, estado, botId, legales);
  if (base) return base;
  const cartas = estado.manoActual?.cartasPorJugador[botId] || [];
  if (legales.includes("jugar_carta") && cartas[0]) {
    const carta = cartas.slice().sort((a, b) => jerarquia(a) - jerarquia(b))[0];
    return { tipo: "jugar_carta", jugadorId: botId, cartaId: carta.id };
  }
  if (legales.includes("responder_quiero")) {
    return { tipo: "responder_quiero", jugadorId: botId };
  }
  if (legales.includes("cantar_retruco")) {
    return { tipo: "cantar_retruco", jugadorId: botId };
  }
  if (legales.includes("cantar_truco")) {
    return { tipo: "cantar_truco", jugadorId: botId };
  }
  if (legales.includes("cantar_envido")) {
    return { tipo: "cantar_envido", jugadorId: botId };
  }
  if (legales.includes("ir_al_mazo")) {
    return { tipo: "ir_al_mazo", jugadorId: botId };
  }
  return { tipo: "jugar_carta", jugadorId: botId, cartaId: "" };
}

function normalizarChat(raw?: BotIARespuesta["chat"]): ChatIA | null {
  if (!raw) return null;
  const texto = typeof raw.texto === "string"
    ? raw.texto.replace(/\s+/g, " ").trim().slice(0, 160)
    : "";
  const reaccion =
    typeof raw.reaccion === "string" && REACCIONES.includes(raw.reaccion)
      ? raw.reaccion
      : undefined;
  const emocion = typeof raw.emocion === "string" && EMOCIONES.has(raw.emocion)
    ? raw.emocion as MensajeChat["emocion"]
    : "picardia";
  if (!texto && !reaccion) return null;
  return { texto, reaccion, emocion };
}

function chatFallback(estado: EstadoJuego, accion: Accion): ChatIA | null {
  const seed =
    `${estado.salaId}:${estado.version}:${accion.jugadorId}:${accion.tipo}`;
  const n = hash(seed) % 100;
  const prob = accion.tipo === "jugar_carta"
    ? 18
    : accion.tipo.startsWith("cantar")
    ? 45
    : 35;
  if (n >= prob) return null;
  const frases: Record<string, string[]> = {
    jugar_carta: [
      "Te vi venir, primo.",
      "A ver cómo seguís esa.",
      "Tranqui, esta estaba calculada.",
    ],
    cantar_envido: ["Envido, y mirame la cara.", "No arrugues con los tantos."],
    cantar_real_envido: [
      "Real envido. Ahora contá bien.",
      "Te subo la temperatura.",
    ],
    cantar_falta_envido: [
      "Falta envido. Sin pestañear.",
      "Esta mano pide coraje.",
    ],
    cantar_truco: ["Truco, pecho frío.", "Te apuro un poquito."],
    cantar_retruco: ["Retruco. No era gratis.", "Dale, ahora bancatela."],
    cantar_vale4: ["Vale cuatro. Todo o nada.", "Sin llorar después."],
    responder_quiero: ["Quiero. Me gusta el ruido.", "Dale, quiero."],
    responder_no_quiero: [
      "No quiero. Ese chamuyo no entra.",
      "Guardá esa actuación.",
    ],
  };
  const opciones = frases[accion.tipo] || ["Estoy leyendo la mesa."];
  return {
    texto: opciones[n % opciones.length],
    reaccion: undefined,
    emocion: accion.tipo === "responder_no_quiero" ? "enojo" : "picardia",
  };
}

function insertarChatIA(
  estado: EstadoJuego,
  botId: string,
  chat: ChatIA,
) {
  estado.chat.push({
    id: crypto.randomUUID().slice(0, 8),
    jugadorId: botId,
    texto: chat.texto || "",
    reaccion: chat.reaccion,
    ts: Date.now(),
    ia: true,
    emocion: chat.emocion || "picardia",
  });
  if (estado.chat.length > 200) estado.chat.shift();
  estado.version = (estado.version || 0) + 1;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
