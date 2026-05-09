# StepMania Web — Pendiente

Estado al 2026-05-10. La extracción a módulos clásicos está **completa** y el Design System de Movimiento Funcional (paleta turquesa+dorado, `Righteous`+`ABeeZee`, glow sutil) está aplicado a los 3 HTMLs del directorio. El doble-click sobre cualquier `.html` sigue funcionando sin servidor.

## Estado actual

**Funciona end-to-end (mismo comportamiento que antes del refactor):**
- Menú · Pad test (visual/latency/ghost/raw) · AutoStepper · Librería (IndexedDB) · Song select con búsqueda+sort+grados · Diff con modifiers · Play (countdown 3-2-1, motor de timing real, sprites, hit fx, receptor pulse, mine penalty, holds con HOLD_LIFE 300ms) · Results con persistencia de high score
- Settings persistentes: globalOffset (-200..200ms), scrollSpeed (0.5..3x), timingWindow (J4/J5/J6/J7)
- Mods: mirror, left, right, shuffle, hidden, sudden, chartSpeed (0.5..4x)

**Estructura del proyecto modularizado** (en `stepmania-web/`):

| Archivo | Líneas | Contenido |
|---|---|---|
| `css/styles.css` | 421 | CSS completo + bloque `:root` con variables MF |
| `js/core.js` | 165 | utils + audioCtx + gamepad polling + IndexedDB (songs+scores) + settings persistence + `TIMING_WIN_LABEL` |
| `js/parser.js` | 160 | `parseSscOrSm` + `buildTimingEngine` (BPMS+STOPS+DELAYS+WARPS) + `parseNotesToEvents` + `quantColorFor` |
| `js/autostepper.js` | 575 | Queue + drop zone + decode/envelope/ODF/BPM/offset + chart gen + presets + `saveAllToLibrary` + `downloadAllZip` + ZIP encoder |
| `js/library.js` | 81 | `refreshLibrary`, `deleteSong`, importInput change handler |
| `js/song-select.js` | 138 | `selectedSong`/`selectedChart`/`activeMods`, `refreshSongs`, `renderSongList`, `selectSong`/`playSong`, `renderDiffScreen`, search/sort bindings, `applyModsToLane`, `_shufflePerm`, `rerollShuffle` |
| `js/pad-test.js` | 160 | LED grid init, tab bindings, `padCounts`, `padTestLoop`, `resetPadCounts`, latency, ghost |
| `js/game.js` | 536 | Timing windows (J4..J7), sprite cache, `startGame`/`runCountdown`/`stopGame`, `onKeyDown`/`onKeyUp`, `gameLoop`, `handleLanePress`, `render`, `endGame` |
| `js/app.js` | 51 | `SCREENS`, `CRUMBS`, `goto`, `bindSettingsControls`, kickoff (`pollGamepad`+`padTestLoop`+`goto('menu')`) |

**HTMLs hermanos con design system MF aplicado:**

- `stepmania-web.html` (366 líneas, entry slim)
- `test-alfombra.html` (1087 líneas, monolítico standalone)
- `autostepper.html` (1801 líneas, monolítico standalone)

Los 3 importan `'Righteous'` + `'ABeeZee'` desde Google Fonts y usan el mismo bloque `:root` con la paleta MF (turquesa primary, dorado highlights, rosa crítico, grises neutros, verde/naranja/rojo semánticos). Los selectores funcionales del juego (`#gameCanvas`, `.gameHUD`, `.judgment.*`, `.grade-*`, `.log .*`) preservan colores arcade hardcoded.

Orden de carga en `stepmania-web.html`:

```
core.js → parser.js → autostepper.js → library.js → song-select.js → pad-test.js → game.js → app.js
```

Notas del refactor:
- Sin `import/export` — cada función/global vive en `window` automáticamente vía `<script>` clásico.
- Los bindings DOM (drop zone, importInput, tabs, presets, song search/sort, mods toggles) corren cuando se evalúa cada módulo, que ya está al final del body — DOM listo siempre.
- `pollGamepad()`, `padTestLoop()` y `goto('menu')` se llaman desde `app.js` (último script) para garantizar que todas las funciones existen.
- Verificado: `node --check` pasa los 8 módulos sin errores de sintaxis. Cero duplicados de globales entre módulos.

