// ============================================================================
//  APP — top-level navigation, settings modal bindings, app kickoff.
//  Loaded LAST: depends on every other module being defined.
//
//  Reorganización 2026-05-11: el SPA antes tenía 10 screens (menu, pad, create,
//  library, songs, diff, play, results, calib, tutorial) viviendo todos dentro
//  de play.html. Ahora play.html es SOLO el dashboard de cards, y el motor
//  vive en stepmania-play.html con un subset (library, songs, diff, play,
//  results). Las otras pantallas tienen archivos dedicados: tutorial.html,
//  calibration.html, autostepper.html, test-pad.html.
//
//  app.js es agnóstico al archivo donde se carga: descubre dinámicamente qué
//  screens existen en el DOM y arma SCREENS en runtime. Si goto('X') pide un
//  screen ausente, redirige al archivo correspondiente vía SCREEN_EXTERNAL.
// ============================================================================

// Nombres canónicos de todas las screens conocidas por el SPA, en cualquier
// archivo que cargue este módulo. SCREENS se filtra abajo según las que
// realmente existen en el DOM de la página actual.
const SCREEN_NAMES = ['menu', 'pad', 'create', 'library', 'songs', 'diff', 'play', 'results', 'calib', 'tutorial'];

// Tras la separación de archivos, las screens que NO están en el archivo
// actual se redirigen aquí. play.html (dashboard) tiene solo `menu`, así
// que cualquier goto('songs') desde código antiguo te lleva al motor.
// stepmania-play.html tiene library/songs/diff/play/results pero NO tiene
// menu/calib/tutorial/create/pad, así que goto('menu') te devuelve al
// dashboard, goto('calib') a calibration.html, etc.
const SCREEN_EXTERNAL = {
  menu:     'play.html',
  songs:    'stepmania-play.html',
  library:  'stepmania-play.html#library',
  diff:     'stepmania-play.html',
  play:     'stepmania-play.html',
  results:  'stepmania-play.html',
  calib:    'calibration.html',
  tutorial: 'tutorial.html',
  create:   'autostepper.html',
  pad:      'test-pad.html'
};

const SCREENS = SCREEN_NAMES.filter(s => document.getElementById(s + '-screen'));
const CRUMBS = {
  menu: '', pad: 'Test de alfombra', create: 'Crear coreografías',
  library: 'Librería', songs: 'Jugar', diff: 'Dificultad',
  play: 'Jugando', results: 'Resultados', calib: 'Calibración',
  tutorial: 'Tutorial'
};
let currentScreen = SCREENS[0] || 'menu';

function goto(name) {
  // Bump del token de navegación: cualquier promesa async en vuelo capturada
  // antes de este punto verá `isCurrentNav(token) === false` y se abortará
  // en su próximo await. Imprescindible para evitar que startGame() siga
  // creando estado tras un ESC durante decodeAudioData (~3s en charts grandes).
  bumpNavToken();
  if (currentScreen === 'play' && name !== 'play') stopGame();
  if (currentScreen === 'songs' && name !== 'songs') {
    if (typeof cancelSongPreview === 'function') cancelSongPreview();
    // Cancelar el preview-loop al salir de songs-screen para no quemar GPU
    if (typeof _stopPreviewLoop === 'function') _stopPreviewLoop();
  }

  // Screen no presente en el DOM actual → redirigir al archivo dedicado.
  // Esto cubre los goto('menu') / goto('create') / goto('calib') / etc. que
  // sobreviven en módulos antiguos (song-select.js, library.js, etc.) tras
  // la separación de archivos. Una llamada en stepmania-play.html a
  // goto('menu') te devuelve al dashboard, en lugar de fallar silenciosa.
  if (!SCREENS.includes(name)) {
    const target = SCREEN_EXTERNAL[name];
    if (target) window.location.href = target;
    return;
  }

  for (const s of SCREENS) {
    document.getElementById(s + '-screen').classList.toggle('hidden', s !== name);
  }
  currentScreen = name;
  const crumbEl = document.getElementById('crumb');
  if (crumbEl) crumbEl.textContent = CRUMBS[name] ? '· ' + CRUMBS[name] : '';
  if (name === 'library') refreshLibrary();
  if (name === 'songs')   {
    refreshSongs();
    if (typeof bindSongsScreenConfig === 'function') bindSongsScreenConfig();
    // Arrancar el preview-loop al entrar a songs-screen
    if (typeof _startPreviewLoop === 'function') _startPreviewLoop();
  }
  if (name === 'diff')    renderDiffScreen();
  if (name === 'play')    startGame();
}

