// ============================================================================
//  GAME ENGINE (Player) — countdown → audio start → main loop with lane
//  judging, holds/rolls lifecycle, mine penalty, render (receptors, holds,
//  notes, hit FX, beat pulse), and end-of-song scoring + persistence.
//  Timing windows scale per settings.timingWindow (J4..J7 = SM5/ITG presets).
// ============================================================================

// ============================================================================
// DIAG TEMPORAL — instrumentación de volumen (2026-05-15).
// Inserta un AnalyserNode passthrough entre src y destination, loguea RMS +
// peak + rango rolling 5s cada 1s a la consola. Si Δ > 6 dB marca ⚠️INESTABLE.
// El AnalyserNode no modifica la señal (es passthrough). Quitar tras detectar
// la causa del "volumen variable durante playback".
// ============================================================================
function _instrumentAudio(src, ctx, label) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  src.connect(analyser);
  analyser.connect(ctx.destination);
  const buf = new Float32Array(analyser.fftSize);
  const window5s = [];
  let logCounter = 0;
  const interval = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sumSq = 0, peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      sumSq += v * v;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    const now = ctx.currentTime;
    window5s.push({ t: now, rms });
    while (window5s.length && now - window5s[0].t > 5) window5s.shift();
    let minR = window5s[0].rms, maxR = window5s[0].rms;
    for (const x of window5s) { if (x.rms < minR) minR = x.rms; if (x.rms > maxR) maxR = x.rms; }
    const toDB = v => 20 * Math.log10(Math.max(v, 1e-9));
    const delta = toDB(maxR) - toDB(minR);
    if (++logCounter % 2 === 0) {
      const alert = delta > 6 ? '  ⚠️INESTABLE' : '';
      console.log(
        `[SINCRO-AUDIO] ${label} t=${now.toFixed(1)}s rms=${toDB(rms).toFixed(1)}dB peak=${toDB(peak).toFixed(1)}dB ` +
        `roll5s ${toDB(minR).toFixed(1)} → ${toDB(maxR).toFixed(1)} (Δ=${delta.toFixed(1)}dB)${alert}`
      );
    }
  }, 500);
  return {
    cleanup() {
      clearInterval(interval);
      try { src.disconnect(analyser); } catch(e){}
      try { analyser.disconnect(ctx.destination); } catch(e){}
    }
  };
}

// Base windows match SM5 J5 (in seconds); scale with TIMING_SCALE per judge level.
const TIMING_BASE = {
  marvelous: 0.0225, perfect: 0.045, great: 0.090, good: 0.135, bad: 0.180, mine: 0.071
};
const TIMING_SCALE = { j4: 1.50, j5: 1.00, j6: 0.84, j7: 0.66 };
function getTimingWindows() {
  const k = TIMING_SCALE[settings.timingWindow] || 1.0;
  const r = {};
  for (const t in TIMING_BASE) r[t] = TIMING_BASE[t] * k;
  return r;
}
const SCORES = { marvelous: 1000, perfect: 800, great: 500, good: 200, bad: 50, miss: 0 };
const HOLD_LIFE = 0.300; // seconds you can release before hold goes NG (StepMania default ~0.3s)

// All lane-count-dependent constants live here. Single source of truth.
//   4 — dance-single (cardinals)
//   6 — dance-solo  (cardinals + ↖ ↗)             column order: L ↖ U D ↗ R
//   8 — dance-double (cardinals + 4 diagonals)    column order: L ↖ ↙ U D ↗ ↘ R
// keyMap uses event.code (ArrowLeft, KeyQ...). padMap maps lane→gamepad button index.
const LANE_CONFIGS = {
  4: {
    lanes: 4,
    keyMap:    ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'],
    padMap:    [0, 1, 2, 3],
    rotations: [-90, 180, 0, 90],
    tints:     ['#ff006e', '#3a86ff', '#00ff64', '#ffbe0b'],
    mirrorPerm:[3, 2, 1, 0],
    leftPerm:  [1, 3, 0, 2],
    rightPerm: [2, 0, 3, 1],
    label:     'Single (4)',
    stepType:  'dance-single'
  },
  6: {
    lanes: 6,
    keyMap:    ['ArrowLeft', 'KeyQ', 'ArrowUp', 'ArrowDown', 'KeyE', 'ArrowRight'],
    padMap:    [0, 4, 2, 1, 5, 3],
    rotations: [-90, -45, 0, 180, 45, 90],
    tints:     ['#ff006e', '#a259ff', '#00ff64', '#3a86ff', '#ffbe0b', '#ff8800'],
    mirrorPerm:[5, 4, 3, 2, 1, 0],
    leftPerm:  [3, 0, 5, 1, 2, 4],   // approx CCW: down→left, ul→down, etc
    rightPerm: [1, 3, 4, 0, 5, 2],   // approx CW
    label:     'Solo (6)',
    stepType:  'dance-solo',
    _diagonalLayout: 'up'
  },
  // Variante de Solo (6) para alfombras que tienen solo diagonales
  // inferiores (típico en mats baratos de 6 botones: cardinales + ↙ ↘).
  // Las flechas diagonales en pantalla apuntan ↙ y ↘ (rotaciones -135° y
  // 135°) en lugar de ↖ y ↗. Misma paleta de colores que el 6 estándar para
  // que la usuaria sienta continuidad visual entre cardinales y diagonales.
  // El motor selecciona esta config automáticamente cuando el mat-mapping
  // del usuario tiene downLeft+downRight asignados pero no upLeft+upRight.
  '6-down': {
    lanes: 6,
    keyMap:    ['ArrowLeft', 'KeyQ', 'ArrowUp', 'ArrowDown', 'KeyE', 'ArrowRight'],
    padMap:    [0, 6, 2, 1, 7, 3],
    rotations: [-90, -135, 0, 180, 135, 90],
    tints:     ['#ff006e', '#a259ff', '#00ff64', '#3a86ff', '#ffbe0b', '#ff8800'],
    mirrorPerm:[5, 4, 3, 2, 1, 0],
    leftPerm:  [3, 0, 5, 1, 2, 4],
    rightPerm: [1, 3, 4, 0, 5, 2],
    label:     'Solo (6) ↙↘',
    stepType:  'dance-solo',
    _diagonalLayout: 'down'
  },
  8: {
    lanes: 8,
    keyMap:    ['ArrowLeft', 'KeyQ', 'KeyZ', 'ArrowUp', 'ArrowDown', 'KeyE', 'KeyC', 'ArrowRight'],
    padMap:    [0, 4, 6, 2, 1, 5, 7, 3],
    rotations: [-90, -45, -135, 0, 180, 45, 135, 90],
    tints:     ['#ff006e', '#a259ff', '#ff66c4', '#00ff64', '#3a86ff', '#ffbe0b', '#ff8800', '#00f5d4'],
    mirrorPerm:[7, 6, 5, 4, 3, 2, 1, 0],
    leftPerm:  [4, 1, 0, 3, 5, 7, 6, 2],
    rightPerm: [3, 1, 7, 6, 0, 5, 2, 4],
    label:     'Full (8)',
    stepType:  'dance-double',
    _diagonalLayout: 'both'
  }
};
function getActiveLaneConfig(nativeLanes) {
  // Runtime decides lane count via mods. Default is always 4 (clásico), the
  // chart's nativeLanes is just the "master" complexity from which we
  // redistribute. Authoring at 8 + playing default 4 = compress 8→4 every play.
  //
  // Para Solo (6), consultamos la calibración de la alfombra del usuario:
  // si tiene solo diagonales inferiores asignadas (mat barato 6-button), el
  // motor devuelve la variante '6-down' para que las flechas en pantalla
  // apunten ↙↘ en vez de ↖↗ — la usuaria pisa donde su lona dice y juega
  // sin volver la alfombra del revés. Si tiene las superiores (o ambas, o
  // ninguna), devolvemos el Solo canónico DDR (↖↗).
  if (typeof activeMods !== 'undefined') {
    if (activeMods.full) return LANE_CONFIGS[8];
    if (activeMods.solo) {
      const layout = (typeof window !== 'undefined' && window.MatLayout)
        ? window.MatLayout.detectMatDiagonalLayout()
        : 'up';
      return layout === 'down' ? LANE_CONFIGS['6-down'] : LANE_CONFIGS[6];
    }
  }
  return LANE_CONFIGS[4];
}

// Mapa columna→rol de calibración. Los roles ('left', 'upLeft', etc.) son los
// que guarda test-pad.html en localStorage['mat-mapping']. Imprescindible para
// que un pad recalibrado (alfombras chinas, ImpactDX, Cobalt Flux…) funcione
// en el juego: sin esto, el motor lee `padMap` hardcoded y las diagonales que
// el usuario asignó a botones distintos no se reconocen.
//
// Indexado por (lanes, _diagonalLayout) porque el Solo (6) tiene dos
// variantes según qué diagonales tenga la alfombra: la columna 1 puede ser
// 'upLeft' (cabinet DDR) o 'downLeft' (mat barato 6-button), análogo para 4.
function getMatRolesForConfig(cfg) {
  if (cfg.lanes === 4) return ['left', 'down', 'up', 'right'];
  if (cfg.lanes === 8) return ['left', 'upLeft', 'downLeft', 'up', 'down', 'upRight', 'downRight', 'right'];
  if (cfg.lanes === 6) {
    return cfg._diagonalLayout === 'down'
      ? ['left', 'downLeft', 'up', 'down', 'downRight', 'right']
      : ['left', 'upLeft', 'up', 'down', 'upRight', 'right'];
  }
  return null;
}

// Devuelve una COPIA superficial del laneConfig con `padMap` reescrito según la
// calibración del usuario (si existe). Cualquier rol sin asignar conserva el
// valor por defecto de LANE_CONFIGS — degrada gracefully cuando no hay
// calibración o solo se calibraron algunos paneles.
function applyMatCalibrationToConfig(cfg) {
  let mapping = null;
  try {
    const raw = localStorage.getItem('mat-mapping');
    if (raw) mapping = JSON.parse(raw);
  } catch (e) { /* localStorage o JSON corruptos: cae al default */ }
  if (!mapping) return cfg;
  const roles = getMatRolesForConfig(cfg);
  if (!roles) return cfg;
  const padMap = cfg.padMap.slice();
  for (let i = 0; i < roles.length; i++) {
    const btn = mapping[roles[i]];
    if (typeof btn === 'number' && btn >= 0 && btn < 20) padMap[i] = btn;
  }
  return { ...cfg, padMap };
}

