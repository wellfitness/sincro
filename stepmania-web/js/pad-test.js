// ============================================================================
//  PAD TEST — visual grid, raw LEDs, latency test, ghost-input monitor.
//  Reads from gamepadButtonState/gamepadJustPressed defined in core.js.
//  padTestLoop() autostarts from app.js (always running, dispatches into the
//  active sub-test when its tab is open).
// ============================================================================

const padCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
let padPollSamples = [];

// Build 16 raw LED cells once (shows bitmask of buttons in real time).
const btnGridEl = document.getElementById('btnGrid');
for (let i = 0; i < 16; i++) {
  const led = document.createElement('div');
  led.className = 'btn-led';
  led.id = 'pad-btn-' + i;
  led.textContent = 'B' + (i+1);
  btnGridEl.appendChild(led);
}

// Tab switcher inside pad-screen.
document.querySelectorAll('#pad-screen .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#pad-screen .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#pad-screen .tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('ptab-' + btn.dataset.tab).classList.add('active');
  });
});

function resetPadCounts() {
  Object.keys(padCounts).forEach(k => padCounts[k] = 0);
  document.querySelectorAll('.pad-cell.arrow .count').forEach(c => c.textContent = '0');
}

function padTestLoop() {
  const now = performance.now();
  let bitmask = 0;
  let anyChange = false;

  for (let i = 0; i < 16; i++) {
    const pressed = gamepadButtonState[i];
    if (pressed) bitmask |= (1 << i);
    const led = document.getElementById('pad-btn-' + i);
    if (led) led.classList.toggle('on', pressed);

    const cell = document.querySelector(`#pad-screen .pad-cell.arrow[data-button="${i}"]`);
    if (cell) cell.classList.toggle('active', pressed);

    if (gamepadJustPressed[i]) {
      anyChange = true;
      if (padCounts[i] !== undefined) {
        padCounts[i]++;
        const c = cell?.querySelector('.count');
        if (c) c.textContent = padCounts[i];
      }
      // Dispatch to active sub-tests
      if (latencyState && latencyState.targetBit === i) handleLatencyHit(i, now);
      else if (latencyState && latencyState.targetBit !== null) handleLatencyHit(i, now);
      if (ghostState) handleGhostHit(i, now);
    }
  }
  if (anyChange) {
    padPollSamples.push(now);
    while (padPollSamples.length > 0 && now - padPollSamples[0] > 1000) padPollSamples.shift();
  }
  while (padPollSamples.length > 0 && now - padPollSamples[0] > 1000) padPollSamples.shift();
  document.getElementById('i-bits').textContent = bitmask;
  document.getElementById('i-poll').textContent = padPollSamples.length + ' Hz';
  requestAnimationFrame(padTestLoop);
}

// ----- LATENCY ---------------------------------------------------------------
let latencyState = null;
function startLatency() {
  latencyState = { round: 0, total: 8, results: [], targetBit: null, targetTime: 0 };
  document.getElementById('latencyLog').innerHTML = '';
  document.getElementById('latencyBtn').disabled = true;
  document.getElementById('latencyDisplay').textContent = '...';
  nextLatencyRound();
}
function nextLatencyRound() {
  if (!latencyState) return;
  if (latencyState.round >= latencyState.total) return finishLatency();
  document.getElementById('latencyStatus').textContent = `Ronda ${latencyState.round+1}/${latencyState.total} — prepárate...`;
  setTimeout(() => {
    if (!latencyState) return;
    const targets = [0, 1, 2, 3];
    const t = targets[Math.floor(Math.random() * 4)];
    latencyState.targetBit = t;
    latencyState.targetTime = performance.now();
    document.querySelectorAll('.pad-cell.arrow').forEach(c => c.style.background = '');
    const cell = document.querySelector(`.pad-cell.arrow[data-button="${t}"]`);
    if (cell) cell.style.background = 'linear-gradient(135deg, #3a86ff, #00f5d4)';
    const NAMES = { 0:'IZQUIERDA', 1:'ABAJO', 2:'ARRIBA', 3:'DERECHA' };
    document.getElementById('latencyStatus').textContent = `¡Pisa ${NAMES[t]}!`;
  }, 800 + Math.random() * 1500);
}
function handleLatencyHit(bit, now) {
  if (!latencyState || latencyState.targetBit === null) return;
  const log = document.getElementById('latencyLog');
  if (bit === latencyState.targetBit) {
    const ms = now - latencyState.targetTime;
    latencyState.results.push({ bit, ms });
    log.innerHTML += `<span class="ok">✓ panel ${bit}: ${Math.round(ms)}ms</span>\n`;
  } else {
    log.innerHTML += `<span class="bad">✗ esperaba ${latencyState.targetBit}, pisaste ${bit}</span>\n`;
  }
  log.scrollTop = log.scrollHeight;
  document.querySelectorAll('.pad-cell.arrow').forEach(c => c.style.background = '');
  latencyState.targetBit = null;
  latencyState.round++;
  if (latencyState.round < latencyState.total) nextLatencyRound();
  else finishLatency();
}
function finishLatency() {
  if (!latencyState) return;
  const r = latencyState.results;
  if (r.length) {
    const avg = r.reduce((a,b)=>a+b.ms,0)/r.length;
    document.getElementById('latencyDisplay').textContent = Math.round(avg) + ' ms';
    document.getElementById('latencyStatus').textContent = `Promedio: ${Math.round(avg)}ms`;
  }
  document.getElementById('latencyBtn').disabled = false;
  latencyState = null;
}

// ----- GHOST -----------------------------------------------------------------
let ghostState = null;
function startGhost() {
  ghostState = { started: performance.now(), duration: 60000, events: 0 };
  document.getElementById('ghostBtn').disabled = true;
  document.getElementById('ghostCount').textContent = '0';
  document.getElementById('ghostLog').innerHTML = '<span class="info">NO PISES la alfombra.</span>\n';
  ghostTick();
}
function ghostTick() {
  if (!ghostState) return;
  const elapsed = performance.now() - ghostState.started;
  document.getElementById('ghostStatus').textContent = `Quedan ${Math.ceil((ghostState.duration-elapsed)/1000)}s · eventos: ${ghostState.events}`;
  if (elapsed >= ghostState.duration) {
    const log = document.getElementById('ghostLog');
    log.innerHTML += ghostState.events === 0
      ? '<span class="ok">✓ Sin inputs fantasma. Sensores limpios.</span>\n'
      : `<span class="bad">✗ ${ghostState.events} eventos detectados.</span>\n`;
    document.getElementById('ghostBtn').disabled = false;
    ghostState = null;
    return;
  }
  setTimeout(ghostTick, 250);
}
function handleGhostHit(bit, now) {
  if (!ghostState) return;
  ghostState.events++;
  document.getElementById('ghostCount').textContent = ghostState.events;
  const t = ((now - ghostState.started)/1000).toFixed(2);
  const log = document.getElementById('ghostLog');
  log.innerHTML += `<span class="bad">[${t}s] FANTASMA: B${bit+1}</span>\n`;
  log.scrollTop = log.scrollHeight;
}
