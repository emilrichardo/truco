# Scripts

## `subir-jugadores-supabase.ts` — optimizar y subir avatares

Genera WebP livianos desde `public/jugadores` y los sube al bucket público
`jugadores` de Supabase Storage.

```sh
npm run avatars:optimize  # sólo genera .generated/jugadores
npm run avatars:upload    # optimiza y sube a Supabase
```

Variables:

```sh
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_JUGADORES_BUCKET=jugadores
AVATAR_WIDTH=360
AVATAR_QUALITY=74
```

Después de reemplazar imágenes, cambiá `NEXT_PUBLIC_JUGADORES_VERSION` para
bustear cache del CDN.

## `generar-voces.ts` — generar clips de voz con ElevenLabs

Genera los MP3 de cada canto del truco (envido, truco, vale 4, quiero, etc.)
con voces latinas argentinas, priorizando un tono norteño tipo Tucumán,
Santiago del Estero, Córdoba y Salta.

### Pasos

1. **Conseguí una API key de ElevenLabs**
   - Crear cuenta en https://elevenlabs.io (free tier alcanza)
   - Settings → API Keys → Create Key
   - Free tier: 10.000 chars/mes. Una corrida usa ~700 chars.

2. **Correr el script** desde la raíz del proyecto:

   ```sh
   ELEVENLABS_API_KEY=sk_xxx npm run voices:generate
   ```

3. **Ver los archivos generados**:

   ```
   public/audio/voces/
   ├── lalo/
   │   ├── envido/01.mp3 02.mp3 ...
   │   ├── truco/01.mp3 ...
   │   ├── ...
   │   └── envido_puntos/00.mp3 ... 33.mp3
   └── juan/
       └── ... (igual)
   ```

4. **Commit y push**:

   ```sh
   git add public/audio
   git commit -m "feat: clips de voz generados"
   git push
   ```

   Una vez deployado en Vercel, las voces se reproducen automáticamente
   cuando alguien canta. El sistema elige una variación al azar entre
   los archivos disponibles para que no suene siempre igual.

### Para un acento más fiel al norte argentino

ElevenLabs no siempre ofrece un preset explícito "santiagueño", "salteño"
o "tucumano" por nombre, pero la **Voice Library** tiene voces compartidas
por la comunidad, algunas etiquetadas como argentinas o del NOA.

1. Andá a https://elevenlabs.io/app/voice-library
2. Filtrá por: `language: spanish`, `accent: argentine`, `gender: male`
3. Probá voces y agregá las que te gusten a tu cuenta (botón **+**)
4. Copiá los voice IDs (en cada voz hay un botón "Copy Voice ID")
5. Editá `scripts/generar-voces.ts` y reemplazá los IDs en la constante
   `VOCES` con los nuevos
6. Borrá `public/audio/` y volvé a correr el script

### Idempotencia

El script saltea archivos que ya existen. Para regenerar uno:

```sh
rm public/audio/voces/lalo/envido/01.mp3
ELEVENLABS_API_KEY=sk_xxx npm run voices:generate
# ahora regenera solo ese archivo
```

### Editar las frases

Las frases vienen importadas de [`src/lib/truco/frases.ts`](../src/lib/truco/frases.ts)
— el motor del juego usa el mismo módulo para los anuncios del chat,
así que voces y texto quedan siempre sincronizados. Si querés cambiar
qué dice un canto, editá ese archivo y volvé a correr el script con
`FORCE=1` para regenerar los MP3s afectados:

```sh
SOLO_CANTOS=truco,retruco FORCE=1 ELEVENLABS_API_KEY=sk_xxx npm run voices:generate
```

### Voice settings ("cantadito")

En el script, `VOICE_SETTINGS` controla el tono emocional:

| Setting | Valor actual | Efecto |
|---|---|---|
| `stability` | 0.15 | Bajo = más expresivo / dramático |
| `style` | 0.95 | Alto = empuje emocional |
| `similarity_boost` | 0.7 | Fidelidad al timbre original |
| `use_speaker_boost` | true | Mejora claridad |

Subir `style` a 0.8+ exagera la emoción (puede sonar caricaturesco).
Bajar `stability` a 0.15 da un canto más "cantadito" pero arriesgás
artefactos.