let gameState = null;
// Pause state — global de módulo porque togglePause/restartSong/quitToMenu se
// llaman desde el overlay (onclick) y desde onKeyDown. Vive fuera de gameState
// para sobrevivir a stopGame() + startGame() (caso restart) sin tener que
// re-inicializarlo en dos sitios. stopGame() y startGame() lo resetean a
// estado limpio. pausedAtCtxTime guarda el reloj del audioCtx en el momento
// de pausar; al reanudar, calculamos el delta y lo SUMAMOS a gameState.startTime
// para que `audioTime = audioCtx.currentTime - gameState.startTime` siga
// devolviendo el mismo valor que justo antes de pausar (congelación efectiva).
let isPaused = false;
let pausedAtCtxTime = 0;
// LEAD_IN_SEC = duración de la cuenta atrás. El audio arranca al pulsar
// Iniciar y la primera nota llega al receptor LEAD_IN_SEC segundos después
// (durante esos segundos suena la música y el countdown 5→1 se solapa
// encima). Antes eran 3s de delay TRAS un countdown silencioso de 5s = 8s
// totales que se sentían eternos.
const LEAD_IN_SEC = 5.0;
const canvas = document.getElementById('gameCanvas');
const ctx2d = canvas.getContext('2d');
let canvasW = 0, canvasH = 0;
// Sizing del playfield. Modelo "lane-width-first": cada carril intenta tener
// un ancho ideal CONSTANTE (~220 px), y el playfield total crece con
// numLanes. Así un chart Full (8 carriles) ocupa el doble de ancho que un
// chart clásico (4 carriles) pero cada flecha conserva su tamaño en pantalla.
//
//   target     = numLanes × LANE_WIDTH_IDEAL
//   maxPlayfield = canvasW × 0.92        (deja margen para no tocar bordes)
//   minPlayfield = 540                    (mínimo legible incluso en 4 lanes)
//   playfieldW = clamp(minPlayfield, target, maxPlayfield)
//   laneWidth  = playfieldW / numLanes
//   ARROW_SIZE = laneWidth × 0.78         (deja ~22% de respiro entre lanes)
//
// Histórico: antes el playfield era FIJO (clamp 540..1040 sin tocar numLanes)
// para evitar solapar el HUD lateral. El HUD se reubicó a footer hace tiempo
// y esa restricción desapareció, así que el modo Solo/Full ya no necesita
// "comprimir" las flechas.
//
// En portátiles estrechos o tablets, el target puede exceder maxPlayfield;
// el clamp superior reduce proporcionalmente pero el resultado SIGUE siendo
// más grande que el modelo viejo (que estaba clampeado a canvasW × 0.5).
//
// uiScale se mantiene solo para receptorY (margen superior — no afecta a
// la geometría de los lanes).
const LANE_WIDTH_IDEAL = 220;
// Posición del receptor desde el top del canvas (en px, antes del scaling
// por uiScale). Ajustes históricos:
//   - 110 (original)
//   - 70  (2026-05-15: más recorrido visual = más tiempo de reacción)
//   - 90  (2026-05-15 mismo día: la usuaria reportó que los judgments caían
//         demasiado encima del receptor; bajamos 20px para más separación
//         vertical entre el texto "PERFECT/GREAT/..." y los círculos)
// `tiempo de reacción = (canvasH - receptorY) / pps`. A pps=600 (xMod 1.0),
// cada 20px = ~33ms de anticipación. Saldo neto vs original: -20px = +50ms
// (sigue siendo más anticipación que el setup pre-2026-05-15).
// Si se cambia, mantener sincronizado en TODOS los usos
// (`updateComboMeter` lo usa también para posicionar el combo meter
// JUSTO ENCIMA del receptor).
const RECEPTOR_Y_BASE = 90;
let uiScale = 1;
let playfieldW = 540;
let ARROW_SIZE = 56;
function recomputePlayfieldSize() {
  uiScale = Math.max(1, Math.min(1.6, canvasW / 1100));
  const numLanes = (gameState && gameState.laneConfig) ? gameState.laneConfig.lanes : 4;
  const target = numLanes * LANE_WIDTH_IDEAL;
  const maxPlayfield = canvasW * 0.92;
  playfieldW = Math.max(540, Math.min(target, maxPlayfield));
  ARROW_SIZE = Math.round((playfieldW / numLanes) * 0.78);
  buildArrowSprites();
}
function resizeCanvas() {
  // Reservamos 52px abajo para el footer .gameHUD, que es position:fixed.
  // Sin esto las notas que aún no han llegado al receptor (viven en la mitad
  // inferior del canvas mientras caen) se ocultarían tras el footer.
  const HUD_FOOTER_H = 52;
  canvasW = canvas.width = window.innerWidth;
  canvasH = canvas.height = Math.max(200, window.innerHeight - HUD_FOOTER_H);
  recomputePlayfieldSize();
}
window.addEventListener('resize', resizeCanvas);

// ----- Pre-rendered arrow sprite cache (rotated per lane) -------------------
// Cache key is rotation+color (not lane index) so the same rotation is
// reused across configs (e.g. lane 0 in single and lane 0 in solo are both
// the "left" arrow at -90°). Sprites get rebuilt on canvas resize.
const arrowSpriteCache = new Map();
function buildArrowSprites() { arrowSpriteCache.clear(); }

// Optional user-uploaded NoteSkin PNG. If present, overrides the polygonal
// sprite. Color tint is applied via 'source-atop' overlay so quant colors
// still work. Persisted in localStorage as a dataURL.
const NOTESKIN_KEY = 'stepmania-web-noteskin';
let noteskinImage = null;
(function loadNoteskinIfStored() {
  try {
    const stored = localStorage.getItem(NOTESKIN_KEY);
    if (!stored) return;
    const img = new Image();
    img.onload = () => { noteskinImage = img; arrowSpriteCache.clear(); };
    img.src = stored;
  } catch (e) {}
})();
function setNoteskinFromFile(file) {
  if (!file) return;
  const fr = new FileReader();
  fr.onload = () => {
    try { localStorage.setItem(NOTESKIN_KEY, fr.result); } catch (e) {}
    const img = new Image();
    img.onload = () => { noteskinImage = img; arrowSpriteCache.clear(); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function clearNoteskin() {
  try { localStorage.removeItem(NOTESKIN_KEY); } catch (e) {}
  noteskinImage = null;
  arrowSpriteCache.clear();
}

// ----- Optional global background image -------------------------------------
// Persisted as dataURL in localStorage. Falls back to a per-song procedural
// gradient (drawProceduralBg) when nothing is loaded, so the play screen
// never looks like flat black. Video was intentionally removed — too costly
// to drawImage every frame and distracts from the rhythm focus.
const BG_KEY = 'stepmania-web-bg-data';
let bgImage = null;
(function loadStoredBg() {
  try {
    // Cleanup leftover key from older versions that supported video BG
    localStorage.removeItem('stepmania-web-bg-type');
    const data = localStorage.getItem(BG_KEY);
    if (!data) return;
    const img = new Image();
    img.onload = () => { bgImage = img; };
    img.src = data;
  } catch (e) {}
})();
function setBgFromFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      bgImage = img;
      try { localStorage.setItem(BG_KEY, fr.result); } catch(e) {}
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function clearBg() {
  bgImage = null;
  try { localStorage.removeItem(BG_KEY); } catch(e) {}
}

// Per-song procedural background — derives 2 hue values from title hash
// for a unique gradient. Works as a deterministic visual identity per song.
function drawProceduralBg(W, H, title) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) | 0;
  const h1 = ((hash >>> 0) % 360);
  const h2 = ((hash >>> 8) % 360);
  const grad = ctx2d.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `hsl(${h1}, 50%, 8%)`);
  grad.addColorStop(1, `hsl(${h2}, 50%, 4%)`);
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, W, H);
}
function getArrowSprite(rotation, color) {
  const key = rotation + '_' + color + (noteskinImage ? '_png' : '');
  let s = arrowSpriteCache.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = c.height = ARROW_SIZE;
  const cx = c.getContext('2d');
  // PNG noteskin path — draw image rotated, then tint with quant color
  if (noteskinImage) {
    cx.translate(ARROW_SIZE/2, ARROW_SIZE/2);
    cx.rotate(rotation * Math.PI/180);
    cx.drawImage(noteskinImage, -ARROW_SIZE/2, -ARROW_SIZE/2, ARROW_SIZE, ARROW_SIZE);
    // Tint: only paints where the image already has alpha
    cx.globalCompositeOperation = 'source-atop';
    cx.fillStyle = color;
    cx.globalAlpha = 0.55;
    cx.fillRect(-ARROW_SIZE/2, -ARROW_SIZE/2, ARROW_SIZE, ARROW_SIZE);
    arrowSpriteCache.set(key, c);
    return c;
  }
  cx.translate(ARROW_SIZE/2, ARROW_SIZE/2);
  cx.rotate(rotation * Math.PI/180);
  // Up-pointing arrow
  const r = ARROW_SIZE/2 - 4;
  cx.fillStyle = color;
  cx.strokeStyle = '#000';
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(0, -r);                 // tip
  cx.lineTo(r*0.85, -r*0.05);
  cx.lineTo(r*0.40, -r*0.05);
  cx.lineTo(r*0.40,  r*0.85);
  cx.lineTo(-r*0.40, r*0.85);
  cx.lineTo(-r*0.40, -r*0.05);
  cx.lineTo(-r*0.85, -r*0.05);
  cx.closePath();
  cx.fill();
  cx.stroke();
  // Glossy highlight
  cx.fillStyle = 'rgba(255,255,255,0.25)';
  cx.beginPath();
  cx.moveTo(0, -r*0.85);
  cx.lineTo(r*0.55, -r*0.15);
  cx.lineTo(r*0.20, -r*0.15);
  cx.lineTo(r*0.20,  r*0.55);
  cx.lineTo(0, r*0.55);
  cx.closePath();
  cx.fill();
  arrowSpriteCache.set(key, c);
  return c;
}

resizeCanvas();