// ----- Settings modal bindings (live update + persist) ----------------------
(function bindSettingsControls() {
  const go = document.getElementById('globalOffset');
  if (!go) return;
  go.addEventListener('input', e => {
    settings.globalOffset = parseInt(e.target.value);
    document.getElementById('globalOffsetVal').textContent = settings.globalOffset + ' ms';
    saveSettings();
  });
  document.getElementById('scrollSpeed').addEventListener('input', e => {
    settings.scrollSpeed = parseFloat(e.target.value);
    document.getElementById('scrollSpeedVal').textContent = settings.scrollSpeed.toFixed(1) + 'x';
    saveSettings();
  });
  document.getElementById('timingWindow').addEventListener('change', e => {
    settings.timingWindow = e.target.value;
    document.getElementById('timingWinVal').textContent = TIMING_WIN_LABEL[settings.timingWindow] || 'J5';
    saveSettings();
  });
})();

// ----- NoteSkin upload (PNG) ------------------------------------------------
function clearNoteskinUi() {
  if (typeof clearNoteskin === 'function') clearNoteskin();
  const el = document.getElementById('noteskinStatus');
  if (el) el.textContent = 'por defecto';
}
document.getElementById('noteskinInput')?.addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  if (typeof setNoteskinFromFile === 'function') setNoteskinFromFile(f);
  const el = document.getElementById('noteskinStatus');
  if (el) el.textContent = f.name.length > 18 ? f.name.slice(0,18)+'...' : f.name;
  e.target.value = '';
});

// ----- Background upload (image or video) -----------------------------------
function clearBgUi() {
  if (typeof clearBg === 'function') clearBg();
  const el = document.getElementById('bgStatus');
  if (el) el.textContent = 'procedural';
}
document.getElementById('bgInput')?.addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  if (typeof setBgFromFile === 'function') setBgFromFile(f);
  const el = document.getElementById('bgStatus');
  if (el) el.textContent = f.name.length > 18 ? f.name.slice(0,18)+'...' : f.name;
  e.target.value = '';
});

// ----- Auto-detect audio latency --------------------------------------------
//   baseLatency = browser-imposed minimum buffer (typically ~5ms in Chrome)
//   outputLatency = real hardware delay (drivers + DAC + speakers; 30-300ms)
//   Their sum is the offset the user is "behind" the audio. We push it into
//   globalOffset as a starting point — fine-tune via the calibration screen.
function autoDetectLatency() {
  const ctx = ensureAudioCtx();
  const hint = document.getElementById('autoLatencyHint');
  const base = (ctx.baseLatency || 0) * 1000;
  const out  = (ctx.outputLatency || 0) * 1000;
  const total = Math.round(base + out);
  if (total === 0) {
    hint.textContent = 'Tu navegador no expone outputLatency (Safari/Firefox antiguos). Usa la calibración manual.';
    hint.style.color = 'var(--color-warning)';
    return;
  }
  const clamped = Math.max(-200, Math.min(200, total));
  settings.globalOffset = clamped;
  document.getElementById('globalOffset').value = clamped;
  document.getElementById('globalOffsetVal').textContent = clamped + ' ms';
  saveSettings();
  hint.textContent = `base ${base.toFixed(1)}ms + output ${out.toFixed(1)}ms = ${total}ms aplicado.`;
  hint.style.color = 'var(--color-success)';
}

// ----- Kickoff ---------------------------------------------------------------
pollGamepad();   // start gamepad RAF loop (defined in core.js)
if (typeof padTestLoop === 'function') padTestLoop(); // solo si pad-test.js está cargado

// Pantalla inicial — se decide así:
//   1. ?screen=X (deep-link explícito)
//   2. #hash (compatibilidad con #library tipo gh-play.html)
//   3. 'songs' si está disponible (es la pantalla "Crear partida", la portada
//      natural del motor — la card "Bailar" del dashboard apunta sin hash
//      esperando aterrizar aquí). Sin esta preferencia explícita SCREENS[0]
//      caía en 'library' porque ese nombre va antes en SCREEN_NAMES.
//   4. Fallback al primer screen del DOM (archivos con un solo screen).
const _initialScreen = (() => {
  const want = new URLSearchParams(window.location.search).get('screen');
  if (want && SCREENS.includes(want)) return want;
  const hashName = (location.hash || '').replace(/^#/, '').toLowerCase();
  if (hashName && SCREENS.includes(hashName)) return hashName;
  if (SCREENS.includes('songs')) return 'songs';
  return SCREENS[0] || 'menu';
})();
goto(_initialScreen);

// Hash routing — permite que el dashboard linkee a `stepmania-play.html#library`
// y aterrice directamente en la biblioteca. Igual que gh-play.html.
window.addEventListener('hashchange', () => {
  const h = (location.hash || '').replace(/^#/, '').toLowerCase();
  if (h && SCREENS.includes(h) && h !== currentScreen) goto(h);
});
