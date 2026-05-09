// ============================================================================
//  GAME ENGINE (Player) — countdown → audio start → main loop with lane
//  judging, holds/rolls lifecycle, mine penalty, render (receptors, holds,
//  notes, hit FX, beat pulse), and end-of-song scoring + persistence.
//  Timing windows scale per settings.timingWindow (J4..J7 = SM5/ITG presets).
// ============================================================================

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
const LANES = 4;
const LANE_KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
const LANE_PAD = [0, 1, 2, 3];

let gameState = null;
const canvas = document.getElementById('gameCanvas');
const ctx2d = canvas.getContext('2d');
let canvasW = 0, canvasH = 0;
function resizeCanvas() {
  canvasW = canvas.width = window.innerWidth;
  canvasH = canvas.height = window.innerHeight;
  buildArrowSprites();
}
window.addEventListener('resize', resizeCanvas);

// ----- Pre-rendered arrow sprite cache (rotated per lane) -------------------
const ARROW_SIZE = 56;
const arrowSpriteCache = new Map(); // key = laneRotation+'_'+color
function buildArrowSprites() { arrowSpriteCache.clear(); }
const LANE_ROTATION = [-90, 180, 0, 90]; // L, D, U, R — rotation of base arrow (which points up)

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
function getArrowSprite(lane, color) {
  const key = LANE_ROTATION[lane] + '_' + color + (noteskinImage ? '_png' : '');
  let s = arrowSpriteCache.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = c.height = ARROW_SIZE;
  const cx = c.getContext('2d');
  // PNG noteskin path — draw image rotated, then tint with quant color
  if (noteskinImage) {
    cx.translate(ARROW_SIZE/2, ARROW_SIZE/2);
    cx.rotate(LANE_ROTATION[lane] * Math.PI/180);
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
  cx.rotate(LANE_ROTATION[lane] * Math.PI/180);
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
async function startGame() {
  if (!selectedSong || !selectedChart) { goto('songs'); return; }
  resizeCanvas();
  ensureAudioCtx();
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (activeMods.shuffle) rerollShuffle();

  // Decode audio
  const arrayBuf = await selectedSong.audioBlob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf.slice(0));

  // Parse chart from sscText with timing engine
  const parsed = parseSscOrSm(selectedSong.sscText);
  const chartData = parsed.charts.find(c => (c.DIFFICULTY||'').toLowerCase() === selectedChart.key) || parsed.charts[0];
  const tEngine = buildTimingEngine(parsed.header, chartData);
  // Parse #ATTACKS — chart-level overrides song-level. Stored on gameState
  // and applied per-frame in gameLoop. Snapshot user mods so attacks don't
  // permanently mutate them across plays.
  const attacks = parseAttacks((chartData && chartData.ATTACKS) || parsed.header.ATTACKS || '');
  const baseMods = { ...activeMods };
  let notes = parseNotesToEvents(chartData.NOTES, tEngine);
  // Apply lane permutation modifiers
  for (const n of notes) n.lane = applyModsToLane(n.lane);
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

  // Countdown 3-2-1-GO before starting audio
  await runCountdown();

  // Start audio
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(audioCtx.destination);
  const startAt = audioCtx.currentTime + 0.05;
  src.start(startAt);

  gameState = {
    notes, audioBuffer, src,
    startTime: startAt,
    bpm: selectedSong.bpm,
    timingEngine: tEngine,
    beatTimes,
    duration: audioBuffer.duration,
    score: 0, combo: 0, maxCombo: 0,
    judgments: { marvelous: 0, perfect: 0, great: 0, good: 0, bad: 0, miss: 0 },
    pressedLanes: [false, false, false, false],
    keyHeld: [false, false, false, false],
    padPrev:  [false, false, false, false],
    flashTime: [0, 0, 0, 0],
    hitFx: [],   // {lane, t}
    songInfo: `${selectedSong.title} — ${selectedChart.name} ★${selectedChart.rating}`,
    finished: false,
    pixelsPerSec: 600 * settings.scrollSpeed * activeMods.chartSpeed,
    timing: getTimingWindows(),
    attacks,
    baseMods,
  };
  document.getElementById('hudSongInfo').textContent = gameState.songInfo;
  document.getElementById('hudScore').textContent = '0';
  document.getElementById('hudCombo').textContent = '0';

  src.onended = () => {
    if (gameState && !gameState.finished) {
      setTimeout(() => endGame(), 500);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  requestAnimationFrame(gameLoop);
}

function runCountdown() {
  return new Promise(resolve => {
    const el = document.getElementById('countdown');
    el.classList.remove('hidden');
    const seq = ['3','2','1','¡VAMOS!'];
    let i = 0;
    el.textContent = seq[0];
    const tick = () => {
      i++;
      if (i >= seq.length) {
        el.classList.add('hidden');
        resolve();
        return;
      }
      el.textContent = seq[i];
      setTimeout(tick, i === seq.length-1 ? 400 : 700);
    };
    setTimeout(tick, 700);
  });
}

function stopGame() {
  if (!gameState) return;
  try { gameState.src.stop(); } catch(e) {}
  // Restore user mods snapshot so attacks don't bleed into the next play
  if (gameState.baseMods) Object.assign(activeMods, gameState.baseMods);
  window.removeEventListener('keydown', onKeyDown);
  window.removeEventListener('keyup', onKeyUp);
  gameState = null;
}

function onKeyDown(e) {
  if (!gameState || gameState.finished) return;
  if (e.code === 'Escape') { e.preventDefault(); stopGame(); goto('diff'); return; }
  const lane = LANE_KEYS.indexOf(e.code);
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
  const lane = LANE_KEYS.indexOf(e.code);
  if (lane === -1) return;
  gameState.keyHeld[lane] = false;
  if (!gamepadButtonState[LANE_PAD[lane]]) {
    gameState.pressedLanes[lane] = false;
    handleLaneRelease(lane);
  }
}

// Lift notes are judged when the player RELEASES the lane (instead of pressing).
// We pick the closest unjudged lift in window, like handleLanePress does.
function handleLaneRelease(lane) {
  if (!gameState || gameState.finished) return;
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
  gameState.hitFx.push(makeHitFx(lane));
  showJudgment(judg);
}

function gameLoop() {
  if (!gameState) return;
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
  for (let i = 0; i < 4; i++) {
    const padBtn = LANE_PAD[i];
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

  render(audioTime);

  if (audioTime > gameState.duration + 1) { endGame(); return; }
  requestAnimationFrame(gameLoop);
}

function handleLanePress(lane) {
  if (!gameState || gameState.finished) return;
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
  gameState.hitFx.push(makeHitFx(lane));
  showJudgment(judg);
}

// Particle burst on hit. Each particle has its own velocity + gravity for
// natural arc. ~10 particles per hit, ~350ms life. Cleanup is handled in render
// (filter by age). Cheap: ~100 active particles in worst case.
function makeHitFx(lane) {
  const particles = [];
  const N = 10;
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i / N) + (Math.random() - 0.5) * 0.3;
    const speed = 80 + Math.random() * 120;
    particles.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,    // initial upward bias
      x0: 0, y0: 0
    });
  }
  return { lane, t: performance.now(), particles };
}

