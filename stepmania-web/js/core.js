// ============================================================================
//  CORE — globals, utilities, gamepad polling, IndexedDB, settings
//  All names live on window since classic <script> tags share global scope.
// ============================================================================

// ----- Generic utils --------------------------------------------------------
function escapeHtml(s) {
  return String(s||'').replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]));
}
function formatTime(s) {
  const m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}
function safeFn(s) { return String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').trim() || 'song'; }
function getExt(n) { const m = n.match(/\.[^.]+$/); return m ? m[0] : '.mp3'; }
function yieldUI() { return new Promise(r => setTimeout(r, 0)); }

// ----- Capa de presentación: traducción de claves de dificultad ------------
// Los charts de StepMania persisten su nombre de tier como string del formato
// (Beginner/Easy/Medium/Hard/Challenge) — es lo que escribe el parser y lo que
// IndexedDB tiene guardado para charts ya importados. Esa clave NO se traduce
// (rompería búsquedas `chart.name === key`, los `.ssc` generados y el match
// con StepMania nativo). `diffLabel()` solo se usa al renderizar al DOM.
// Si la clave no está mapeada (Edit u otros tiers raros) se devuelve tal cual.
const _DIFF_LABELS_ES = {
  Beginner:  'Principiante',
  Easy:      'Fácil',
  Medium:    'Intermedio',
  Hard:      'Difícil',
  Challenge: 'Experto',
  Edit:      'Edición'
};
function diffLabel(key) { return _DIFF_LABELS_ES[key] || key; }

// ----- Audio context (shared) -----------------------------------------------
// `ensureAudioCtx` es síncrono y devuelve el contexto inmediatamente para
// callers que NO necesitan reproducir (decodeAudioData funciona en estado
// 'suspended'). Para callers que SÍ van a reproducir audio audible, usar
// `ensureAudioCtxRunning()` que además hace el resume — los navegadores
// móviles (iOS Safari, Chrome Android) crean el contexto en 'suspended'
// hasta el primer gesto de usuario, y reproducir en ese estado falla en
// silencio. Centralizar el resume aquí evita que cada call-site lo olvide.
let audioCtx = null;
function ensureAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
async function ensureAudioCtxRunning() {
  const ctx = ensureAudioCtx();
  if (ctx.state === 'suspended') {
    try { await ctx.resume(); } catch (e) { /* puede fallar si no hay gesto */ }
  }
  return ctx;
}

// ----- Gamepad polling (always running) -------------------------------------
// El loop se auto-reagenda con rAF. Pausa automáticamente cuando la pestaña
// está oculta (visibilityState === 'hidden') para no quemar batería en móvil
// ni gastar CPU en background. Se rearranca al volver a 'visible'.
//
// `padPill` puede no existir en páginas que cargan core.js sin la HUD del
// shell (futuras páginas satellite). Se cachea una sola vez y se usa con
// optional chaining para que el polling no muera si falta el elemento.
let gamepadConnected = false;
const gamepadButtonState = new Array(20).fill(false);
const gamepadJustPressed = new Array(20).fill(false);
let _padPillEl = null;
let _gamepadRafId = null;
function _getPadPill() {
  // Cache lazy: el primer DOM lookup se hace en el primer frame, no a
  // module-load (algunas páginas cargan core.js antes del DOM listo).
  if (_padPillEl === null) _padPillEl = document.getElementById('padPill') || false;
  return _padPillEl || null;
}

// Algunos dispositivos HID (cascos USB con botones, micrófonos con teclas,
// webcams con controles) son expuestos por Chrome como Gamepad. La Gamepad API
// asigna el `index` por orden de "primer despertar en la pestaña" — NO
// determinista entre sesiones. Sin filtro, `play.html` puede acabar pollando
// un dispositivo de audio en vez de la alfombra. Filtramos por nombre y por
// perfil de hardware esperado; fallback al primer connected si nada pasa.
const NON_CONTROLLER_PATTERN = /USB Audio|Audio Device|Headset|Headphone|Microphone|Speaker|Webcam|Camera/i;
function pickMatGamepad(pads) {
  // 1ª pasada — alfombra real: 8-12 botones, 0-2 ejes. Rechazamos `axes >= 6`
  // para no confundir una guitarra GH (10 ejes) con alfombra cuando el usuario
  // está en DDR.
  for (const p of pads) {
    if (!p || !p.connected) continue;
    if (NON_CONTROLLER_PATTERN.test(p.id)) continue;
    if (p.buttons.length < 4) continue;
    if (p.axes.length >= 6) continue;
    return p;
  }
  // 2ª pasada — cualquier no-audio. Si solo hay guitarra enchufada y el usuario
  // está en DDR, preferimos darle la guitarra (al menos sus botones existen)
  // antes que un casco USB Audio (cero ejes, inutilizable como input).
  for (const p of pads) if (p && p.connected && !NON_CONTROLLER_PATTERN.test(p.id)) return p;
  // 3ª pasada (último recurso) — primer conectado, sin filtro.
  for (const p of pads) if (p && p.connected) return p;
  return null;
}

function pollGamepad() {
  _gamepadRafId = null;
  try {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pickMatGamepad(pads);

    if (gp) {
      if (!gamepadConnected) {
        gamepadConnected = true;
        const pill = _getPadPill();
        if (pill) {
          pill.textContent = 'alfombra: ' + (gp.id.length > 24 ? gp.id.slice(0,24)+'...' : gp.id);
          pill.classList.remove('off');
        }
      }
      for (let i = 0; i < gp.buttons.length && i < 20; i++) {
        const pressed = gp.buttons[i].pressed || gp.buttons[i].value > 0.5;
        gamepadJustPressed[i] = pressed && !gamepadButtonState[i];
        gamepadButtonState[i] = pressed;
      }
    } else if (gamepadConnected) {
      gamepadConnected = false;
      const pill = _getPadPill();
      if (pill) {
        pill.textContent = 'alfombra: no detectada';
        pill.classList.add('off');
      }
    }
  } catch (e) {
    // No dejamos morir el loop por una excepción transitoria (DOM no listo,
    // gamepad desconectado mid-frame, etc.). Loggeamos en consola y seguimos.
    console.warn('pollGamepad error:', e);
  }
  // Solo reagendamos si la pestaña está visible. visibilitychange dispara el
  // re-arranque cuando el usuario vuelve.
  if (document.visibilityState !== 'hidden') {
    _gamepadRafId = requestAnimationFrame(pollGamepad);
  }
}

// Guard para entorno Node (tests): `document` y `requestAnimationFrame` no
// existen fuera del navegador. El polling del gamepad solo tiene sentido en
// runtime real, así que lo dejamos no-op cuando se importa para testing.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && _gamepadRafId === null) {
      _gamepadRafId = requestAnimationFrame(pollGamepad);
    }
  });
}