// ----- Game lifecycle --------------------------------------------------------
// startGame() puede tardar 1-3s entre awaits (resume, arrayBuffer,
// decodeAudioData). Si el usuario navega a otra pantalla durante ese intervalo,
// `goto()` bumpea el navToken — capturamos el token al inicio y verificamos
// tras cada await; si ya no es el actual, abandonamos sin tocar UI ni crear
// gameState. Sin esto, una promesa abandonada terminaba creando un loop
// fantasma sobre la pantalla equivocada.
//
// Errores en decodeAudioData (formato corrupto, OGG en iOS Safari…) se
// capturan en el try/catch externo y se muestran al usuario en la pantalla
// `diff` con mensaje accionable, no como pantalla negra silenciosa.
async function startGame() {
  if (!selectedSong || !selectedChart) { goto('songs'); return; }
  // Reset de pausa al arrancar (cubre restart y entrada desde songs). Sin esto,
  // si la partida anterior quedó pausada y la usuaria pulsó "Salir al menú",
  // el flag isPaused sobreviviría y la siguiente partida arrancaría congelada.
  isPaused = false;
  const _pauseOverlayInit = document.getElementById('pauseOverlay');
  if (_pauseOverlayInit) _pauseOverlayInit.classList.remove('show');
  // body.playing oculta el topbar para liberar pantalla durante la partida.
  // Lo activamos AL INICIO (no al final tras los awaits) para evitar que en
  // restartSong (stopGame que lo quita + startGame que lo pone) el topbar
  // reaparezca durante los ~200-500ms de decodeAudioData. Si startGame
  // aborta o falla, los catch/early-returns lo restauran.
  document.body.classList.add('playing');
  const myNavToken = currentNavToken();
  const aborted = () => !isCurrentNav(myNavToken);
  try {
    resizeCanvas();
    await ensureAudioCtxRunning();
    if (aborted()) return;

    // Decode audio
    const arrayBuf = await selectedSong.audioBlob.arrayBuffer();
    if (aborted()) return;
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0));
    if (aborted()) return;

  // Parse chart from sscText with timing engine
  const parsed = parseSscOrSm(selectedSong.sscText);
  const chartData = parsed.charts.find(c => (c.DIFFICULTY||'').toLowerCase() === selectedChart.key) || parsed.charts[0];
  const tEngine = buildTimingEngine(parsed.header, chartData);
  // Parse #ATTACKS — chart-level overrides song-level. Stored on gameState
  // and applied per-frame in gameLoop. Snapshot user mods so attacks don't
  // permanently mutate them across plays.
  const attacks = parseAttacks((chartData && chartData.ATTACKS) || parsed.header.ATTACKS || '');
  const baseMods = { ...activeMods };
  const parseRes = parseNotesToEvents(chartData.NOTES, tEngine, chartData);
  let notes = parseRes.notes;
  const nativeLanes = parseRes.numLanes;
  // Resolve which lane config we'll actually play with: solo/full mods override
  // the chart's native lane count by REDISTRIBUTING notes; otherwise we play
  // with whatever the chart was authored for.
  const laneConfig = applyMatCalibrationToConfig(getActiveLaneConfig(nativeLanes));
  if (laneConfig.lanes !== nativeLanes) {
    // Redistribute notes from `nativeLanes` to `laneConfig.lanes`. Fixed mode
    // (random per song-id+noteIndex) gives memorable charts; full random mode
    // re-shuffles every play.
    const fixedSeed = !!activeMods.randomFixed;
    const songSeed = (selectedSong.id || 0) + ':' + (selectedSong.title || '');
    // Group hold-tail to its head: same-lane mapping per beat.
    // Approach: for each unique (beat, originalLane) pair pick one new lane
    // and apply it consistently (so head + tail map to same target).
    const remap = new Map();
    notes.forEach((n, idx) => {
      const key = n.beat + ':' + n.lane;
      if (!remap.has(key)) {
        let target;
        if (fixedSeed) {
          let h = 0; const s = songSeed + ':' + key;
          for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
          target = Math.abs(h) % laneConfig.lanes;
        } else {
          target = Math.floor(Math.random() * laneConfig.lanes);
        }
        remap.set(key, target);
      }
      n.lane = remap.get(key);
    });
  }
  // Apply lane permutation modifiers (mirror/left/right/shuffle) on the FINAL lane count
  if (activeMods.shuffle) rerollShuffle(laneConfig.lanes);
  for (const n of notes) n.lane = applyModsToLane(n.lane, laneConfig.lanes);
  // Mark each note with judging/hold state
  for (const n of notes) {
    n.judged = null;
    n.holdState = null;       // 'active' | 'released-grace' | 'ok' | 'ng'
    n.lastHoldHeldAt = null;
  }
  notes.sort((a,b) => a.time - b.time);

  // Compute beat times for receptor pulse
  const beatTimes = [];
  const totalBeats = Math.ceil((audioBuffer.duration + 2) * tEngine.bpmAtBeat(0) / 60);
  for (let b = 0; b < totalBeats; b++) {
    const t = tEngine.beatToTime(b);
    if (t !== null && t >= 0 && t < audioBuffer.duration + 2) beatTimes.push(t);
  }

  // Audio arranca YA al pulsar Iniciar. El countdown 5→1 se pinta DENTRO
  // del canvas del highway (ver render(), bloque "if (audioTime < 0)"),
  // sin overlay HTML encima. Decisión consciente de la usuaria: countdown
  // sobrio integrado en la pista, sin beep ni animación scale-pop.
  // Bug previo (overlay HTML): se duplicaba con cualquier número pintado
  // en canvas y dejaba "1 residual" si la animación no se ocultaba a
  // tiempo. La primera nota llega al receptor cuando audioTime cruza 0
  // (LEAD_IN_SEC=5s tras el src.start).
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  // DIAG TEMPORAL — instrumenta el output (analyser passthrough + log RMS).
  const _diag = _instrumentAudio(src, audioCtx, 'SM');
  // LEAD_IN_SEC declarado a nivel módulo: togglePause() necesita la misma
  // constante al recrear el AudioBufferSourceNode tras una pausa.
  const audioStartAt = audioCtx.currentTime;
  const startAt = audioStartAt + LEAD_IN_SEC;
  src.start(audioStartAt);

  const N = laneConfig.lanes;
  gameState = {
    notes, audioBuffer, src,
    _diag, // DIAG TEMPORAL
    startTime: startAt,
    bpm: selectedSong.bpm,
    timingEngine: tEngine,
    beatTimes,
    duration: audioBuffer.duration,
    score: 0, combo: 0, maxCombo: 0,
    judgments: { marvelous: 0, perfect: 0, great: 0, good: 0, bad: 0, miss: 0 },
    pressedLanes: new Array(N).fill(false),
    keyHeld:      new Array(N).fill(false),
    padPrev:      new Array(N).fill(false),
    flashTime:    new Array(N).fill(0),
    // Flash rojo en el receptor cuando se pierde una nota (no se presionó a
    // tiempo) o cuando se golpea una mine. Es el feedback visual inmediato
    // pegado al receptor — sin esto el jugador solo ve el texto MISS lejos.
    missFlashTime: new Array(N).fill(0),
    hitFx: [],   // {lane, t}
    songInfo: `${selectedSong.title} — ${diffLabel(selectedChart.name)} ★${selectedChart.rating}${laneConfig.lanes !== nativeLanes ? ` · ${laneConfig.label}` : ''}`,
    finished: false,
    pixelsPerSec: computePixelsPerSec(selectedSong.bpm, activeMods.chartSpeed),
    timing: getTimingWindows(),
    attacks,
    baseMods,
    laneConfig,
    nativeLanes,
  };
  // El playfield CRECE con numLanes (target = numLanes × LANE_WIDTH_IDEAL,
  // clamp en canvasW × 0.92). Recomputamos aquí porque gameState.laneConfig
  // acaba de fijarse, así que la fórmula necesita el numLanes correcto. Sin
  // esta llamada, un chart de 8 lanes renderiza sprites pre-cacheados al
  // tamaño de 4 lanes y el playfield queda anchísimo con flechas pequeñas.
  recomputePlayfieldSize();
  document.getElementById('hudSongInfo').textContent = gameState.songInfo;
  document.getElementById('hudScore').textContent = '0';
  document.getElementById('hudCombo').textContent = '0';
  updateComboMeter(0);

  src.onended = () => {
    if (gameState && !gameState.finished) {
      setTimeout(() => endGame(), 500);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  requestAnimationFrame(gameLoop);
  } catch (err) {
    // Cualquier fallo en la cadena async (decodeAudioData con OGG en iOS,
    // arrayBuffer corrupto, parseSscOrSm con chart inválido…) cae aquí.
    // En vez de pantalla negra silenciosa, mostramos el motivo y devolvemos
    // al usuario a la pantalla de dificultad para que pueda elegir otra.
    if (aborted()) return; // navegó fuera mientras cargaba — silencio OK
    console.error('startGame failed:', err);
    const msg = (err && err.name === 'EncodingError')
      ? 'No se pudo decodificar el audio. Formato no soportado por este navegador (prueba MP3 o WAV).'
      : (err && err.message) ? err.message : 'Error desconocido al iniciar la canción.';
    // Toast simple: alert() es invasivo pero garantiza visibilidad. Si en
    // futuro hay sistema de toasts global, reemplazar aquí.
    alert('No se pudo iniciar la canción.\n\n' + msg);
    goto('diff');
  } finally {
    // Si gameState no llegó a asignarse (aborted, decode error, parse error…)
    // restauramos el topbar manualmente — stopGame() no se llama en esos
    // casos. Si la partida arrancó bien, gameState existe y stopGame() ya
    // se encarga al terminar.
    if (!gameState) document.body.classList.remove('playing');
  }
}

// Countdown: NO hay overlay HTML — se pinta dentro del canvas del highway
// con ctx2d.fillText en render() cuando audioTime<0. Decisión consciente:
// overlay HTML grande con beep + scale-pop dejaba "1 residual" al final
// y duplicaba lo que ya tenía el canvas. Mismo patrón que `gh-play.html`.
// Duración del lead-in fijada por LEAD_IN_SEC (5.0s) declarado arriba.

function stopGame() {
  if (!gameState) return;
  // Anular onended ANTES de stop(): src.stop() también dispara onended, y si
  // no lo limpiamos primero queda agendado un setTimeout(endGame) que se
  // ejecuta 500ms después con gameState ya nulo. Funcionaba por defensa
  // interna de endGame, no por diseño — ahora cortamos en origen.
  if (gameState.src) {
    gameState.src.onended = null;
    try { gameState.src.stop(); } catch(e) {}
  }
  // DIAG TEMPORAL — parar el log periódico al cerrar la partida.
  if (gameState._diag) { gameState._diag.cleanup(); gameState._diag = null; }
  // Restore user mods snapshot so attacks don't bleed into the next play
  if (gameState.baseMods) Object.assign(activeMods, gameState.baseMods);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  // Oculta combo meter si quedó visible al salir (pausa / quit antes del
  // endGame natural). Sin esto la siguiente canción arrancaría con el meter
  // mostrando el combo final de la anterior por un frame.
  const cm = document.getElementById('hudComboMeter');
  if (cm) cm.classList.remove('show', 'pulse', 'tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5');
  _comboMeterLast = 0;
  // El countdown se pinta en canvas via render() cuando audioTime<0, así
  // que al anular gameState el render() devuelve early (gameLoop checa
  // `if (!gameState) return;`) y el countdown desaparece en el siguiente
  // frame — sin elemento HTML que limpiar.
  // Reset de pausa: cualquier vía de salida (quit, end natural, navegación
  // fuera) debe dejar el módulo en estado "no pausado" para la próxima partida.
  isPaused = false;
  const _pauseOverlay = document.getElementById('pauseOverlay');
  if (_pauseOverlay) _pauseOverlay.classList.remove('show');
  // Restaurar topbar al salir de la partida — body.playing lo había ocultado.
  document.body.classList.remove('playing');
  gameState = null;
}

