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
// Schema v4 reemplaza el store `scores` (1 fila por canción+chart) por `runs`
// (autoincrement, una fila por partida). Permite ranking arcade con nombre de
// jugador e histórico de progresión. La migración de v3 a v4 borra `scores`
// limpiamente — decisión consciente del producto: empezar con rankings vacíos
// en lugar de mantener entries legacy sin nombre.
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
      // v3→v4: wipe `scores` (no había nombre de jugador, semánticamente roto
      // para arcade) y reemplazar por `runs` autoincrement.
      if (e.oldVersion < 4 && db.objectStoreNames.contains('scores')) {
        db.deleteObjectStore('scores');
      }
      if (!db.objectStoreNames.contains('runs')) {
        const rs = db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true });
        rs.createIndex('songId',      'songId',      { unique: false });
        // `chartId` ('songId:chartKey' como string) acelera la consulta de
        // ranking de una dificultad concreta — el caso de uso más frecuente.
        rs.createIndex('chartId',     'chartId',     { unique: false });
        // `playerLower` (nombre en lowercase) permite búsquedas case-insensitive
        // de "todas las partidas de un jugador" sin tener que escanear todo.
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
// ----- Runs (puntuaciones arcade) -------------------------------------------
// Cada partida acabada inserta una fila. NO se sobrescriben — el ranking se
// calcula en JS con `bestRunPerPlayer()` / `rankRuns()`. Ver schema en
// `onupgradeneeded`. La key compuesta `chartId` (string 'songId:chartKey') vive
// en cada fila para que el índice del mismo nombre filtre eficientemente.
async function dbRunAdd(run) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readwrite');
    const req = tx.objectStore('runs').add(run);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsForChart(songId, chartKey) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readonly');
    const req = tx.objectStore('runs').index('chartId').getAll(chartIdOf(songId, chartKey));
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsForSong(songId) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readonly');
    const req = tx.objectStore('runs').index('songId').getAll(songId);
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsAll() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readonly');
    const req = tx.objectStore('runs').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunDelete(id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readwrite');
    const req = tx.objectStore('runs').delete(id);
    req.onsuccess = () => res();
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsClearForChart(songId, chartKey) {
  const runs = await dbRunsForChart(songId, chartKey);
  await Promise.all(runs.map(r => dbRunDelete(r.id)));
}
async function dbRunsClearForSong(songId) {
  const runs = await dbRunsForSong(songId);
  await Promise.all(runs.map(r => dbRunDelete(r.id)));
}

// ----- Helpers puros (testeables sin IndexedDB) -----------------------------
// `chartIdOf` produce la clave compuesta tanto al insertar como al consultar.
// Si cambia el separador, hay que cambiarlo en un solo sitio.
function chartIdOf(songId, chartKey) { return songId + ':' + chartKey; }

// Saneamiento del nombre del jugador antes de persistir. Cap 12 chars (estilo
// arcade), strip de control chars (evita corromper el render si alguien pega
// un  ), trim de whitespace. Si queda vacío devolvemos 'Anónimo' para que
// el ranking sea legible y no tenga filas con string vacío.
function sanitizePlayerName(s) {
  const cleaned = String(s == null ? '' : s)
    .replace(/[\x00-\x1f\x7f]/g, '')   // control chars (incluye DEL)
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim()
    .slice(0, 12);
  return cleaned || 'Anónimo';
}

// Orden arcade: score desc; ties por playedAt asc (la partida más antigua que
// alcanzó ese score se queda con la posición). Estable cuando ambos son iguales.
function rankRuns(runs) {
  return runs.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.playedAt || 0) - (b.playedAt || 0);
  });
}

// Para mostrar "top de la canción" colapsamos a un run por jugador (su mejor).
// Case-insensitive: 'Elena' y 'elena' se funden bajo el mismo playerLower, pero
// el nombre que se renderiza es el del run ganador (preserva casing original).
function bestRunPerPlayer(runs) {
  const byPlayer = new Map();
  for (const r of runs) {
    const key = r.playerLower || (r.playerName || '').toLowerCase();
    const prev = byPlayer.get(key);
    if (!prev || r.score > prev.score ||
        (r.score === prev.score && (r.playedAt || 0) < (prev.playedAt || 0))) {
      byPlayer.set(key, r);
    }
  }
  return rankRuns(Array.from(byPlayer.values()));
}

// ----- Último nombre de jugador (localStorage) ------------------------------
// Prefill del input "tu nombre" entre sesiones. Compartido con GH si en el
// futuro se añade el mismo sistema de runs allí.
const LAST_PLAYER_KEY = 'sincro-last-player';
function getLastPlayerName() {
  try { return localStorage.getItem(LAST_PLAYER_KEY) || ''; } catch (e) { return ''; }
}
function setLastPlayerName(name) {
  try { localStorage.setItem(LAST_PLAYER_KEY, name); } catch (e) {}
}

// ----- Settings (localStorage) ----------------------------------------------
const SETTINGS_KEY = 'stepmania-web-settings';
const settings = Object.assign({
  globalOffset: 0,    // ms
  scrollSpeed: 1.0,
  timingWindow: 'j5',
}, (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch(e) { return {}; } })());

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
  document.getElementById('scrollSpeed').value = settings.scrollSpeed;
  document.getElementById('scrollSpeedVal').textContent = settings.scrollSpeed.toFixed(1) + 'x';
  document.getElementById('timingWindow').value = settings.timingWindow;
  document.getElementById('timingWinVal').textContent = TIMING_WIN_LABEL[settings.timingWindow] || 'J5';
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('show'); }

// ----- Doble export CJS para tests (Vitest) ---------------------------------
// Solo helpers puros — las funciones de IndexedDB/localStorage no son testeables
// en Node sin mocks pesados. Mismo patrón que parser.js y difficulty-tiers.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    chartIdOf,
    sanitizePlayerName,
    rankRuns,
    bestRunPerPlayer
  };
}
