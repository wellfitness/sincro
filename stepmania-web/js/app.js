// ============================================================================
//  APP — top-level navigation, settings modal bindings, app kickoff.
//  Loaded LAST: depends on every other module being defined.
// ============================================================================

const SCREENS = ['menu', 'pad', 'create', 'library', 'songs', 'diff', 'play', 'results'];
const CRUMBS = {
  menu: '', pad: 'Test de alfombra', create: 'Crear charts',
  library: 'Librería', songs: 'Jugar', diff: 'Dificultad',
  play: 'Jugando', results: 'Resultados'
};
let currentScreen = 'menu';

function goto(name) {
  if (currentScreen === 'play' && name !== 'play') stopGame();
  for (const s of SCREENS) {
    document.getElementById(s + '-screen').classList.toggle('hidden', s !== name);
  }
  currentScreen = name;
  document.getElementById('crumb').textContent = CRUMBS[name] ? '· ' + CRUMBS[name] : '';
  if (name === 'library') refreshLibrary();
  if (name === 'songs')   refreshSongs();
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

// ----- Kickoff ---------------------------------------------------------------
pollGamepad();   // start gamepad RAF loop (defined in core.js)
padTestLoop();   // start pad-test RAF loop (defined in pad-test.js)
goto('menu');    // initial screen