// ----- Pause / Restart / Quit (menú de pausa) -------------------------------
// Patrón canónico SM5/ITG arcade: ESC durante la partida abre menú con 3
// opciones (Reanudar / Reiniciar / Salir). El estado de la partida se
// CONGELA — gameLoop sigue corriendo pero entra/sale por el guard isPaused
// sin avanzar la lógica de juicio, holds ni render. El audio se para y se
// recrea al reanudar (Web Audio buffer sources son one-shot).
//
// Truco del shift de startTime: `audioTime = audioCtx.currentTime - startTime`
// es la fórmula maestra del motor. Para que `audioTime` quede congelado en
// `tFreeze` durante la pausa, sumamos la duración pausada a startTime al
// reanudar. Así el reloj efectivo del chart "no sintió" la pausa.
function togglePause() {
  if (!gameState || gameState.finished) return;
  isPaused = !isPaused;
  const overlay = document.getElementById('pauseOverlay');
  if (overlay) overlay.classList.toggle('show', isPaused);

  if (isPaused) {
    // PAUSAR — parar el audio y memorizar el instante. El gameLoop ya
    // estaba en marcha; al detectar isPaused=true en su próxima iteración,
    // hará return temprano sin avanzar lógica.
    pausedAtCtxTime = audioCtx.currentTime;
    if (gameState.src) {
      gameState.src.onended = null; // ver stopGame() para el porqué
      try { gameState.src.stop(); } catch(e) {}
    }
    // DIAG TEMPORAL — parar log durante la pausa (silencio = ruido en el log).
    if (gameState._diag) { gameState._diag.cleanup(); gameState._diag = null; }
    // Focus en "Reanudar" para que ENTER lo dispare (atajo natural). El
    // atributo HTML autofocus no funciona en elementos revelados via toggle
    // de clase — hay que forzarlo manualmente al mostrar el overlay.
    const resumeBtn = document.getElementById('pauseResumeBtn');
    if (resumeBtn) resumeBtn.focus();
  } else {
    // REANUDAR — calcular delta y shiftear startTime para congelar audioTime.
    const pauseDuration = audioCtx.currentTime - pausedAtCtxTime;
    gameState.startTime += pauseDuration;

    // Recrear AudioBufferSourceNode. Los buffer sources son one-shot: una vez
    // stop()'d no pueden reutilizarse. Recreamos a partir del mismo buffer.
    const newSrc = audioCtx.createBufferSource();
    newSrc.buffer = gameState.audioBuffer;
    // DIAG TEMPORAL — reinstrumentar el nuevo source.
    if (gameState._diag) gameState._diag.cleanup();
    gameState._diag = _instrumentAudio(newSrc, audioCtx, 'SM');
    // Nuevo onended con guard de identidad: si la usuaria pausa de nuevo
    // antes de que termine el audio, el viejo onended (este) no debe disparar
    // endGame sobre el nuevo src de la siguiente reanudación.
    newSrc.onended = () => {
      if (gameState && !gameState.finished && gameState.src === newSrc) {
        setTimeout(() => endGame(), 500);
      }
    };
    gameState.src = newSrc;

    // El audio original arrancó en `audioStartAt = startTime - LEAD_IN_SEC`.
    // Tras el shift, ese punto se mueve al futuro junto con startTime, pero
    // el audio YA sonó durante pauseDuration menos los segundos pausados.
    // audioElapsed = cuánto del audio "debería" haber sonado ya, en
    // referencia al startTime nuevo.
    const audioStartAt = gameState.startTime - LEAD_IN_SEC;
    const audioElapsed = audioCtx.currentTime - audioStartAt;
    if (audioElapsed >= 0 && audioElapsed < gameState.audioBuffer.duration) {
      // Caso normal: la canción está sonando → arrancar desde el offset correcto.
      newSrc.start(0, audioElapsed);
    } else if (audioElapsed < 0) {
      // Caso lead-in: la usuaria pausó durante los primeros LEAD_IN_SEC=5s
      // (countdown en canvas, audio sonando). Programar el start en el
      // futuro para que coincida con t=0 del audio al reanudar.
      newSrc.start(audioCtx.currentTime + (-audioElapsed));
    }
    // (audioElapsed >= duration → la canción ya terminó; no recreamos
    // source, el endGame lo manejará el loop al detectar audioTime > duration.)
  }
}

// Reiniciar la canción actual desde el principio. Limpio: stopGame() hace
// teardown completo + reset isPaused; startGame() reaprovecha selectedSong /
// selectedChart / activeMods que viven a nivel módulo en song-select.js.
// NO usamos goto('play') porque eso bumpea el navToken y abortaría el
// startGame que estamos a punto de lanzar (la promise vería isCurrentNav=false
// en su primer await). El currentScreen sigue siendo 'play' — no estamos
// navegando, estamos reiniciando dentro de la misma pantalla.
function restartSong() {
  stopGame();
  startGame();
}

// Salir al menú de dificultad (= comportamiento previo de ESC). Aquí sí
// usamos goto() porque cambiamos de pantalla.
function quitToMenu() {
  stopGame();
  goto('diff');
}

// Exponer al overlay HTML (onclick="togglePause()" etc.)
window.togglePause = togglePause;
window.restartSong = restartSong;
window.quitToMenu  = quitToMenu;

// ----- Inputs soportados ----------------------------------------------------
// Sincro se juega EXCLUSIVAMENTE con alfombra USB (Gamepad API + calibración
// por roles) o con teclado físico como fallback de desarrollo/testing. No hay
// overlay táctil — la landing bloquea explícitamente dispositivos móviles vía
// isCompatibleDevice() (viewport ≥ 1024×600 + pointer:fine). El overlay
// táctil previo se eliminó el 2026-05-15: la heurística rota
// `maxTouchPoints > 0` lo sacaba en monitores Windows con touchscreen
// aunque la usuaria estuviera jugando con alfombra. Si en el futuro alguien
// quiere reintroducirlo, hablar primero — está fuera del producto a propósito.

function onKeyDown(e) {
  if (!gameState || gameState.finished) return;
  // ESC = abrir/cerrar menú de pausa (canónico SM5/ITG arcade). Antes
  // destruía la partida directamente; ahora la usuaria puede Reanudar,
  // Reiniciar o Salir desde el overlay.
  if (e.code === 'Escape') { e.preventDefault(); togglePause(); return; }
  // Durante pausa, ignoramos cualquier otra tecla — no se juzgan pisadas,
  // no se marcan flashes, no se actualiza keyHeld (los holds quedan
  // congelados en el estado pre-pausa hasta que el flujo se reanude).
  if (isPaused) return;
  const lane = gameState.laneConfig.keyMap.indexOf(e.code);
  if (lane === -1) return;
  e.preventDefault();
  if (gameState.keyHeld[lane]) return;
  gameState.keyHeld[lane] = true;
  gameState.pressedLanes[lane] = true;
  gameState.flashTime[lane] = performance.now();
  handleLanePress(lane);
}
function onKeyUp(e) {
  if (!gameState) return;
  // Durante pausa NO procesamos releases: un hold que la usuaria seguía
  // pisando antes de pausar debe sobrevivir a la pausa. Si soltara y volviera
  // a pisar durante el menú, eso es input fantasma que ignoramos.
  if (isPaused) return;
  const lane = gameState.laneConfig.keyMap.indexOf(e.code);
  if (lane === -1) return;
  gameState.keyHeld[lane] = false;
  if (!gamepadButtonState[gameState.laneConfig.padMap[lane]]) {
    gameState.pressedLanes[lane] = false;
    handleLaneRelease(lane);
  }
}

// Lift notes are judged when the player RELEASES the lane (instead of pressing).
// We pick the closest unjudged lift in window, like handleLanePress does.
function handleLaneRelease(lane) {
  if (!gameState || gameState.finished || isPaused) return;
  const audioTime = (audioCtx.currentTime - gameState.startTime) - settings.globalOffset / 1000;
  const T = gameState.timing;
  let best = null, bestDist = Infinity;
  for (const n of gameState.notes) {
    if (n.lane !== lane || n.judged || n.type !== 'lift') continue;
    const dist = Math.abs(audioTime - n.time);
    if (dist < bestDist && dist <= T.bad) { best = n; bestDist = dist; }
  }
  if (!best) return;
  let judg;
  if (bestDist <= T.marvelous) judg = 'marvelous';
  else if (bestDist <= T.perfect) judg = 'perfect';
  else if (bestDist <= T.great)   judg = 'great';
  else if (bestDist <= T.good)    judg = 'good';
  else                             judg = 'bad';
  best.judged = judg;
  gameState.judgments[judg]++;
  gameState.score += SCORES[judg];
  if (judg === 'bad') gameState.combo = 0;
  else { gameState.combo++; gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo); }
  gameState.hitFx.push(makeHitFx(lane, judg));
  showJudgment(judg);
}

function gameLoop() {
  if (!gameState) return;
  // PAUSE GUARD — congelar TODO: lógica de juicio, polling pad, render, holds.
  // Seguimos pidiendo frames para que el motor reanude limpio cuando la
  // usuaria cierre el overlay (con togglePause). Sin requestAnimationFrame
  // aquí, al reanudar tendríamos que re-kickear el loop manualmente. La
  // pantalla queda congelada en el último frame renderizado — feedback
  // visual deseable que indica "estado pausado".
  if (isPaused) { requestAnimationFrame(gameLoop); return; }
  // audioTime adjusted by user calibration (positive globalOffset = user hits late = subtract)
  const audioTime = (audioCtx.currentTime - gameState.startTime) - settings.globalOffset / 1000;
  const T = gameState.timing;

  // Apply per-time #ATTACKS by overriding activeMods. Reset to baseMods first
  // so we don't accumulate stale flags across attack windows.
  if (gameState.attacks && gameState.attacks.length) {
    Object.assign(activeMods, gameState.baseMods);
    for (const a of gameState.attacks) {
      if (audioTime >= a.time && audioTime < a.time + a.len) {
        for (const m of a.mods) activeMods[m] = true;
      }
    }
  }

  // Gamepad input — track press AND release for lift notes
  const padMap = gameState.laneConfig.padMap;
  for (let i = 0; i < gameState.laneConfig.lanes; i++) {
    const padBtn = padMap[i];
    const pressed = gamepadButtonState[padBtn];
    const wasPressed = gameState.padPrev[i];
    if (gamepadJustPressed[padBtn]) {
      gameState.pressedLanes[i] = true;
      gameState.flashTime[i] = performance.now();
      handleLanePress(i);
    }
    if (wasPressed && !pressed && !gameState.keyHeld[i]) {
      handleLaneRelease(i);
    }
    gameState.padPrev[i] = pressed;
    // Combine keyboard + gamepad for hold detection
    gameState.pressedLanes[i] = pressed || gameState.keyHeld[i];
  }

  // Missed taps + mine handling
  for (const n of gameState.notes) {
    if (n.judged) continue;
    if (n.type === 'fake') {
      // Fakes never score; mark them passed once their window closes
      if (audioTime > n.time + T.bad) n.judged = 'fake-pass';
      continue;
    }
    if (n.type === 'mine') {
      if (Math.abs(audioTime - n.time) <= T.mine && gameState.pressedLanes[n.lane]) {
        n.judged = 'mine-hit';
        gameState.score = Math.max(0, gameState.score - 200);
        gameState.combo = 0;
        gameState.missFlashTime[n.lane] = performance.now();
        showJudgment('miss');
      } else if (audioTime > n.time + T.mine) {
        n.judged = 'mine-pass';
      }
      continue;
    }
    if (audioTime - n.time > T.bad) {
      n.judged = 'miss';
      gameState.judgments.miss++;
      gameState.combo = 0;
      gameState.missFlashTime[n.lane] = performance.now();
      showJudgment('miss');
    }
  }

  // Hold/roll lifecycle (with TICKCOUNTS-aware tick scoring)
  for (const n of gameState.notes) {
    if (n.type !== 'hold' && n.type !== 'roll') continue;
    if (!n.judged || n.endTime === null) continue;
    if (!['marvelous','perfect','great','good','bad'].includes(n.judged)) continue;
    if (n.holdState === 'ok' || n.holdState === 'ng') continue;
    if (n.holdState === null) {
      n.holdState = 'active';
      n.lastHoldHeldAt = audioTime;
      n.lastTickAt = n.time; // first tick eligible at note's start time
    }
    if (gameState.pressedLanes[n.lane]) {
      n.lastHoldHeldAt = audioTime;
      if (n.holdState === 'released-grace') n.holdState = 'active';
      // Award +5 per tick interval the user holds correctly
      const interval = n.tickInterval || 0.125; // ~4 ticks/beat at 120bpm
      while (n.lastTickAt + interval <= Math.min(audioTime, n.endTime)) {
        n.lastTickAt += interval;
        gameState.score += 5;
      }
    } else if (n.holdState === 'active') {
      if (audioTime - n.lastHoldHeldAt > HOLD_LIFE) n.holdState = 'released-grace';
    }
    if (audioTime > n.endTime) {
      const heldOk = (n.lastHoldHeldAt !== null && (audioTime - n.lastHoldHeldAt) <= HOLD_LIFE);
      if (heldOk) {
        n.holdState = 'ok';
        gameState.score += 100; // hold completion bonus (ticks already paid above)
      } else {
        n.holdState = 'ng';
        gameState.combo = 0;
      }
    }
  }

  document.getElementById('hudScore').textContent = gameState.score.toLocaleString();
  document.getElementById('hudCombo').textContent = gameState.combo;
  updateComboMeter(gameState.combo);

  render(audioTime);

  if (audioTime > gameState.duration + 1) { endGame(); return; }
  requestAnimationFrame(gameLoop);
}