// ----- IndexedDB: songs + runs + gh-songs (compartida con GH suite) ---------
// Schema v4: store `runs` (autoincrement, una fila por partida) reemplaza al
// antiguo `scores` (1 fila por canción+chart sin nombre de jugador). Permite
// ranking arcade con histórico de progresión. La migración v3→v4 borra
// `scores` limpiamente — decisión consciente del producto.
//
// MISMA migración vive en `scores.js`, `gh-db.js` y `autostepper.html` (4
// entrypoints abren la DB; quien abra primero corre `onupgradeneeded`).
// Si cambias el schema, actualízalo en los 4 sitios o tendrás VersionError.
const DB_NAME = 'StepManiaWebDB';
const DB_VERSION = 4;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id', autoIncrement: true });
      }
      if (e.oldVersion < 4 && db.objectStoreNames.contains('scores')) {
        db.deleteObjectStore('scores');
      }
      if (!db.objectStoreNames.contains('runs')) {
        const rs = db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true });
        rs.createIndex('songId',      'songId',      { unique: false });
        rs.createIndex('chartId',     'chartId',     { unique: false });
        rs.createIndex('playerLower', 'playerLower', { unique: false });
      }
      if (!db.objectStoreNames.contains('gh-songs')) {
        db.createObjectStore('gh-songs', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
  return dbPromise;
}
async function dbAdd(song) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('songs', 'readwrite');
    const req = tx.objectStore('songs').add(song);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('songs', 'readonly');
    const req = tx.objectStore('songs').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbGet(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('songs', 'readonly');
    const req = tx.objectStore('songs').get(id);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('songs', 'readwrite');
    const req = tx.objectStore('songs').delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
async function dbPut(song) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('songs', 'readwrite');
    const req = tx.objectStore('songs').put(song);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
// El store `runs` (puntuaciones arcade) y todos sus wrappers viven en
// `stepmania-web/js/scores.js`. Helpers puros (chartIdOf, sanitizePlayerName,
// rankRuns, bestRunPerPlayer) y localStorage helpers (getLastPlayerName /
// setLastPlayerName) también. Carga scores.js antes de core.js en cualquier
// HTML que necesite ranking; los tests apuntan directamente a scores.js.

// ----- Settings (localStorage) ----------------------------------------------
const SETTINGS_KEY = 'stepmania-web-settings';
const settings = Object.assign({
  globalOffset: 0,    // ms
  scrollSpeed: 1.0,   // xMod multiplier (BPM-agnostic en nuestro motor)
  speedMode: 'xmod',  // 'xmod' | 'cmod' | 'mmod' — replica los 3 modos de StepMania 5
  cmodBPM: 300,       // velocidad constante (CMod) en BPM equivalente; activa solo si speedMode==='cmod'
  mmodBPM: 450,       // techo de velocidad (MMod) en BPM equivalente; activa solo si speedMode==='mmod'
  timingWindow: 'j5',
}, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch(e) { return {}; } })());

