// Genera identificadores de sala con jerga truquera. La idea es que los primos
// compartan "vení a jugar a fernet-y-mazo" en vez de un código random tipo
// "xK9pQ". Ante colisión repite con sufijo numérico.

const ALIASES = [
  "fernet-y-mazo",
  "fernet-y-yapa",
  "anchito-bravo",
  "anchito-pelado",
  "anchito-de-espada",
  "siete-vieja",
  "siete-bravo",
  "siete-de-oro",
  "olorosa-criolla",
  "olorosa-falsa",
  "rabona-larga",
  "rabona-criolla",
  "sota-loca",
  "sota-pelada",
  "mazo-pelado",
  "envido-falso",
  "envido-largo",
  "real-envido",
  "falta-envido",
  "truco-pelado",
  "truco-bravo",
  "vale-cuatro",
  "carpeta-larga",
  "picardia-criolla",
  "picardia-pura",
  "yapa-final",
  "puntazo-bravo",
  "puntazo-final",
  "matraca-larga",
  "bocha-fina",
  "asadito-largo",
  "asadito-criollo",
  "manilla-corta",
  "rey-del-monte",
  "caballo-rabona",
  "mano-y-pie",
  "ancho-pelado",
  "viejas-bravas",
  "verdes-que-secan",
  "verdes-secas",
  "embocada-larga",
  "criolla-picara",
  "matrera-vieja",
  "no-quiero-ni-ver",
  "mucha-cancha",
  "buena-flor",
  "cara-rota",
  "tirando-a-matar",
  "tres-de-espada",
  "siete-falso",
  "vino-y-mazo",
  "yapa-criolla",
  "primo-bravo",
  "primo-rabona",
  "olor-a-fernet"
];

export function generarAliasSala(yaUsados: Set<string>): string {
  const baraja = ALIASES.slice();
  // Fisher-Yates: barajamos para que no caiga siempre el mismo orden.
  for (let i = baraja.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [baraja[i], baraja[j]] = [baraja[j], baraja[i]];
  }
  for (const a of baraja) {
    if (!yaUsados.has(a)) return a;
  }
  // Si todos están ocupados (poco probable: hay >50), agregamos sufijo.
  for (let n = 2; n < 1000; n++) {
    for (const a of baraja) {
      const candidato = `${a}-${n}`;
      if (!yaUsados.has(candidato)) return candidato;
    }
  }
  // Último recurso.
  return `sala-${Date.now().toString(36)}`;
}
