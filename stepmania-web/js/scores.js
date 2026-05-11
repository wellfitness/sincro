// ============================================================================
//  SCORES — Sistema arcade de puntuaciones (store `runs` en IndexedDB).
//
//  Módulo INDEPENDIENTE — lo cargan tanto stepmania-play.html (motor SM) como
//  gh-play.html (motor GH) como rankings.html (vista dedicada). Por eso vive
//  separado de core.js (que es el "core" del motor SM y trae cosas como
//  gamepad polling que no aplican fuera del juego).
//
//  Cada `_scoresOpenDB()` declara el MISMO schema migration que core.js,
//  gh-db.js y autostepper.html. IndexedDB permite múltiples handles a la
//  misma DB con la misma versión; solo el primer abridor dispara
//  `onupgradeneeded`, así que esta duplicación es defensiva — garantiza que
//  abras desde donde abras (motor SM, motor GH, autostepper, rankings) la
//  migración v3→v4 se aplica una vez. Si cambias el schema, actualízalo en
//  los 4 sitios o tendrás VersionError en algún flow.
//
//  Diseño del store `runs` (cada fila = una partida):
//    { id (autoinc), songId, chartKey, chartId ('songId:chartKey'),
//      playerName, playerLower, score, grade, accuracy, maxCombo,
//      judgments, mods, playedAt, gameType ('sm' | 'gh') }
//
//  `gameType` permite distinguir partidas de StepMania y Guitar Hero en la
//  misma DB. Si un run no lo tiene (formato pre-GH), se asume 'sm'.
// ============================================================================

const SCORES_DB_NAME = 'StepManiaWebDB';
const SCORES_DB_VERSION = 4;
let _scoresDbPromise = null;

function _scoresOpenDB() {
  if (_scoresDbPromise) return _scoresDbPromise;
  _scoresDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(SCORES_DB_NAME, SCORES_DB_VERSION);
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
  return _scoresDbPromise;
}

// ----- CRUD del store `runs` ------------------------------------------------
async function dbRunAdd(run) {
  const db = await _scoresOpenDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readwrite');
    const req = tx.objectStore('runs').add(run);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsForChart(songId, chartKey) {
  const db = await _scoresOpenDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readonly');
    const req = tx.objectStore('runs').index('chartId').getAll(chartIdOf(songId, chartKey));
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsForSong(songId) {
  const db = await _scoresOpenDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readonly');
    const req = tx.objectStore('runs').index('songId').getAll(songId);
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunsAll() {
  const db = await _scoresOpenDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('runs', 'readonly');
    const req = tx.objectStore('runs').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
async function dbRunDelete(id) {
  const db = await _scoresOpenDB();
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
function chartIdOf(songId, chartKey) { return songId + ':' + chartKey; }

// Los stores `songs` (SM) y `gh-songs` (GH) son autoincrement independientes,
// así que el mismo songId numérico puede existir en ambos. Las consultas a
// `runs` por índice `songId` devuelven mezclas — los callers que solo quieren
// ver runs de un juego deben filtrar por gameType. Runs antiguos sin campo se
// asumen 'sm' (formato pre-refactor).
function filterRunsByGame(runs, gameType) {
  return (runs || []).filter(r => (r.gameType || 'sm') === gameType);
}

function sanitizePlayerName(s) {
  const cleaned = String(s == null ? '' : s)
    .replace(/[\x00-\x1f\x7f]/g, '')   // control chars (incluye DEL)
    .replace(/\s+/g, ' ')              // collapse whitespace
    .trim()
    .slice(0, 12);
  return cleaned || 'Anónimo';
}

function rankRuns(runs) {
  return runs.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.playedAt || 0) - (b.playedAt || 0);
  });
}

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
const LAST_PLAYER_KEY = 'sincro-last-player';
function getLastPlayerName() {
  try { return localStorage.getItem(LAST_PLAYER_KEY) || ''; } catch (e) { return ''; }
}
function setLastPlayerName(name) {
  try { localStorage.setItem(LAST_PLAYER_KEY, name); } catch (e) {}
}

// ----- Export/Import JSON de puntuaciones -----------------------------------
// El backup ZIP completo (backup.js / gh-backup.js) incluye canciones + audio
// + runs y pesa mucho. Estas funciones permiten exportar SOLO los runs como
// JSON ligero, asumiendo que el usuario importará en un dispositivo que ya
// tenga la misma biblioteca (mismos songIds). Si los songIds no coinciden el
// import los descarta — IDs cambian al re-importar canciones.
async function exportRunsJson() {
  const runs = await dbRunsAll();
  const payload = {
    type: 'sincro-runs',
    version: 1,
    exportedAt: new Date().toISOString(),
    count: runs.length,
    runs: runs.map(({ id, ...rest }) => rest)  // id se regenera al importar
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sincro-puntuaciones-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return { count: runs.length, sizeKB: (blob.size / 1024).toFixed(1) };
}

// Resultado: { imported, skipped, total }
//   imported = filas insertadas
//   skipped  = filas con songId no encontrado en `songs` ni `gh-songs`
//   total    = filas en el archivo
async function importRunsJson(file) {
  const text = await file.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch (e) { throw new Error('JSON inválido: ' + e.message); }
  if (!payload || payload.type !== 'sincro-runs' || !Array.isArray(payload.runs)) {
    throw new Error('Formato no reconocido (se esperaba { type: "sincro-runs", runs: [...] })');
  }
  // Verificamos qué songIds existen en la DB local (tanto SM `songs` como GH
  // `gh-songs`). Si un run apunta a un songId ausente, lo descartamos — sin
  // canción asociada el ranking no tendría sentido.
  const db = await _scoresOpenDB();
  const [smIds, ghIds] = await Promise.all([
    new Promise((res, rej) => {
      const tx = db.transaction('songs', 'readonly');
      const req = tx.objectStore('songs').getAllKeys();
      req.onsuccess = () => res(new Set(req.result || []));
      req.onerror = () => rej(req.error);
    }),
    new Promise((res, rej) => {
      const tx = db.transaction('gh-songs', 'readonly');
      const req = tx.objectStore('gh-songs').getAllKeys();
      req.onsuccess = () => res(new Set(req.result || []));
      req.onerror = () => rej(req.error);
    })
  ]);
  let imported = 0, skipped = 0;
  for (const run of payload.runs) {
    const gameType = run.gameType || 'sm';
    const validIds = gameType === 'gh' ? ghIds : smIds;
    if (!validIds.has(run.songId)) { skipped++; continue; }
    const playerName = run.playerName || 'Anónimo';
    await dbRunAdd({
      ...run,
      chartId: chartIdOf(run.songId, run.chartKey),
      playerName,
      playerLower: playerName.toLowerCase(),
      gameType
    });
    imported++;
  }
  return { imported, skipped, total: payload.runs.length };
}

// ----- Doble export CJS para tests (Vitest) ---------------------------------
// Solo helpers puros — las funciones de IndexedDB/localStorage no son testeables
// en Node sin mocks pesados. Mismo patrón que parser.js y difficulty-tiers.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    chartIdOf,
    sanitizePlayerName,
    rankRuns,
    bestRunPerPlayer,
    filterRunsByGame
  };
}