## Pendiente: implementación — Parser/Timing

- **Per-chart OFFSET override**: SSC permite `#OFFSET` dentro de `#NOTEDATA`. Hoy `buildTimingEngine` ya lo respeta (lee de chartHeader primero) — falta validar con un .ssc real que lo use.
- **Lift notes (`L`)**: ahora caen a `tap`. Real: el judge se evalúa en el RELEASE, no en el press.
- **Fake notes (`F`)**: ahora caen a `tap`. Real: se renderizan pero no cuentan para score/combo.
- **Attacks** (`#ATTACKS`): modifiers temporales que se aplican durante una sección. No implementado.
- **Tickcounts** (`#TICKCOUNTS`): afecta el scoring de holds (cuántos ticks por beat). Hoy holds dan +200 fijo si OK.
- **Combos** (`#COMBOS`): multiplier de score por sección. No implementado.
- **Speeds** (`#SPEEDS`): speed mod local por sección con interpolación. Hoy se usa scroll plano.
- **Scrolls** (`#SCROLLS`): scroll multiplier por sección (puede ir negativo = reverse). No implementado.
- **Fakes** (`#FAKES`): secciones que no cuentan para score. No implementado.
- **`.sm` legacy** (sin `#NOTEDATA`): el parser ya tiene fallback que lee el `#NOTES:type:desc:diff:meter:radar:notes` flat. Validar con un .sm real de StepMania 3.9.

## Pendiente: implementación — AutoStepper

- **Detección de BPM variable** (mencionado en CLAUDE.md): ahora autocorrelación devuelve un BPM constante. Para canciones con cambios reales se necesitaría sliding-window BPM con tracking de fase.
- **Banner art**: bloqueado por CORS desde navegador. Idea: generar SVG procedural con hash del título + gradiente.
- **Update mode**: re-generar charts conservando BPM/offset que el usuario afinó a mano (leer .ssc existente, reusar `#BPMS`/`#OFFSET`). Mencionado en CLAUDE.md.
- **Edit manual de BPM/offset por canción**: hoy se establece una sola vez al importar/crear. Útil para corregir detecciones malas.

## Pendiente: implementación — Visual

- **NoteSkin real**: hoy las flechas se dibujan como polígono en canvas. Cargar texturas PNG (DownArrow.png estilo ITG) sería más auténtico.
- **Hold body fijo**: hoy el body del hold se mueve junto con la cabeza. Real: la cabeza se queda en el receptor mientras estás presionando, el body se "consume" desde abajo.
- **Hit explosions con partículas**: hoy es solo un anillo radial. Sprites/partículas mejorarían el feel.
- **Hold caps proper**: la "tail cap" actual es un triángulo. ITG real tiene un cap específico con animación.
- **Beat pulse a quarter-note**: hoy pulsa a cada beat (incluyendo intra-measure). Más sutil sería solo cada negra.
- **Lane covers gráficos**: la lógica `hidden`/`sudden` está en alpha. Falta render de barras opacas reales arriba/abajo de la pantalla (estilo Stepmania).
- **Stealth/Dark mods**: completar set ITG.
- **BG video / animations**: campos `#BGCHANGES` se ignoran. Soporte mínimo de cambio de imagen al menos.

## Pendiente: implementación — UX

- **Preview de audio en hover** de canción en song-select (decodificar `sampleStart`, reproducir ~15s con fade in/out).
- **Filtros adicionales** en song-select: por rating de dificultad, por presencia de mods compatibles, por grade obtenido.
- **Eliminar high score individual** (hoy solo se sobreescribe si es mejor).
- **Pantalla de calibración dedicada**: metrónomo + tap como en `test-alfombra.html` pestaña Sync, escribiendo el resultado a `settings.globalOffset`.
- **Auto-detectar latency**: usar `audioCtx.outputLatency` + `baseLatency` como punto de partida.
- **Storage indicator**: mostrar cuántos MB ocupa la librería en IndexedDB (`navigator.storage.estimate()`).
- **Backup/restore**: export de toda la DB como ZIP (canciones + scores + settings) para mover entre máquinas.
- **Tags / playlists** sobre canciones.
- **Import recursivo de packs SM**: arrastrar una carpeta entera con subcarpetas conteniendo `.ssc`+audio.