// ----- Cálculo de velocidad de scroll (3 modos: xMod / CMod / MMod) --------
// Replica el sistema de speed-mods de StepMania 5 (PlayerOptions.cpp:625-660):
//   - xMod: multiplicador relativo. scrollSpeed × chartSpeed × BASE.
//   - CMod: BPM equivalente constante, ignora chartSpeed (la velocidad la fija el usuario).
//   - MMod: como xMod pero capa a maxBPM (útil cuando alternas canciones de tempo dispar).
//
// Equivalencia de calibración: xMod 1.0 ≡ CMod 200, alineado con el
// CMOD_DEFAULT = 200.0f del repo oficial (stepmania-5_1-new/PlayerOptions.cpp:53).
// PPS_PER_BPM = 600/200 = 3 (deriva de "default xMod actual produce 600 px/s").
//
// Nota: nuestro xMod NO escala con songBPM (a diferencia de SM oficial). Esto
// es una decisión heredada para no romper settings existentes — funcionalmente
// nuestro xMod ya es "BPM-independiente" como un CMod implícito. Lo único que
// faltaba era exponer ese hecho al usuario y dejarle elegir el BPM equivalente.
const SCROLL_BASE_PPS = 600;       // px/seg a scrollSpeed 1.0 × chartSpeed 1.0
const SCROLL_PPS_PER_BPM = 3;      // píxeles/seg por BPM en CMod/MMod

function computePixelsPerSec(songBPM, chartSpeedMul) {
  const cs = (typeof chartSpeedMul === 'number' && chartSpeedMul > 0) ? chartSpeedMul : 1.0;
  if (settings.speedMode === 'cmod') {
    return settings.cmodBPM * SCROLL_PPS_PER_BPM;
  }
  if (settings.speedMode === 'mmod') {
    const xmodPps = SCROLL_BASE_PPS * settings.scrollSpeed * cs;
    const capPps  = settings.mmodBPM * SCROLL_PPS_PER_BPM;
    return Math.min(xmodPps, capPps);
  }
  // xMod (default): comportamiento heredado idéntico al anterior.
  return SCROLL_BASE_PPS * settings.scrollSpeed * cs;
}

const TIMING_WIN_LABEL = { j4:'J4 (suave)', j5:'J5 (SM5)', j6:'J6 (estricto)', j7:'J7 (ITG pro)' };

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch(e) {}
}

// ----- Navigation token (cancellation for in-flight async work) -------------
// Sin framework no hay "esta navegación canceló esa promesa". Cada goto()
// bumpea _navToken; las funciones async largas (startGame, decodeAudioData,
// loadSongPreview) capturan el token al inicio y verifican después de cada
// await que sigue siendo el actual. Si no, abandonan limpiamente sin tocar
// estado de UI que ahora pertenece a otra pantalla.
let _navToken = 0;
function bumpNavToken() { return ++_navToken; }
function isCurrentNav(token) { return token === _navToken; }
function currentNavToken() { return _navToken; }
function openSettings() {
  document.getElementById('settingsModal').classList.add('show');
  document.getElementById('globalOffset').value = settings.globalOffset;
  document.getElementById('globalOffsetVal').textContent = settings.globalOffset + ' ms';
  // Speed mode (xMod / CMod / MMod): selector + slider contextual.
  const sm = document.getElementById('speedMode');
  if (sm) sm.value = settings.speedMode;
  document.getElementById('scrollSpeed').value = settings.scrollSpeed;
  document.getElementById('scrollSpeedVal').textContent = settings.scrollSpeed.toFixed(1) + 'x';
  const cm = document.getElementById('cmodBPM');
  if (cm) {
    cm.value = settings.cmodBPM;
    document.getElementById('cmodBPMVal').textContent = 'C' + settings.cmodBPM;
  }
  const mm = document.getElementById('mmodBPM');
  if (mm) {
    mm.value = settings.mmodBPM;
    document.getElementById('mmodBPMVal').textContent = 'M' + settings.mmodBPM;
  }
  refreshSpeedModeUi();
  document.getElementById('timingWindow').value = settings.timingWindow;
  document.getElementById('timingWinVal').textContent = TIMING_WIN_LABEL[settings.timingWindow] || 'J5';
}

// Muestra solo el slider del modo activo, oculta los otros dos. Idempotente —
// llamable en cada cambio de dropdown.
function refreshSpeedModeUi() {
  const rows = {
    xmod: document.getElementById('speedRowX'),
    cmod: document.getElementById('speedRowC'),
    mmod: document.getElementById('speedRowM')
  };
  for (const [mode, el] of Object.entries(rows)) {
    if (el) el.style.display = (settings.speedMode === mode) ? '' : 'none';
  }
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('show'); }