function showJudgment(judg) {
  const el = document.getElementById('hudJudgment');
  el.textContent = judg.toUpperCase();
  el.className = 'judgment show ' + judg;
  setTimeout(() => { if (el.classList) el.classList.remove('show'); }, 400);
}

const LANE_TINT = ['#ff006e', '#3a86ff', '#00ff64', '#ffbe0b'];

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

  const laneWidth = 80;
  const totalWidth = laneWidth * 4;
  const startX = W/2 - totalWidth/2;
  const receptorY = 110;
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
  for (let i = 0; i <= 4; i++) {
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

  // Receptor row
  for (let i = 0; i < 4; i++) {
    const cx = startX + i*laneWidth + laneWidth/2;
    const cy = receptorY;
    // Outer ring (beat pulse)
    ctx2d.strokeStyle = `rgba(255,255,255,${0.15 + beatPulse*0.5})`;
    ctx2d.lineWidth = 2 + beatPulse*2;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 32 + beatPulse*4, 0, Math.PI*2);
    ctx2d.stroke();
    // Lane-color receptor
    ctx2d.strokeStyle = LANE_TINT[i];
    ctx2d.lineWidth = 3;
    ctx2d.beginPath();
    ctx2d.arc(cx, cy, 28, 0, Math.PI*2);
    ctx2d.stroke();
    // Press flash
    const flashAge = (performance.now() - gameState.flashTime[i]) / 200;
    const flashAlpha = Math.max(0, 1 - flashAge);
    if (flashAlpha > 0) {
      ctx2d.fillStyle = `rgba(255,255,255,${flashAlpha*0.5})`;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, 26, 0, Math.PI*2);
      ctx2d.fill();
    }
    // Receptor arrow outline (transparent)
    const sprite = getArrowSprite(i, 'rgba(160,160,180,0.35)');
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
    ctx2d.fillStyle = released ? 'rgba(120,120,120,0.4)' : grad;
    ctx2d.fillRect(cx-22, top, 44, Math.max(0, bot-top));
    // Tail cap
    ctx2d.fillStyle = released ? 'rgba(120,120,120,0.55)' : (n.type === 'roll' ? '#ff8800' : '#00f5d4');
    ctx2d.beginPath();
    ctx2d.moveTo(cx-22, bot);
    ctx2d.lineTo(cx+22, bot);
    ctx2d.lineTo(cx, bot+18);
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
      // Pulsating mine
      const pulse = 0.7 + 0.3 * Math.sin(performance.now()/100);
      ctx2d.fillStyle = `rgba(255,51,102,${pulse})`;
      ctx2d.beginPath(); ctx2d.arc(cx, y, 18, 0, Math.PI*2); ctx2d.fill();
      ctx2d.fillStyle = '#fff'; ctx2d.font = 'bold 18px sans-serif';
      ctx2d.textAlign = 'center'; ctx2d.textBaseline = 'middle';
      ctx2d.fillText('M', cx, y);
      ctx2d.restore();
      continue;
    }

    if (n.type === 'fake') {
      // Fakes: ghosted arrow (40% alpha), no scoring
      ctx2d.save();
      ctx2d.globalAlpha = alpha * 0.4;
      const sprite = getArrowSprite(n.lane, '#888');
      ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, y - ARROW_SIZE/2);
      ctx2d.restore();
      continue;
    }

    if (n.type === 'lift') {
      // Lifts: hollow arrow outline (released-on-beat semantics)
      ctx2d.save();
      ctx2d.globalAlpha = alpha;
      const color = quantColorFor(n.row || 0, n.total || 4);
      const sprite = getArrowSprite(n.lane, color);
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
      const sprite = getArrowSprite(n.lane, '#666');
      ctx2d.drawImage(sprite, cx - ARROW_SIZE/2, y - ARROW_SIZE/2);
      ctx2d.restore();
      continue;
    }

    const color = quantColorFor(n.row || 0, n.total || 4);
    ctx2d.save();
    ctx2d.globalAlpha = alpha;
    const sprite = getArrowSprite(n.lane, color);
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

  // Hit FX: radial ring + particle burst per hit. Particles use ballistic
  // motion (vx const, vy with gravity) — gives a fountain-like splash.
  const now = performance.now();
  gameState.hitFx = gameState.hitFx.filter(fx => now - fx.t < 350);
  for (const fx of gameState.hitFx) {
    const ageMs = now - fx.t;
    const age = ageMs / 350;
    const alpha = 1 - age;
    const radius = 30 + age * 50;
    const cx = startX + fx.lane*laneWidth + laneWidth/2;
    // Outer white ring
    ctx2d.strokeStyle = `rgba(255,255,255,${alpha*0.6})`;
    ctx2d.lineWidth = 3 * (1-age);
    ctx2d.beginPath(); ctx2d.arc(cx, receptorY, radius, 0, Math.PI*2); ctx2d.stroke();
    // Lane-tinted ring (smaller)
    ctx2d.strokeStyle = `${LANE_TINT[fx.lane]}${Math.floor(alpha*255).toString(16).padStart(2,'0')}`;
    ctx2d.lineWidth = 5 * (1-age);
    ctx2d.beginPath(); ctx2d.arc(cx, receptorY, radius*0.7, 0, Math.PI*2); ctx2d.stroke();
    // Particles (if present — old fx without particles still render the rings)
    if (fx.particles) {
      const t = ageMs / 1000;
      const G = 280; // gravity (px/s²)
      ctx2d.fillStyle = LANE_TINT[fx.lane];
      for (const p of fx.particles) {
        const px = cx + p.vx * t;
        const py = receptorY + p.vy * t + 0.5 * G * t * t;
        const size = 4 * (1 - age);
        if (size <= 0) continue;
        ctx2d.globalAlpha = alpha;
        ctx2d.beginPath(); ctx2d.arc(px, py, size, 0, Math.PI*2); ctx2d.fill();
      }
      ctx2d.globalAlpha = 1;
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
}

async function endGame() {
  if (!gameState || gameState.finished) return;
  gameState.finished = true;
  const j = gameState.judgments;
  const total = j.marvelous + j.perfect + j.great + j.good + j.bad + j.miss;
  const accuracy = total ? ((j.marvelous + j.perfect*0.9 + j.great*0.7 + j.good*0.4) / total * 100) : 0;
  const grade = accuracy >= 95 ? 'AAA' : accuracy >= 90 ? 'AA' : accuracy >= 80 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 60 ? 'C' : 'D';

  // Save high score (only if better than previous)
  if (selectedSong && selectedChart) {
    const prev = await dbScoreGet(selectedSong.id, selectedChart.key);
    if (!prev || (gameState.score > (prev.score||0))) {
      await dbScoreSet(selectedSong.id, selectedChart.key, {
        score: gameState.score, grade, accuracy: +accuracy.toFixed(2),
        maxCombo: gameState.maxCombo, judgments: j, mods: {...activeMods},
        playedAt: Date.now()
      });
    }
  }

  document.getElementById('resultsTitle').textContent = grade + ' — ' + Math.round(accuracy) + '%';
  let html = `<div style="text-align:center;font-size:0.9em;color:#aaa;margin-bottom:14px">${gameState.songInfo}</div>`;
  html += `<div class="stat-line"><span class="key">Score:</span><span style="color:#ffbe0b;font-weight:700">${gameState.score.toLocaleString()}</span></div>`;
  html += `<div class="stat-line"><span class="key">Combo máximo:</span><span>${gameState.maxCombo}</span></div>`;
  html += `<div class="stat-line"><span class="key" style="color:#00f5d4">Marvelous:</span><span>${j.marvelous}</span></div>`;
  html += `<div class="stat-line"><span class="key" style="color:#ffbe0b">Perfect:</span><span>${j.perfect}</span></div>`;
  html += `<div class="stat-line"><span class="key" style="color:#00ff64">Great:</span><span>${j.great}</span></div>`;
  html += `<div class="stat-line"><span class="key" style="color:#3a86ff">Good:</span><span>${j.good}</span></div>`;
  html += `<div class="stat-line"><span class="key" style="color:#ff006e">Bad:</span><span>${j.bad}</span></div>`;
  html += `<div class="stat-line"><span class="key" style="color:#ff3366">Miss:</span><span>${j.miss}</span></div>`;
  document.getElementById('resultsContent').innerHTML = html;
  stopGame();
  goto('results');
}