function handleLanePress(lane) {
  if (!gameState || gameState.finished || isPaused) return;
  const audioTime = (audioCtx.currentTime - gameState.startTime) - settings.globalOffset / 1000;
  const T = gameState.timing;
  let best = null, bestDist = Infinity;
  for (const n of gameState.notes) {
    if (n.lane !== lane || n.judged) continue;
    if (n.type === 'mine' || n.type === 'lift' || n.type === 'fake') continue;
    const dist = Math.abs(audioTime - n.time);
    if (dist < bestDist && dist <= T.bad) { best = n; bestDist = dist; }
  }
  if (!best) return;

  let judg;
  if (bestDist <= T.marvelous) judg = 'marvelous';
  else if (bestDist <= T.perfect) judg = 'perfect';
  else if (bestDist <= T.great)   judg = 'great';
  else if (bestDist <= T.good)    judg = 'good';
  else                             judg = 'bad';
  best.judged = judg;
  gameState.judgments[judg]++;
  // Apply per-section #COMBOS multiplier to score AND combo gain
  const tEng = gameState.timingEngine;
  const curBeat = tEng.timeToBeat ? tEng.timeToBeat(audioTime) : 0;
  const cm = tEng.comboMulAt ? tEng.comboMulAt(curBeat) : 1;
  gameState.score += SCORES[judg] * cm;
  if (judg === 'bad') {
    gameState.combo = 0;
  } else {
    gameState.combo += Math.max(1, Math.round(cm));
    gameState.maxCombo = Math.max(gameState.maxCombo, gameState.combo);
  }
  gameState.hitFx.push(makeHitFx(lane, judg));
  showJudgment(judg);
}

// Perfil de FX por tier de juicio. La idea: clavar la nota debe SENTIRSE
// distinto físicamente a rasparla, no solo cambiar el texto. Cuanto mejor
// el acierto, más espectáculo (más anillos, más partículas, core blanco).
//
// Diseño:
//   - Baseline siempre = anillo blanco exterior + anillo lane-tinted interior
//     (firma visual de SM, no se toca).
//   - Sobre eso, multiplicadores por tier escalan radio, lineWidth, partículas,
//     velocidad y vida. Más opciones discretas: extraRing y coreFlash solo en
//     marvelous para que sea inequívocamente "el bueno".
//   - Las partículas mantienen gravedad real (G=280) — look de fuente clásica
//     de DDR, mejor que las balísticas planas. Solo varía la densidad.
//
// Tier "great" es el baseline neutro (multipliers = 1.0, 8 partículas).
const SM_HIT_PROFILES = {
  marvelous: { duration: 0.42, expandMul: 1.50, lineWidthMul: 1.2, blur: 30,
               particleCount: 16, particleSpeedMul: 1.4, particleLifeMul: 1.4,
               extraRing: true, coreFlash: true },
  perfect:   { duration: 0.38, expandMul: 1.25, lineWidthMul: 1.1, blur: 22,
               particleCount: 12, particleSpeedMul: 1.2, particleLifeMul: 1.2,
               extraRing: false, coreFlash: false },
  great:     { duration: 0.34, expandMul: 1.00, lineWidthMul: 1.0, blur: 16,
               particleCount: 8,  particleSpeedMul: 1.0, particleLifeMul: 1.0,
               extraRing: false, coreFlash: false },
  good:      { duration: 0.28, expandMul: 0.85, lineWidthMul: 0.9, blur: 12,
               particleCount: 5,  particleSpeedMul: 0.9, particleLifeMul: 0.85,
               extraRing: false, coreFlash: false },
  bad:       { duration: 0.22, expandMul: 0.75, lineWidthMul: 0.8, blur: 8,
               particleCount: 3,  particleSpeedMul: 0.85, particleLifeMul: 0.75,
               extraRing: false, coreFlash: false },
};

// Particle burst on hit. Cada partícula tiene velocidad propia + gravedad
// para arco natural (look de fuente DDR clásica). Cleanup en render por edad.
// El número de partículas y su vida/velocidad escalan con el tier (perfil).
function makeHitFx(lane, judg) {
  const profile = SM_HIT_PROFILES[judg] || SM_HIT_PROFILES.great;
  const particles = [];
  const N = profile.particleCount;
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i / N) + (Math.random() - 0.5) * 0.3;
    const speed = (80 + Math.random() * 120) * profile.particleSpeedMul;
    particles.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,    // initial upward bias
      x0: 0, y0: 0
    });
  }
  return { lane, t: performance.now(), kind: judg, particles };
}

// Texto castellano por tier — Sincro habla español. Mantenemos el `judg`
// interno (marvelous/perfect/great/good/bad/miss) intacto para no romper
// SCORES, judgments[], CSS .judgment.{kind} ni el resumen final; solo
// traducimos lo que ve el jugador.
const JUDGMENT_LABELS = {
  marvelous: 'EXCELENTE',
  perfect:   'PERFECTO',
  great:     'GENIAL',
  good:      'BIEN',
  bad:       'MAL',
  miss:      'FALLO',
};

function showJudgment(judg) {
  // TODOS los juicios se muestran (incluido FALLO) porque el usuario necesita
  // saber qué pasó al pulsar — sin canal "verbal" se confunde "no llegué a
  // tiempo" con "no se registró mi input". La X + contracción del receptor
  // (animación visual en render()) sigue ocurriendo Y AHORA además se imprime
  // el texto, redundancia intencional para clavar el feedback.
  const el = document.getElementById('hudJudgment');
  if (!el) return;
  el.textContent = JUDGMENT_LABELS[judg] || judg.toUpperCase();
  // Re-trigger CSS animation: limpiamos la clase un frame y la re-aplicamos.
  // Sin esto, dos juicios consecutivos del mismo tier no re-disparan el pop.
  el.className = 'judgment';
  // Force reflow para que el navegador "vea" el cambio de clase antes del show.
  void el.offsetWidth;
  el.className = 'judgment show ' + judg;
  // Posición 10px por encima del borde superior del receptor (no del centro).
  // Medimos `offsetHeight` RUNTIME — el judgment tiene altura variable por
  // tier (marvelous 3.8em vs bad 2.6em); un valor fijo desbordaba por arriba
  // en tiers pequeños y dejaba demasiado hueco en grandes. Consultar
  // offsetHeight tras aplicar `className = 'judgment show ${judg}'` fuerza
  // un layout síncrono que devuelve la altura ya con el font-size del tier.
  //   centro_judgment = receptorTop - 10 - halfH
  // Clamp `max(halfH+2, ...)` asegura que el BORDE SUPERIOR del judgment
  // (en `centro - halfH`) quede al menos 2px dentro del canvas — sin
  // desbordar arriba aunque el receptor esté muy cerca del top.
  const receptorY = Math.round(RECEPTOR_Y_BASE * uiScale);
  const receptorTop = receptorY - ARROW_SIZE / 2;
  const halfH = (el.offsetHeight || 50) / 2;
  el.style.top = Math.max(halfH + 2, receptorTop - 10 - halfH) + 'px';
  setTimeout(() => { if (el.classList) el.classList.remove('show'); }, 700);
}

// Combo meter (estilo SM clásico). Visible a partir de combo ≥ 4 — los
// primeros aciertos no merecen UI dedicada (sería ruido constante al inicio).
// Cinco tiers visuales escalonados: 4 / 50 / 100 / 200 / 500. El pulse se
// dispara SOLO cuando el combo crece (no en cada frame del gameLoop), así la
// animación no se reinicia perpetuamente. `_lastShown` recuerda el último
// valor pintado para detectar cambios; si el combo se rompe a 0, oculta y
// limpia tiers — el siguiente combo arranca desde tier-1 limpio.
let _comboMeterLast = 0;
function comboTierFor(c) {
  if (c >= 500) return 5;
  if (c >= 200) return 4;
  if (c >= 100) return 3;
  if (c >=  50) return 2;
  return 1;
}
function updateComboMeter(combo) {
  const el = document.getElementById('hudComboMeter');
  if (!el) return;
  const num = document.getElementById('hudComboNumber');
  // Threshold de visibilidad: 4. Antes de eso, el meter no aparece — los
  // primeros aciertos los celebra el texto de juicio (EXCELENTE/PERFECTO),
  // no necesitan racha redundante. Si el combo cae bajo el umbral (incluido
  // a 0), oculta y limpia clases.
  if (combo < 4) {
    if (el.classList.contains('show')) {
      el.classList.remove('show', 'pulse', 'tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5');
    }
    _comboMeterLast = combo;
    return;
  }
  if (combo === _comboMeterLast) return; // sin cambios — gameLoop tick sin hit
  num.textContent = combo;
  // Aplica tier correcto y limpia los demás. La transición de tier coincide
  // con el pulse, así un combo 50 entra con halo dorado pulsando.
  const tier = comboTierFor(combo);
  for (let i = 1; i <= 5; i++) el.classList.toggle('tier-' + i, i === tier);
  el.classList.add('show');
  // Re-trigger del pulse: quitar la clase, force reflow, reañadir. Mismo
  // patrón que showJudgment para que dos hits consecutivos del mismo tier
  // re-disparen la animación en vez de quedarse congelados.
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
  _comboMeterLast = combo;
}