## Pendiente: implementación — Modos avanzados

Mencionado en CLAUDE.md como "lo que NO replicaríamos", pero si el alcance crece:
- **Couple / Double** (8 carriles, 2 jugadores). Requiere detección de 2 gamepads simultáneos, layout 8 lanes, mapping P1/P2.
- **Edit mode** (chart editor). Mucho trabajo. Probablemente un proyecto aparte.
- **Mods visuales avanzados** (drunk, beat, twirl, dizzy, etc.) — mucho match con shaders.
- **Lua theming**: fuera de alcance.

## Pendiente: testing

- Validar `buildTimingEngine` contra `TimingData::GetElapsedTimeFromBeat` en `c:\SOFTWARE\stepmania\src\TimingData.cpp` con un set de charts conocidos.
- Test con BPM changes reales (ej. canciones DDR con cambios 80→160).
- Test con stops (canciones con pausas dramáticas — DDR `Healing Vision`).
- Test con warps (charts modernos de Etterna).
- Probar con `.sm` legacy (sin `#NOTEDATA`, formato 3.9 — abundante en packs viejos).
- Verificar que `globalOffset` y `chartSpeed` se aplican correctamente en combinación con shuffle.

## Pendiente: despliegue

- **Dominio destino**: `stepmania.movimientofuncional.app` (subdominio del sitio principal de Movimiento Funcional, mencionado en `CLAUDE.md`).
- **Credenciales del host**: en `.env.local` en la raíz del proyecto. **Nunca commitear** — el archivo está ignorado por `.gitignore` (regla `.env.*`).
- **Estrategia de despliegue**: la app es 100% estática (HTML+CSS+JS sin servidor). Cualquier hosting de archivos estáticos funciona (Netlify, Vercel, Cloudflare Pages, GitHub Pages, FTP a un VPS). El subdominio sugiere que ya hay infraestructura — leer `.env.local` para detectar el provider y usar su CLI/API correspondiente.
- **Estructura a subir**: la raíz `d:\SOFTWARE\stepmania-web\` con `stepmania-web.html` como entry, junto con la carpeta `stepmania-web/` (css + js) y los HTMLs hermanos `test-alfombra.html` + `autostepper.html`. NO subir `stepmania-5_1-new/` (referencia oficial, ~MB grandes), `design-system/` (skill local), ni archivos de configuración (`CLAUDE.md`, `PENDING.md`, `.env.local`).
- **`index.html`**: el entry destino debería ser `stepmania-web.html` renombrado a `index.html` o un redirect, para que la URL raíz cargue directamente.

## Notas arquitectónicas

- Globales compartidos entre módulos (sin import/export): `audioCtx`, `gamepadButtonState`, `gamepadJustPressed`, `dbPromise`, `settings`, `selectedSong`, `selectedChart`, `activeMods`, `gameState`, `queue`, `_allSongsCache`, `_shufflePerm`. Con scripts clásicos esto va vía `window` automáticamente.
- Si en el futuro se quiere migrar a ES modules: hace falta servidor HTTP local (`python -m http.server 8000`), no funciona con `file://` por CORS de imports.
- El `stepmania/` (oficial, MIT) está como referencia. Archivos clave para alinear comportamiento:
  - `src/TimingData.cpp` — beat↔time, BPMS/STOPS/DELAYS/WARPS
  - `src/NotesLoaderSSC.cpp` / `NotesLoaderSM.cpp` — parsers de referencia
  - `src/Player.cpp` — judging, holds, mines
  - `src/NoteData.cpp` — estructura interna del chart