function render(audioTime) {
  const W = canvasW, H = canvasH;
  ctx2d.clearRect(0, 0, W, H);

  // Background layer: user-loaded image > procedural gradient per song.
  if (bgImage && bgImage.complete) {
    ctx2d.drawImage(bgImage, 0, 0, W, H);
    ctx2d.fillStyle = 'rgba(0,0,0,0.55)'; // dim so notes pop
    ctx2d.fillRect(0, 0, W, H);
  } else if (selectedSong) {
    drawProceduralBg(W, H, selectedSong.title || '');
  }

  // Lane geometry depends on the active config (4/6/8 lanes).
  const cfg = gameState.laneConfig;
  const numLanes = cfg.lanes;
  const tints = cfg.tints;
  const rotations = cfg.rotations;
  // El playfield total es FIJO (clamp 540-1040 según viewport, mismo target
  // que el highway de gh-play.html). Los carriles se reparten dentro: 4 lanes
  // → flechas grandes; 8 lanes → flechas más ajustadas pero playfield igual.
  // Esto garantiza que un chart full-mode de 8 carriles no se desborde.
  const laneWidth = Math.round(playfieldW / numLanes);
  const totalWidth = laneWidth * numLanes;
  const startX = W/2 - totalWidth/2;
  // receptorY proporcional a uiScale — en pantallas grandes ofrecemos algo
  // más de margen superior sin tapar la HUD. Base RECEPTOR_Y_BASE=70px
  // (bajado de 110 el 2026-05-15 para más tiempo de reacción visual).
  const receptorY = Math.round(RECEPTOR_Y_BASE * uiScale);
  // Apply per-section #SPEEDS and #SCROLLS modifiers based on current beat.
  // Negative scroll = reverse direction (notes flow upward from below).
  const T = gameState.timingEngine;
  const curBeat = T.timeToBeat ? T.timeToBeat(audioTime) : 0;
  const localSpeed = T.speedAtBeat ? T.speedAtBeat(curBeat) : 1;
  const localScroll = T.scrollAtBeat ? T.scrollAtBeat(curBeat) : 1;
  const pps = gameState.pixelsPerSec * localSpeed * localScroll;

  // Lane background gradient
  const bg = ctx2d.createLinearGradient(startX, 0, startX+totalWidth, 0);
  bg.addColorStop(0,    'rgba(255,0,110,0.04)');
  bg.addColorStop(0.5,  'rgba(131,56,236,0.06)');
  bg.addColorStop(1,    'rgba(58,134,255,0.04)');
  ctx2d.fillStyle = bg;
  ctx2d.fillRect(startX, 0, totalWidth, H);

  // Lane separators
  ctx2d.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx2d.lineWidth = 1;
  for (let i = 0; i <= numLanes; i++) {
    ctx2d.beginPath();
    ctx2d.moveTo(startX + i*laneWidth, 0);
    ctx2d.lineTo(startX + i*laneWidth, H);
    ctx2d.stroke();
  }

  // Beat pulse: subtle flash on each quarter note, stronger on downbeats (every 4).
  // Pulse duration scales with current BPM so it never overlaps the next beat.
  let beatPulse = 0;
  if (gameState.beatTimes && gameState.beatTimes.length) {
    let lo = 0, hi = gameState.beatTimes.length - 1;
    while (lo < hi) { const m = (lo+hi)>>1; if (gameState.beatTimes[m] < audioTime) lo = m+1; else hi = m; }
    const prevIdx = Math.max(0, lo-1);
    const dt = audioTime - gameState.beatTimes[prevIdx];
    const bpmHere = gameState.timingEngine.bpmAtBeat ? gameState.timingEngine.bpmAtBeat(curBeat) : gameState.bpm;
    const beatDur = 60 / bpmHere;
    const pulseDur = beatDur * 0.15; // 15% of beat — never overlaps
    const isDownbeat = (prevIdx % 4) === 0;
    const intensity = isDownbeat ? 1.0 : 0.5;
    if (dt >= 0 && dt < pulseDur) beatPulse = (1 - dt/pulseDur) * intensity;
  }

  // Receptor radius proporcional al lane (36% → diámetro ≈72% del lane,
  // similar al ratio del receptor circular de gh-play.html y consistente
  // entre 4/6/8 carriles).
  const receptorRadius = Math.round(laneWidth * 0.36);
  for (let i = 0; i < numLanes; i++) {
    const cx = startX + i*laneWidth + laneWidth/2;
    const cy = receptorY;
    // Outer ring (beat pulse)
    ctx2d.strokeStyle = `rgba(255,255,255,${0.15 + beatPulse*0.5})`;
    ctx2d.lineWidth = 2 + beatPulse*2;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, receptorRadius + 4 + beatPulse*4, 0, Math.PI*2);
    ctx2d.stroke();
    // Lane-color receptor
    ctx2d.strokeStyle = tints[i];
    ctx2d.lineWidth = 3;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, receptorRadius, 0, Math.PI*2);
    ctx2d.stroke();
    // Press flash
    const flashAge = (performance.now() - gameState.flashTime[i]) / 200;
    const flashAlpha = Math.max(0, 1 - flashAge);
    if (flashAlpha > 0) {
      ctx2d.fillStyle = `rgba(255,255,255,${flashAlpha*0.5})`;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, receptorRadius - 2, 0, Math.PI*2);
      ctx2d.fill();
    }
    // Miss flash: anillo rojo CONTRACTIVO + X superpuesta. Antes el anillo
    // expandía igual que los aciertos pero en rojo — ambiguo (forma idéntica,
    // solo cambia el color). Ahora el patrón es opuesto:
    //   - Aciertos → anillos EXPANDEN hacia afuera (hacia el éxito)
    //   - Fallos   → anillo CONTRAE hacia el receptor (rotura) + X inequívoca
    // Esa asimetría de forma da feedback más rápido que el contraste de color.
    const missAge = (performance.now() - gameState.missFlashTime[i]) / 350;
    if (missAge >= 0 && missAge < 1) {
      const a = 1 - missAge;
      ctx2d.save();
      ctx2d.globalAlpha = a;
      ctx2d.shadowBlur = 22;
      ctx2d.shadowColor = '#ff3366';
      ctx2d.strokeStyle = '#ff3366';
      ctx2d.lineWidth = 5;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, receptorRadius * (1.4 - missAge * 0.7), 0, Math.PI*2);
      ctx2d.stroke();
      // X grande sobre el receptor — solo el fallo dibuja diagonales,
      // así el ojo distingue acierto/fallo por geometría sin leer texto.
      ctx2d.lineCap = 'round';
      ctx2d.lineWidth = 4;
      ctx2d.shadowBlur = 14;
      const r = receptorRadius * 0.55;
      ctx2d.beginPath();
      ctx2d.moveTo(cx - r, cy - r); ctx2d.lineTo(cx + r, cy + r);
      ctx2d.moveTo(cx + r, cy - r); ctx2d.lineTo(cx - r, cy + r);
      ctx2d.stroke();
      ctx2d.restore();
    }
    // Receptor arrow outline (transparent)
    const sprite = getArrowSprite(rotations[i], 'rgba(160,160,180,0.35)');
    ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, cy - ARROW_SIZE/2);
  }

  // Holds first (so notes draw above)
  for (const n of gameState.notes) {
    if (n.type !== 'hold' && n.type !== 'roll') continue;
    if (n.endTime === null) continue;
    const dtH = n.time - audioTime;
    const dtT = n.endTime - audioTime;
    if (dtT < -1 || dtH > 5) continue;
    const yH = receptorY + dtH * pps;
    const yT = receptorY + dtT * pps;
    const cx = startX + n.lane*laneWidth + laneWidth/2;
    const released = n.holdState === 'released-grace' || n.holdState === 'ng';
    const inProgress = (n.holdState === 'active' || n.holdState === 'released-grace');
    const top = inProgress ? receptorY : Math.min(yH, yT);
    const bot = Math.max(yH, yT);
    if (bot < -10 || top > H + 10) continue;
    const grad = ctx2d.createLinearGradient(0, top, 0, bot);
    if (n.type === 'roll') { grad.addColorStop(0,'rgba(255,200,0,0.85)'); grad.addColorStop(1,'rgba(255,120,0,0.6)'); }
    else                   { grad.addColorStop(0,'rgba(0,255,180,0.85)'); grad.addColorStop(1,'rgba(0,140,255,0.55)'); }
    // Hold/roll body: 55% del laneWidth (antes 44 px hardcoded sobre lane 80).
    // Escala automáticamente con uiScale al estar referenciado a laneWidth.
    const holdHalfW = Math.round(laneWidth * 0.275);
    const holdCapH = Math.round(laneWidth * 0.225);
    ctx2d.fillStyle = released ? 'rgba(120,120,120,0.4)' : grad;
    ctx2d.fillRect(cx-holdHalfW, top, holdHalfW*2, Math.max(0, bot-top));
    // Tail cap
    ctx2d.fillStyle = released ? 'rgba(120,120,120,0.55)' : (n.type === 'roll' ? '#ff8800' : '#00f5d4');
    ctx2d.beginPath();
    ctx2d.moveTo(cx-holdHalfW, bot);
    ctx2d.lineTo(cx+holdHalfW, bot);
    ctx2d.lineTo(cx, bot+holdCapH);
    ctx2d.closePath();
    ctx2d.fill();
  }

  // Note heads (taps + mines + hold heads + lifts + fakes)
  for (const n of gameState.notes) {
    const dt = n.time - audioTime;
    if (dt > 5 || dt < -1) continue;
    if (['marvelous','perfect','great','good','bad'].includes(n.judged) && n.type !== 'hold' && n.type !== 'roll') continue;
    // For active holds/rolls the head is stuck to the receptor while held —
    // body shrinks underneath. Only force receptorY while still in active grace.
    const inProgress = (n.type === 'hold' || n.type === 'roll')
      && (n.holdState === 'active' || n.holdState === 'released-grace');
    const y = inProgress ? receptorY : receptorY + dt * pps;
    const cx = startX + n.lane*laneWidth + laneWidth/2;
    if (y < -50 || y > H + 50) continue;

    // Mods: hidden / sudden
    let alpha = 1;
    if (activeMods.hidden) { // disappears in upper half
      const fadeStart = H * 0.55, fadeEnd = H * 0.30;
      if (y < fadeStart) alpha = Math.max(0, (y - fadeEnd) / (fadeStart - fadeEnd));
    }
    if (activeMods.sudden) { // appears late
      const showStart = H * 0.85, showEnd = H * 0.60;
      if (y > showStart) alpha = 0;
      else if (y > showEnd) alpha = (showStart - y) / (showStart - showEnd);
    }
    if (alpha <= 0) continue;

    if (n.type === 'mine') {
      ctx2d.save();
      ctx2d.globalAlpha = alpha;
      // Pulsating mine — radio y font escalan con ARROW_SIZE para coincidir
      // visualmente con las notas (antes 18 px fijos sobre flecha de 56).
      const mineR = Math.round(ARROW_SIZE * 0.32);
      const pulse = 0.7 + 0.3 * Math.sin(performance.now()/100);
      ctx2d.fillStyle = `rgba(255,51,102,${pulse})`;
      ctx2d.beginPath(); ctx2d.arc(cx, y, mineR, 0, Math.PI*2); ctx2d.fill();
      ctx2d.fillStyle = '#fff';
      ctx2d.font = `bold ${mineR}px sans-serif`;
      ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
      ctx2d.fillText('M', cx, y);
      ctx2d.restore();
      continue;
    }

    if (n.type === 'fake') {
      // Fakes: ghosted arrow (40% alpha), no scoring
      ctx2d.save();
      ctx2d.globalAlpha = alpha * 0.4;
      const sprite = getArrowSprite(rotations[n.lane], '#888');
      ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, y - ARROW_SIZE/2);
      ctx2d.restore();
      continue;
    }

    if (n.type === 'lift') {
      // Lifts: hollow arrow outline (released-on-beat semantics)
      ctx2d.save();
      ctx2d.globalAlpha = alpha;
      const color = quantColorFor(n.row || 0, n.total || 4);
      const sprite = getArrowSprite(rotations[n.lane], color);
      // Draw the sprite at lower alpha + a bright outline ring
      ctx2d.globalAlpha = alpha * 0.5;
      ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, y - ARROW_SIZE/2);
      ctx2d.globalAlpha = alpha;
      ctx2d.strokeStyle = color;
      ctx2d.lineWidth = 3;
      ctx2d.beginPath();
      ctx2d.arc(cx, y, ARROW_SIZE/2 - 2, 0, Math.PI*2);
      ctx2d.stroke();
      ctx2d.restore();
      continue;
    }

    if (n.judged === 'miss') {
      ctx2d.save();
      ctx2d.globalAlpha = alpha * 0.4;
      const sprite = getArrowSprite(rotations[n.lane], '#666');
      ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, y - ARROW_SIZE/2);
      ctx2d.restore();
      continue;
    }

    const color = quantColorFor(n.row || 0, n.total || 4);
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    const sprite = getArrowSprite(rotations[n.lane], color);
    ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, y - ARROW_SIZE/2);
    ctx2d.restore();
  }

  // Lane covers (hidden / sudden) — physical opaque gradients over the lanes
  // for the ITG-authentic look (alpha tween on each note still works as backup).
  if (activeMods.hidden) {
    const fadeStart = H * 0.30, fadeEnd = H * 0.55;
    const grad = ctx2d.createLinearGradient(0, fadeStart, 0, fadeEnd);
    grad.addColorStop(0, 'rgba(0,0,0,0.95)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(startX, 0, totalWidth, fadeEnd);
  }
  if (activeMods.sudden) {
    const showStart = H * 0.60, showEnd = H * 0.85;
    const grad = ctx2d.createLinearGradient(0, showStart, 0, showEnd);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.95)');
    ctx2d.fillStyle = grad;
    ctx2d.fillRect(startX, showStart, totalWidth, H - showStart);
  }

  // Hit FX estratificado por tier (ver SM_HIT_PROFILES). Capas:
  //   1) Anillo blanco exterior (baseline — firma SM)
  //   2) Anillo lane-tinted interior (baseline — refuerza color de carril)
  //   3) Anillo extra grande lane-tinted (solo marvelous, escalonado)
  //   4) Core blanco brillante (solo marvelous, primera mitad)
  //   5) Partículas con gravedad real (densidad/velocidad/vida según perfil)
  //
  // Cleanup por edad usa la duration propia del perfil (marvelous dura más
  // porque el efecto es más rico; bad dura menos porque no merece pantalla).
  const now = performance.now();
  gameState.hitFx = gameState.hitFx.filter(fx => {
    const p = SM_HIT_PROFILES[fx.kind] || SM_HIT_PROFILES.great;
    return now - fx.t < p.duration * 1000;
  });
  for (const fx of gameState.hitFx) {
    const profile = SM_HIT_PROFILES[fx.kind] || SM_HIT_PROFILES.great;
    const ageMs = now - fx.t;
    const dur = profile.duration * 1000;
    const age = ageMs / dur;
    const alpha = 1 - age;
    // Anillo escalado a ARROW_SIZE: 55% como base, expande hasta +90% × expandMul.
    const baseRadius = ARROW_SIZE * 0.55;
    const radius = baseRadius + age * ARROW_SIZE * 0.9 * profile.expandMul;
    const cx = startX + fx.lane*laneWidth + laneWidth/2;

    // Capa 1 — outer white ring (baseline)
    ctx2d.save();
    if (profile.blur) { ctx2d.shadowBlur = profile.blur; ctx2d.shadowColor = 'rgba(255,255,255,0.6)'; }
    ctx2d.strokeStyle = `rgba(255,255,255,${alpha*0.6})`;
    ctx2d.lineWidth = 3 * profile.lineWidthMul * (1-age);
    ctx2d.beginPath(); ctx2d.arc(cx, receptorY, radius, 0, Math.PI*2); ctx2d.stroke();
    ctx2d.restore();

    // Capa 2 — inner lane-tinted ring (baseline, smaller)
    ctx2d.save();
    if (profile.blur) { ctx2d.shadowBlur = profile.blur; ctx2d.shadowColor = tints[fx.lane]; }
    ctx2d.strokeStyle = `${tints[fx.lane]}${Math.floor(alpha*255).toString(16).padStart(2,'0')}`;
    ctx2d.lineWidth = 5 * profile.lineWidthMul * (1-age);
    ctx2d.beginPath(); ctx2d.arc(cx, receptorY, radius*0.7, 0, Math.PI*2); ctx2d.stroke();
    ctx2d.restore();

    // Capa 3 — extra ring (solo marvelous): segunda onda más grande, arranca
    // 15% del ciclo después que las baseline para dar sensación de eco/réplica.
    if (profile.extraRing && age > 0.15) {
      const extraAge = (age - 0.15) / 0.85;
      ctx2d.save();
      ctx2d.globalAlpha = 1 - extraAge;
      ctx2d.shadowBlur = 26;
      ctx2d.shadowColor = tints[fx.lane];
      ctx2d.strokeStyle = tints[fx.lane];
      ctx2d.lineWidth = 4 * (1 - extraAge);
      ctx2d.beginPath();
      ctx2d.arc(cx, receptorY, radius * 1.4, 0, Math.PI*2);
      ctx2d.stroke();
      ctx2d.restore();
    }

    // Capa 4 — core flash blanco (solo marvelous): fogonazo de cámara
    // breve, decae en la primera mitad de la animación.
    if (profile.coreFlash && age < 0.5) {
      const coreAge = age / 0.5;
      ctx2d.save();
      ctx2d.globalAlpha = (1 - coreAge) * 0.85;
      ctx2d.shadowBlur = 32;
      ctx2d.shadowColor = '#fff';
      ctx2d.fillStyle = '#fff';
      ctx2d.beginPath();
      ctx2d.arc(cx, receptorY, baseRadius * (0.5 + coreAge * 0.5), 0, Math.PI*2);
      ctx2d.fill();
      ctx2d.restore();
    }

    // Capa 5 — partículas con gravedad. Cada una respeta la duration global
    // del fx (no vida individual como en GH); se desvanecen junto con los
    // anillos para no dejar puntos huérfanos al final.
    if (fx.particles && fx.particles.length) {
      const t = ageMs / 1000;
      const G = 280; // gravity (px/s²)
      ctx2d.save();
      ctx2d.shadowBlur = profile.blur ? 8 : 0;
      ctx2d.shadowColor = tints[fx.lane];
      ctx2d.fillStyle = tints[fx.lane];
      for (const p of fx.particles) {
        const px = cx + p.vx * t;
        const py = receptorY + p.vy * t + 0.5 * G * t * t;
        const size = 4 * profile.lineWidthMul * (1 - age);
        if (size <= 0) continue;
        ctx2d.globalAlpha = alpha;
        ctx2d.beginPath(); ctx2d.arc(px, py, size, 0, Math.PI*2); ctx2d.fill();
      }
      ctx2d.restore();
    }
  }

  // Progress bar
  const pct = Math.min(1, audioTime / gameState.duration);
  ctx2d.fillStyle = 'rgba(255,255,255,0.1)';
  ctx2d.fillRect(0, 0, W, 4);
  const grad2 = ctx2d.createLinearGradient(0,0,W,0);
  grad2.addColorStop(0,'#ff006e'); grad2.addColorStop(0.5,'#8338ec'); grad2.addColorStop(1,'#3a86ff');
  ctx2d.fillStyle = grad2;
  ctx2d.fillRect(0, 0, W * pct, 4);

  // Countdown sobrio dentro del highway: cuando audioTime < 0 (durante los
  // LEAD_IN_SEC=5s previos a que la primera nota llegue al receptor) pinta
  // un número monocromo en el centro del canvas. Patrón idéntico al motor
  // GH (`gh-play.html` render()). Sin overlay HTML, sin beep, sin scale-pop
  // — el countdown está integrado en la pista. Bug previo: overlay HTML
  // grande dejaba "1 residual" y se duplicaba con cualquier render auxiliar.
  if (audioTime < 0) {
    const sec = Math.ceil(-audioTime);
    ctx2d.fillStyle = 'rgba(255,255,255,0.92)';
    ctx2d.font = `bold ${H * 0.18}px ${getComputedStyle(document.body).getPropertyValue('--font-display') || 'sans-serif'}`;
    ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
    ctx2d.fillText(sec, W / 2, H / 2);
  }
}

// Run "pendiente" — construido en endGame, persistido en saveCurrentRun tras
// capturar el nombre. Vive a nivel de módulo (no en gameState) porque stopGame()
// nulifica gameState ANTES de que el usuario haya escrito su nombre y dado a
// Guardar; necesitamos sobrevivir esa transición.
let _pendingRun = null;

async function endGame() {
  if (!gameState || gameState.finished) return;
  gameState.finished = true;
  const j = gameState.judgments;
  const total = j.marvelous + j.perfect + j.great + j.good + j.bad + j.miss;
  const accuracy = total ? ((j.marvelous + j.perfect*0.9 + j.great*0.7 + j.good*0.4) / total * 100) : 0;
  const grade = accuracy >= 95 ? 'AAA' : accuracy >= 90 ? 'AA' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : 'D';

  // Construimos el run pendiente — solo se persiste tras capturar el nombre.
  // Si no hay selectedSong/Chart (ej. test mode), pendingRun queda en null y
  // el form de guardar no se renderiza.
  if (selectedSong && selectedChart) {
    _pendingRun = {
      gameType: 'sm',
      songId:   selectedSong.id,
      chartKey: selectedChart.key,
      chartId:  chartIdOf(selectedSong.id, selectedChart.key),
      score:    gameState.score,
      grade,
      accuracy: +accuracy.toFixed(2),
      maxCombo: gameState.maxCombo,
      judgments: j,
      mods:     {...activeMods},
      playedAt: Date.now()
    };
  } else {
    _pendingRun = null;
  }

  document.getElementById('resultsTitle').textContent = gameState.songInfo || 'Resultados';
  // Resumen estilo SM5: grade gigante + score/accuracy/maxcombo arriba, grid
  // de judgments con barra proporcional al % del total. Cada barra usa
  // currentColor de su clase (.j-marvelous, .j-perfect…) para el relleno.
  const gradeClass = 'g-' + grade.toLowerCase();
  const rows = [
    ['marvelous','Excelente'], ['perfect','Perfecto'], ['great','Genial'],
    ['good','Bien'],            ['bad','Mal'],          ['miss','Fallo'],
  ];
  const judgmentRows = rows.map(([k, label]) => {
    const count = j[k] || 0;
    const pct = total ? (count / total) * 100 : 0;
    return `
      <div class="judgment-row j-${k}">
        <span class="jname">${label}</span>
        <span class="jbar"><i style="width:${pct.toFixed(1)}%"></i></span>
        <span class="jcount">${count}</span>
      </div>`;
  }).join('');
  // En modo sesión (playlist) auto-guardamos con el nombre vigente — éste
  // puede cambiar entre canciones si la usuaria pulsa "Cambiar jugador" en
  // el banner de transición (caso multijugador alternando turnos). NO
  // renderizamos el form porque el countdown de 5s no daría tiempo a escribir
  // nombre cada vez. En single seguimos pidiendo nombre canción a canción.
  const sessionPlayer = (typeof getActiveSessionPlayer === 'function') ? getActiveSessionPlayer() : null;
  let saveFormHtml = '';
  let autoSavedNotice = '';
  let autoSavedName = null;  // se pasa a updateResultsForSession para el resumen final
  if (sessionPlayer && _pendingRun) {
    const autoRun = { ..._pendingRun, playerName: sessionPlayer, playerLower: sessionPlayer.toLowerCase() };
    _pendingRun = null;
    try {
      await dbRunAdd(autoRun);
      autoSavedName = sessionPlayer;
      autoSavedNotice = `<div class="score-saved-notice">✓ Guardado como <strong>${escapeHtml(sessionPlayer)}</strong></div>`;
    } catch (e) {
      console.error('Auto-save de sesión falló:', e);
      autoSavedNotice = `<div class="score-saved-notice" style="color:#ff6b6b">⚠ No se pudo guardar la puntuación</div>`;
    }
  } else if (_pendingRun) {
    const lastName = escapeHtml(getLastPlayerName());
    saveFormHtml = `
    <div id="resultsScoreSave" class="score-save-form">
      <label for="playerNameInput">Tu nombre</label>
      <input id="playerNameInput" type="text" maxlength="12" value="${lastName}" placeholder="Tu nombre" autocomplete="off">
      <button id="saveRunBtn" class="action-btn primary">Guardar puntuación</button>
    </div>`;
  }
  document.getElementById('resultsContent').innerHTML = `
    <div class="results-header">
      <div class="results-grade ${gradeClass}">${grade}</div>
      <div class="results-summary">
        <div class="cell"><div class="lbl">Score</div><div class="val" style="color:#ffbe0b">${gameState.score.toLocaleString()}</div></div>
        <div class="cell"><div class="lbl">Accuracy</div><div class="val">${accuracy.toFixed(2)}%</div></div>
        <div class="cell"><div class="lbl">Max Combo</div><div class="val" style="color:#00ff64">${gameState.maxCombo}</div></div>
      </div>
    </div>
    <div class="results-judgments">${judgmentRows}</div>
    ${saveFormHtml}
    ${autoSavedNotice}
  `;
  // Wire-up del form: Enter en input dispara click en botón. Autofocus solo
  // si el nombre prefilled está vacío — si ya hay nombre del último jugador,
  // dejamos al usuario decidir si lo cambia (no robamos foco al texto). El
  // form solo existe en modo single (en sesión se autoguardó arriba).
  if (saveFormHtml) {
    const inp = document.getElementById('playerNameInput');
    const btn = document.getElementById('saveRunBtn');
    if (inp && btn) {
      btn.addEventListener('click', () => { saveCurrentRun().catch(e => console.error('saveCurrentRun:', e)); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); btn.click(); } });
      const lastName = getLastPlayerName();
      if (!lastName) inp.focus();
    }
  }
  stopGame();
  goto('results');
  // Hook de modo playlist: si hay sesión activa, inyecta banner de siguiente
  // canción + countdown, o resumen agregado en la última canción.
  // `playerName` queda en el score para que el resumen final pueda etiquetar
  // cada fila con quién la jugó (caso multijugador).
  if (typeof updateResultsForSession === 'function') {
    updateResultsForSession({
      grade,
      accuracy: +accuracy.toFixed(2),
      score: gameState.score,
      playerName: autoSavedName  // null fuera de sesión, nombre real si autoguardó
    });
  }
}

// Captura el nombre del input, persiste el run pendiente y reemplaza el form
// por el panel de ranking con la posición conseguida. Llamada idempotente:
// si _pendingRun ya se guardó (doble click), no hace nada.
async function saveCurrentRun() {
  if (!_pendingRun) return;
  const inp = document.getElementById('playerNameInput');
  const name = sanitizePlayerName(inp ? inp.value : '');
  setLastPlayerName(name);
  const run = {
    ..._pendingRun,
    playerName: name,
    playerLower: name.toLowerCase()
  };
  const { songId, chartKey } = run;
  _pendingRun = null;  // marcamos como consumido antes del await — evita doble save
  let newId;
  try {
    newId = await dbRunAdd(run);
  } catch (e) {
    console.error('No se pudo guardar la puntuación:', e);
    _pendingRun = run;  // restaurar para que el usuario pueda reintentar
    return;
  }
  // Sustituimos solo el form por el panel — el resumen (grade, judgments) sigue
  // arriba. Si el contenedor no existe (usuario navegó fuera), salimos limpios.
  const form = document.getElementById('resultsScoreSave');
  if (!form) return;
  const panel = document.createElement('div');
  panel.id = 'resultsRankingPanel';
  panel.className = 'ranking-panel';
  form.replaceWith(panel);
  await renderRankingPanel(panel, songId, chartKey, newId, name);
}

// Renderiza la posición del run + 2 tabs (Top canción / Mi progresión).
// Tabs son CSS-only (radio buttons ocultos + :checked + ~ selectors).
async function renderRankingPanel(container, songId, chartKey, justSavedId, playerName) {
  // Solo runs de SM — la DB es compartida con GH, así que filtramos por
  // gameType para no mezclar rankings de bailar y de guitarra.
  const allRuns = filterRunsByGame(await dbRunsForChart(songId, chartKey), 'sm');
  const bestRanking = bestRunPerPlayer(allRuns);
  const myRuns = allRuns
    .filter(r => r.playerLower === playerName.toLowerCase())
    .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0)); // newest first

  // Posición del run recién guardado en el ranking (best-per-player).
  const myBestRow = bestRanking.find(r => r.playerLower === playerName.toLowerCase());
  const myPos = myBestRow ? bestRanking.indexOf(myBestRow) + 1 : null;
  const totalPlayers = bestRanking.length;
  const justSavedIsBest = myBestRow && myBestRow.id === justSavedId;

  // Mejora vs run anterior del mismo jugador (excluyendo el actual).
  let deltaHtml = '';
  if (myRuns.length >= 2) {
    const prev = myRuns.find(r => r.id !== justSavedId);  // 2º más reciente
    if (prev) {
      const delta = (myRuns[0].score - prev.score);
      const sign = delta >= 0 ? '+' : '−';
      const cls = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-zero';
      deltaHtml = `<span class="ranking-delta ${cls}">${sign}${Math.abs(delta).toLocaleString()} vs partida anterior</span>`;
    }
  }

  let posPillHtml = '';
  if (myPos === 1 && justSavedIsBest) {
    posPillHtml = `<div class="position-pill is-top">¡Nuevo #1 en ${escapeHtml(diffLabel(chartKey))}!</div>`;
  } else if (myPos) {
    posPillHtml = `<div class="position-pill">Tu posición: #${myPos} de ${totalPlayers} jugador${totalPlayers === 1 ? '' : 'es'}</div>`;
  }

  // Top 5 globales (best por jugador).
  const topRows = bestRanking.slice(0, 5).map((r, i) => {
    const isMe = r.playerLower === playerName.toLowerCase();
    const isJust = r.id === justSavedId;
    const cls = [isMe ? 'is-me' : '', isJust ? 'is-just-saved' : ''].filter(Boolean).join(' ');
    return `
      <li class="ranking-row ${cls}">
        <span class="rank-num">#${i + 1}</span>
        <span class="rank-name">${escapeHtml(r.playerName || 'Anónimo')}</span>
        <span class="rank-grade g-${(r.grade || '').toLowerCase()}">${escapeHtml(r.grade || '—')}</span>
        <span class="rank-score">${(r.score || 0).toLocaleString()}</span>
      </li>`;
  }).join('');

  // Mi progresión: hasta 8 partidas más recientes con delta entre filas
  // consecutivas (cuando hay siguiente más antigua).
  const progRows = myRuns.slice(0, 8).map((r, i, arr) => {
    const next = arr[i + 1];
    const delta = next ? (r.score - next.score) : null;
    const deltaSpan = delta !== null
      ? `<span class="ranking-delta ${delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-zero'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta).toLocaleString()}</span>`
      : '<span class="ranking-delta"></span>';
    const date = r.playedAt ? new Date(r.playedAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const isJust = r.id === justSavedId ? 'is-just-saved' : '';
    return `
      <li class="ranking-row ${isJust}">
        <span class="rank-date">${escapeHtml(date)}</span>
        <span class="rank-grade g-${(r.grade || '').toLowerCase()}">${escapeHtml(r.grade || '—')}</span>
        <span class="rank-score">${(r.score || 0).toLocaleString()}</span>
        ${deltaSpan}
      </li>`;
  }).join('');

  container.innerHTML = `
    ${posPillHtml}
    ${deltaHtml ? `<div class="ranking-delta-wrap">${deltaHtml}</div>` : ''}
    <div class="ranking-tabs">
      <input type="radio" name="rankingTab" id="rkTabTop" checked>
      <label for="rkTabTop" class="ranking-tab">Top de la canción</label>
      <input type="radio" name="rankingTab" id="rkTabMine"${myRuns.length < 2 ? ' disabled' : ''}>
      <label for="rkTabMine" class="ranking-tab${myRuns.length < 2 ? ' disabled' : ''}" title="${myRuns.length < 2 ? 'Necesitas al menos 2 partidas en esta dificultad' : ''}">Mi progresión</label>
      <div class="ranking-pane ranking-pane-top">
        <ol class="ranking-list">${topRows || '<li class="ranking-empty">Sin puntuaciones todavía</li>'}</ol>
      </div>
      <div class="ranking-pane ranking-pane-mine">
        <ol class="ranking-list">${progRows || '<li class="ranking-empty">Solo has jugado esta partida</li>'}</ol>
      </div>
    </div>
  `;
}
