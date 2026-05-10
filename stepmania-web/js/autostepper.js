// ============================================================================
//  AUTOSTEPPER — full pipeline: decode → bass-emphasis → ODF → BPM/offset →
//  quantize 192-grid → generate 5 difficulties → SSC builder → ZIP encoder.
//  Pure JS, no external deps. Uses audioCtx/ensureAudioCtx from core.js.
// ============================================================================

const queue = [];
let queueIdCounter = 0;
let analyzing = false;
let cancelRequested = false;

function log(msg, cls='') {
  const el = document.getElementById('analyzeLog');
  el.innerHTML += `<span class="${cls}">${msg}</span>\n`;
  el.scrollTop = el.scrollHeight;
}

// ----- Drop zone + file input ------------------------------------------------
// NOTA: NO añadimos un click handler manual al dropZone. El <input type="file">
// vive dentro del <label class="drop-zone"> y el click del label ya dispara el
// input nativamente. Si añadimos un listener que llame a fileInput.click(), el
// dialog se abre dos veces y el usuario tiene que elegir las canciones dos
// veces — el bug que el explorador "no funcionaba bien". Mismo patrón que
// autostepper.html standalone.
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length) addFiles(e.target.files);
  e.target.value = '';
});

function addFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('audio/')) continue;
    const noExt = file.name.replace(/\.[^.]+$/, '');
    const m = noExt.match(/^(.+?)\s*-\s*(.+)$/);
    let artist = '', title = noExt;
    if (m) { artist = m[1].trim(); title = m[2].trim(); }
    queue.push({ id: ++queueIdCounter, file, title, artist, status: 'pending', bpmOverride: '', result: null });
  }
  renderQueue();
  document.getElementById('optionsCard').style.display = queue.length ? '' : 'none';
}

function clearQueue() {
  if (analyzing) return;
  queue.length = 0;
  renderQueue();
  document.getElementById('optionsCard').style.display = 'none';
  document.getElementById('exportCard').classList.add('hidden');
}

function renderQueue() {
  const c = document.getElementById('queueContainer');
  if (queue.length === 0) { c.innerHTML = ''; return; }
  let html = `<div class="queue">
    <div class="queue-row header"><div>Archivo</div><div>Estado</div><div>BPM</div><div>Pasos</div><div>Acciones</div></div>`;
  for (const q of queue) {
    const bpm = q.result ? q.result.bpm.toFixed(1) : '--';
    const steps = q.result ? q.result.charts.reduce((s,c) => s+c.count, 0) : '--';
    html += `<div class="queue-row">
      <div class="name"><div style="font-weight:600">${escapeHtml(q.title)}</div><div style="color:#888;font-size:0.78em">${escapeHtml(q.artist)}</div></div>
      <div><span class="badge ${q.status}">${q.status}</span></div>
      <div>${bpm}</div>
      <div>${steps}</div>
      <div><button class="icon-btn danger" onclick="removeFromQueue(${q.id})" ${analyzing?'disabled':''}>×</button></div>
    </div>`;
  }
  html += '</div>';
  c.innerHTML = html;
}

function removeFromQueue(id) {
  const i = queue.findIndex(q => q.id === id);
  if (i >= 0) queue.splice(i, 1);
  renderQueue();
}

// ----- Audio processing ------------------------------------------------------
async function decodeFile(file) {
  ensureAudioCtx();
  const buf = await file.arrayBuffer();
  return await audioCtx.decodeAudioData(buf.slice(0));
}
function toMono(buffer) {
  const ch0 = buffer.getChannelData(0);
  if (buffer.numberOfChannels === 1) return ch0;
  const ch1 = buffer.getChannelData(1);
  const out = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) out[i] = (ch0[i] + ch1[i]) * 0.5;
  return out;
}
function computeEnergyEnvelope(samples, sr) {
  const winSize = Math.floor(sr * 23 / 1000);
  const hopSize = Math.floor(sr * 5 / 1000);
  const numFrames = Math.max(0, Math.floor((samples.length - winSize) / hopSize));
  const env = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    const start = f * hopSize;
    for (let i = 0; i < winSize; i++) { const s = samples[start + i]; sum += s*s; }
    env[f] = Math.sqrt(sum / winSize);
  }
  return { env, framesPerSec: sr / hopSize };
}
function computeODF(env) {
  const odf = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) {
    const d = Math.log(env[i]+1e-6) - Math.log(env[i-1]+1e-6);
    odf[i] = d > 0 ? d : 0;
  }
  let max = 0;
  for (let i = 0; i < odf.length; i++) if (odf[i] > max) max = odf[i];
  if (max > 0) for (let i = 0; i < odf.length; i++) odf[i] /= max;
  return odf;
}
function pickPeaks(odf, framesPerSec, sensitivity) {
  const peaks = [];
  const halfWin = Math.floor(framesPerSec * 0.075);
  const minSpacing = Math.floor(framesPerSec * 0.05);
  const meanArr = new Float32Array(odf.length);
  let sum = 0;
  const winLen = Math.min(2*halfWin + 1, odf.length);
  for (let i = 0; i < winLen; i++) sum += odf[i];
  for (let i = 0; i < odf.length; i++) {
    const lo = i - halfWin - 1, hi = i + halfWin;
    if (lo >= 0 && hi < odf.length) sum += odf[hi] - odf[lo];
    meanArr[i] = sum / Math.max(1, winLen);
  }
  for (let i = 1; i < odf.length - 1; i++) {
    const thresh = Math.max(0.02, meanArr[i] * sensitivity);
    if (odf[i] > thresh && odf[i] > odf[i-1] && odf[i] >= odf[i+1]) {
      if (peaks.length === 0 || i - peaks[peaks.length-1] >= minSpacing) peaks.push(i);
    }
  }
  return peaks;
}
function detectBPM(odf, framesPerSec) {
  const minLag = Math.floor(framesPerSec * 60 / 200);
  const maxLag = Math.floor(framesPerSec * 60 / 60);
  let best = { lag: 0, score: 0 };
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    const N = odf.length - lag;
    for (let i = 0; i < N; i++) s += odf[i] * odf[i + lag];
    if (s > best.score) best = { lag, score: s };
  }
  let bpm = 60 * framesPerSec / best.lag;
  while (bpm < 80) bpm *= 2;
  while (bpm > 200) bpm /= 2;
  return bpm;
}
function detectOffset(odf, framesPerSec, bpm) {
  const beatFrames = framesPerSec * 60 / bpm;
  const numBeats = Math.floor(odf.length / beatFrames);
  let best = { phase: 0, score: 0 };
  const step = Math.max(1, Math.floor(beatFrames / 100));
  for (let phase = 0; phase < beatFrames; phase += step) {
    let s = 0;
    for (let b = 0; b < numBeats; b++) {
      const idx = Math.round(phase + b * beatFrames);
      if (idx < odf.length) s += odf[idx];
    }
    if (s > best.score) best = { phase, score: s };
  }
  return best.phase / framesPerSec;
}

// ----- Chart generation (192-grid) ------------------------------------------
const VALID_SUBDIVISIONS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 192];
const RES_SPACING = { '4': 48, '8': 24, '16': 12 };

function quantizeOnsetsTo192(onsets, bpm, offset) {
  const bps = bpm / 60;
  return [...new Set(onsets.map(t => Math.round((t-offset)*bps*48)).filter(p => p>=0))].sort((a,b)=>a-b);
}
function snapToResolution(positions, resolution) {
  const sp = RES_SPACING[resolution] || 12;
  return [...new Set(positions.map(p => Math.round(p/sp)*sp))].sort((a,b)=>a-b);
}
function generateBaseNotes(positions, difficulty, jumpProb, handsProb, numLanes, bpm, offsetSec, presetMul) {
  const N = numLanes || 4;
  // Filtrado calibrado a NPS objetivo + minGap absoluto en segundos.
  // Si DifficultyTiers no está disponible o falta BPM, fallback al pass-through.
  const filtered = (window.DifficultyTiers && bpm)
    ? window.DifficultyTiers.filterPositions48(positions, bpm, offsetSec, difficulty, presetMul)
    : positions.slice();
  const notes = [];
  let last = -1, lastLast = -1;
  const realJumpProb = difficulty === 'challenge' ? jumpProb*1.4 : difficulty === 'hard' ? jumpProb : difficulty === 'medium' ? jumpProb*0.3 : 0;
  const realHandsProb = difficulty === 'challenge' ? handsProb : 0;
  for (const pos of filtered) {
    const cols = new Array(N).fill(0);
    let arr, tries = 0;
    do { arr = Math.floor(Math.random()*N); tries++; } while ((arr===last||arr===lastLast) && tries<8);
    cols[arr] = 1;
    if (Math.random() < realJumpProb) {
      let j; do { j = Math.floor(Math.random()*N); } while (j === arr);
      cols[j] = 1;
      if (Math.random() < realHandsProb) {
        let t; do { t = Math.floor(Math.random()*N); } while (cols[t] === 1);
        cols[t] = 1;
      }
    }
    notes.push({ pos, cols });
    lastLast = last; last = arr;
  }
  return notes;
}
function addHoldsAndRolls(notes, difficulty, holdDensity, numLanes) {
  if (difficulty === 'beginner') return notes;
  const N = numLanes || 4;
  let holdProb, rollProb;
  if (difficulty === 'easy')           { holdProb = holdDensity*0.6; rollProb = 0; }
  else if (difficulty === 'medium')    { holdProb = holdDensity*0.9; rollProb = 0; }
  else if (difficulty === 'hard')      { holdProb = holdDensity;     rollProb = 0.05; }
  else                                 { holdProb = holdDensity*1.1; rollProb = 0.10; }
  const minHold = 24, maxHold = 96, minGap = 24;
  const byPos = new Map();
  for (const n of notes) byPos.set(n.pos, n);
  const sorted = [...notes].sort((a,b) => a.pos-b.pos);
  for (let i = 0; i < sorted.length-1; i++) {
    const cur = sorted[i], next = sorted[i+1];
    const gap = next.pos - cur.pos;
    if (gap < minGap || Math.random() > holdProb) continue;
    const taps = [];
    for (let c = 0; c < N; c++) if (cur.cols[c] === 1) taps.push(c);
    if (taps.length === 0) continue;
    const col = taps[Math.floor(Math.random()*taps.length)];
    const maxLen = Math.min(maxHold, gap-1);
    if (maxLen < minHold) continue;
    let len = minHold + Math.floor(Math.random()*(maxLen-minHold+1));
    len = Math.round(len/12)*12;
    if (len < minHold || len > maxLen) continue;
    const endPos = cur.pos + len;
    let endNote = byPos.get(endPos);
    if (!endNote) { endNote = { pos: endPos, cols: new Array(N).fill(0) }; byPos.set(endPos, endNote); notes.push(endNote); }
    if (endNote.cols[col] !== 0) continue;
    cur.cols[col] = Math.random() < rollProb ? 4 : 2;
    endNote.cols[col] = 3;
  }
  notes.sort((a,b) => a.pos-b.pos);
  return notes;
}
function pickMeasureSubdivision(positions) {
  if (!positions.length) return 4;
  for (const sub of VALID_SUBDIVISIONS) {
    const sp = 192/sub;
    if (positions.every(p => p % sp === 0)) return sub;
  }
  return 192;
}
function notesToRows(notes, totalUnits, numLanes) {
  const N = numLanes || 4;
  const emptyRow = '0'.repeat(N);
  const totalMeasures = Math.max(1, Math.ceil(totalUnits/192));
  const noteMap = new Map();
  for (const n of notes) noteMap.set(n.pos, n.cols);
  const byMeasure = Array.from({length: totalMeasures}, () => []);
  for (const n of notes) {
    const m = Math.floor(n.pos/192);
    if (m >= 0 && m < totalMeasures) byMeasure[m].push(n.pos - m*192);
  }
  let out = '';
  for (let m = 0; m < totalMeasures; m++) {
    if (m > 0) out += ',\n';
    const sub = pickMeasureSubdivision(byMeasure[m]);
    const sp = 192/sub;
    for (let r = 0; r < sub; r++) {
      const pos = m*192 + r*sp;
      const cols = noteMap.get(pos);
      out += (cols ? cols.map(c => String(c)).join('') : emptyRow) + '\n';
    }
  }
  return out.trimEnd();
}
function calculateRadar(notes, totalMeasures, durationSec) {
  let taps = 0, holds = 0, rolls = 0, jumps = 0, hands = 0;
  for (const n of notes) {
    let p = 0;
    for (const c of n.cols) {
      if (c === 1) { taps++; p++; }
      else if (c === 2) { holds++; p++; }
      else if (c === 4) { rolls++; p++; }
    }
    if (p >= 2) jumps++;
    if (p >= 3) hands++;
  }
  const total = taps + holds + rolls;
  const stream = Math.min(1, total / Math.max(1, totalMeasures*16));
  const voltage = Math.min(1, total / Math.max(1, durationSec*8));
  const air = total > 0 ? Math.min(1, jumps*4/total) : 0;
  const freeze = total > 0 ? Math.min(1, (holds+rolls)*4/total) : 0;
  const chaos = 0.3;
  const fmt = v => v.toFixed(6);
  return [fmt(stream), fmt(voltage), fmt(air), fmt(freeze), fmt(chaos), String(total), String(jumps), String(holds), '0', String(hands), String(rolls), '0'].join(',');
}
function estimateMeter(notes, durationSec, difficulty) {
  const total = notes.reduce((s,n) => s + n.cols.filter(c => c===1||c===2||c===4).length, 0);
  const npm = total / Math.max(1, durationSec/60);
  const r = Math.round(npm / 70);
  const floor = { beginner:1, easy:2, medium:4, hard:6, challenge:9 }[difficulty] || 1;
  return Math.max(floor, Math.min(15, r));
}
function pickSampleStart(beats, onsets, dur) {
  if (dur < 30) return Math.max(0, dur*0.25);
  let best = dur*0.33, bestScore = -1;
  for (let s = 10; s < dur-15; s += 5) {
    const c = onsets.filter(t => t>=s && t<s+15).length;
    const m = 1 - Math.abs((s+7.5)/dur - 0.5)*0.5;
    if (c*m > bestScore) { bestScore = c*m; best = s; }
  }
  let snap = best;
  for (const t of beats) {
    if (Math.abs(t-best) < Math.abs(snap-best)) snap = t;
    if (t > best+1) break;
  }
  return Math.max(0, snap);
}

// ----- SSC builder -----------------------------------------------------------
// Each chart can have its own STEPSTYPE; falls back to dance-single for back-compat.
function buildSscFile(meta, audioFile, bpm, offsetSec, sampleStart, charts) {
  let s = `// Generated by StepMania Web\n#VERSION:0.83;\n`;
  s += `#TITLE:${meta.title};\n#SUBTITLE:;\n#ARTIST:${meta.artist};\n`;
  s += `#TITLETRANSLIT:;\n#SUBTITLETRANSLIT:;\n#ARTISTTRANSLIT:;\n`;
  s += `#GENRE:;\n#ORIGIN:;\n#CREDIT:StepMania Web;\n`;
  s += `#MUSIC:${audioFile};\n`;
  s += `#BANNER:;\n#BACKGROUND:;\n#CDTITLE:;\n`;
  s += `#SAMPLESTART:${sampleStart.toFixed(3)};\n#SAMPLELENGTH:15.000;\n#SELECTABLE:YES;\n`;
  s += `#OFFSET:${(-offsetSec).toFixed(3)};\n`;
  s += `#BPMS:0.000=${bpm.toFixed(3)};\n#STOPS:;\n`;
  s += `#DELAYS:;\n#WARPS:;\n#TIMESIGNATURES:0.000=4=4;\n#TICKCOUNTS:0.000=4;\n`;
  s += `#COMBOS:0.000=1;\n#SPEEDS:0.000=1.000=0.000=0;\n#SCROLLS:0.000=1.000;\n`;
  s += `#FAKES:;\n#LABELS:0.000=Song Start;\n#BGCHANGES:;\n#KEYSOUNDS:;\n#ATTACKS:;\n`;
  s += `#DISPLAYBPM:${Math.round(bpm)};\n\n`;
  for (const c of charts) {
    const stepType = c.stepType || 'dance-single';
    s += `//---------------${stepType} - ${c.name}----------------\n`;
    s += `#NOTEDATA:;\n#CHARTNAME:${c.name};\n#STEPSTYPE:${stepType};\n`;
    s += `#DESCRIPTION:StepMania Web — ${c.name};\n#CHARTSTYLE:Pad;\n#DIFFICULTY:${c.name};\n`;
    s += `#METER:${c.rating};\n#RADARVALUES:${c.radar};\n#CREDIT:StepMania Web;\n`;
    s += `#NOTES:\n${c.notes}\n;\n\n`;
  }
  return s;
}

// Map numLanes → SSC STEPSTYPE used in the export and during parsing.
function stepTypeForLanes(n) {
  if (n === 6) return 'dance-solo';
  if (n === 8) return 'dance-double';
  return 'dance-single';
}

// ----- Per-song / queue analysis --------------------------------------------
async function analyzeOne(q) {
  q.status = 'working'; renderQueue();
  log(`▶ ${q.file.name}`, 'info');
  let buffer;
  try { buffer = await decodeFile(q.file); }
  catch (e) { q.status = 'error'; log(`  ✗ ${e.message}`, 'bad'); renderQueue(); return; }
  await yieldUI();
  const sr = buffer.sampleRate;
  const monoData = toMono(buffer);
  const { env, framesPerSec } = computeEnergyEnvelope(monoData, sr);
  const odf = computeODF(env);
  await yieldUI();
  const sensitivity = parseFloat(document.getElementById('sensitivity').value);
  const peakFrames = pickPeaks(odf, framesPerSec, sensitivity);
  let onsetTimesSec = peakFrames.map(f => f / framesPerSec);
  const overrideVal = parseFloat(q.bpmOverride);
  const bpm = (!isNaN(overrideVal) && overrideVal > 0) ? overrideVal : detectBPM(odf, framesPerSec);
  await yieldUI();
  const offsetSec = detectOffset(odf, framesPerSec, bpm);
  // Duration cap (Completa / 90s / 120s / 180s) — recorta tanto las notas como
  // el audio exportado. La selección viene del botón .preset.selected dentro
  // de #durationGrid (data-duration en segundos, "0" = completa).
  const activeDurEl = document.querySelector('#durationGrid .preset.selected');
  const maxDurationSec = activeDurEl ? (parseFloat(activeDurEl.dataset.duration) || 0) : 0;
  const effectiveDuration = (maxDurationSec > 0 && buffer.duration > maxDurationSec)
    ? maxDurationSec : buffer.duration;
  // Filtra onsets más allá de la duración efectiva — evita que se sigan
  // generando pasos en sección recortada.
  if (effectiveDuration < buffer.duration) {
    onsetTimesSec = onsetTimesSec.filter(t => t < effectiveDuration);
  }
  const beatPerSec = bpm/60;
  const beatsList = [];
  for (let t = offsetSec; t < effectiveDuration; t += 1/beatPerSec) beatsList.push(t);
  const resolution = document.getElementById('subdivSelect').value;
  const holdDensity = parseFloat(document.getElementById('holdDensity').value);
  const jumpProb = parseFloat(document.getElementById('jumpProb').value);
  // Charts are always authored at 8 lanes (dance-double). Single source of
  // truth per song; runtime mods (Solo/Full) decide whether to play as 4/6/8
  // by redistributing in game.js. No more 4-only or 6-only charts in lib.
  const numLanes = 8;
  const stepType = stepTypeForLanes(numLanes);
  const rawPos = quantizeOnsetsTo192(onsetTimesSec, bpm, offsetSec);
  const positions = snapToResolution(rawPos, resolution);
  const totalUnits = Math.ceil((effectiveDuration - offsetSec) * beatPerSec * 48);
  const totalMeasures = Math.ceil(totalUnits/192);
  const sampleStart = pickSampleStart(beatsList, onsetTimesSec, effectiveDuration);
  const diffs = [
    { key: 'beginner', name: 'Beginner' }, { key: 'easy', name: 'Easy' },
    { key: 'medium', name: 'Medium' }, { key: 'hard', name: 'Hard' },
    { key: 'challenge', name: 'Challenge' }
  ];
  // Multiplicador del preset (suave/normal/intenso/custom). Modula minGap y
  // NPS target del filtrado por dificultad de DifficultyTiers. Selector
  // explícito a [data-preset] para no capturar los botones de duración que
  // comparten la clase .preset.
  const activePresetEl = document.querySelector('.preset[data-preset].selected');
  const presetKey = (activePresetEl && activePresetEl.dataset.preset) || 'normal';
  const presetMul = (window.DifficultyTiers
    && window.DifficultyTiers.PRESET_MULTIPLIER[presetKey]) || 1.0;

  const charts = [];
  for (const d of diffs) {
    const baseNotes = generateBaseNotes(positions, d.key, jumpProb, 0.15, numLanes, bpm, offsetSec, presetMul);
    const finalNotes = addHoldsAndRolls(baseNotes, d.key, holdDensity, numLanes);
    const rows = notesToRows(finalNotes, totalUnits, numLanes);
    const count = finalNotes.reduce((s,n) => s + n.cols.filter(c => c===1||c===2||c===4).length, 0);
    const rating = estimateMeter(finalNotes, effectiveDuration, d.key);
    const radar = calculateRadar(finalNotes, totalMeasures, effectiveDuration);
    charts.push({ name: d.name, key: d.key, rating, notes: rows, count, radar, stepType, numLanes });
  }
  // Si hay cap de duración activo, recorta el audio + re-encoda a WAV con
  // fade-out de 1.5s para evitar el click. El blob queda en q.croppedAudio
  // y lo consumen saveAllToLibrary y downloadAllZip en lugar de q.file.
  let croppedAudio = null;
  let croppedAudioName = null;
  if (effectiveDuration < buffer.duration && window.AudioPipeline?.audioBufferToWav) {
    croppedAudio = window.AudioPipeline.audioBufferToWav(buffer, effectiveDuration, 1.5);
    croppedAudioName = q.file.name.replace(/\.[^.]+$/, '') + '.wav';
  }
  q.result = {
    bpm, offsetSec, duration: effectiveDuration, sampleStart, charts,
    sampleRate: sr, numLanes, croppedAudio, croppedAudioName,
    originalDuration: buffer.duration
  };
  q.status = 'done';
  const durMsg = (effectiveDuration < buffer.duration)
    ? ` · recortado ${Math.round(buffer.duration)}s → ${Math.round(effectiveDuration)}s`
    : '';
  log(`  ✓ BPM ${bpm.toFixed(1)}, ${charts.reduce((s,c) => s+c.count, 0)} pasos · ${numLanes} carriles${durMsg}`, 'ok');
  renderQueue();
}
async function analyzeAll() {
  if (analyzing || !queue.length) return;
  analyzing = true; cancelRequested = false;
  document.getElementById('analyzeBtn').disabled = true;
  document.getElementById('cancelBtn').disabled = false;
  document.getElementById('analyzeLog').innerHTML = '';
  for (const q of queue) if (q.status !== 'working') { q.status = 'pending'; q.result = null; }
  renderQueue();
  let i = 0;
  for (const q of queue) {
    if (cancelRequested) { log('Cancelado', 'warn'); break; }
    await analyzeOne(q);
    document.getElementById('analyzeProgress').style.width = (100*++i/queue.length) + '%';
  }
  analyzing = false;
  document.getElementById('analyzeBtn').disabled = false;
  document.getElementById('cancelBtn').disabled = true;
  if (queue.some(q => q.status === 'done')) document.getElementById('exportCard').classList.remove('hidden');
}
function cancelAnalysis() { cancelRequested = true; }

// ----- Presets + UI bindings -------------------------------------------------
const PRESETS = {
  suave:   { sensitivity: 2.4, subdivision: '4',  holdDensity: 0.10, jumpProb: 0.00 },
  normal:  { sensitivity: 1.7, subdivision: '8',  holdDensity: 0.25, jumpProb: 0.07 },
  intenso: { sensitivity: 1.3, subdivision: '16', holdDensity: 0.50, jumpProb: 0.18 },
};
function applyPreset(p) {
  document.getElementById('sensitivity').value = p.sensitivity;
  document.getElementById('sensValue').textContent = p.sensitivity.toFixed(1);
  document.getElementById('subdivSelect').value = p.subdivision;
  const labels = { '4': 'negras (1/4)', '8': 'corcheas (1/8)', '16': 'semicorcheas (1/16)' };
  document.getElementById('subdivValue').textContent = labels[p.subdivision];
  document.getElementById('holdDensity').value = p.holdDensity;
  document.getElementById('holdVal').textContent = Math.round(p.holdDensity*100) + '%';
  document.getElementById('jumpProb').value = p.jumpProb;
  document.getElementById('jumpVal').textContent = Math.round(p.jumpProb*100) + '%';
}
// Presets de estilo (suave/normal/intenso/custom) — selector restringido a
// data-preset para no colisionar con los botones de duración (data-duration)
// que comparten la misma clase visual .preset.
document.querySelectorAll('.preset[data-preset]').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.preset[data-preset]').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
    if (el.dataset.preset === 'custom') {
      document.getElementById('customParams').style.display = '';
    } else {
      document.getElementById('customParams').style.display = 'none';
      applyPreset(PRESETS[el.dataset.preset]);
    }
  });
});
// Botones de duración máxima (#durationGrid .preset[data-duration]).
document.querySelectorAll('#durationGrid .preset').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('#durationGrid .preset').forEach(p => p.classList.remove('selected'));
    el.classList.add('selected');
  });
});
['sensitivity','holdDensity','jumpProb'].forEach(id => {
  document.getElementById(id).addEventListener('input', e => {
    if (id === 'sensitivity') document.getElementById('sensValue').textContent = parseFloat(e.target.value).toFixed(1);
    else if (id === 'holdDensity') document.getElementById('holdVal').textContent = Math.round(parseFloat(e.target.value)*100) + '%';
    else document.getElementById('jumpVal').textContent = Math.round(parseFloat(e.target.value)*100) + '%';
  });
});
document.getElementById('subdivSelect').addEventListener('change', e => {
  const labels = { '4': 'negras (1/4)', '8': 'corcheas (1/8)', '16': 'semicorcheas (1/16)' };
  document.getElementById('subdivValue').textContent = labels[e.target.value];
});

function buildSscForSong(q) {
  // El #MUSIC apunta al audio que terminará junto al .ssc — wav recortado si
  // hubo cap, archivo original si no. Coherente con saveAllToLibrary y
  // downloadAllZip que escogen la fuente con la misma lógica.
  const audioExt = q.result.croppedAudio ? '.wav' : getExt(q.file.name);
  return buildSscFile({ title: q.title, artist: q.artist },
    safeFn(q.title) + audioExt,
    q.result.bpm, q.result.offsetSec, q.result.sampleStart, q.result.charts);
}

// ----- Export: save library + ZIP --------------------------------------------
async function saveAllToLibrary() {
  const done = queue.filter(q => q.status === 'done');
  const status = document.getElementById('exportStatus');
  let saved = 0;
  for (const q of done) {
    // Si hubo cap de duración, persistimos el WAV recortado (fade-out incluido).
    // En caso contrario guardamos el archivo original sin re-codificar.
    const audioBlob = q.result.croppedAudio || q.file;
    const audioName = q.result.croppedAudioName || q.file.name;
    const sscText = buildSscForSong(q);
    await dbAdd({
      title: q.title, artist: q.artist,
      audioBlob, audioName,
      sscText,
      bpm: q.result.bpm, offsetSec: q.result.offsetSec,
      duration: q.result.duration, sampleStart: q.result.sampleStart,
      charts: q.result.charts.map(c => ({ name: c.name, key: c.key, rating: c.rating, count: c.count, numLanes: c.numLanes || 4, stepType: c.stepType || 'dance-single' })),
      addedAt: Date.now()
    });
    saved++;
    status.textContent = `Guardando ${saved}/${done.length}...`;
  }
  status.innerHTML = `<span style="color:#00ff64">✓ ${saved} canciones guardadas en tu librería</span>`;
}

async function downloadAllZip() {
  const done = queue.filter(q => q.status === 'done');
  if (!done.length) return;
  const status = document.getElementById('exportStatus');
  status.textContent = 'Construyendo ZIP...';
  const enc = new TextEncoder();
  const files = [];
  for (const q of done) {
    const folder = safeFn(q.title);
    // Si hubo recorte, el ZIP lleva el WAV cropeado en lugar del archivo original.
    const sourceBlob = q.result.croppedAudio || q.file;
    const sourceExt = q.result.croppedAudio ? '.wav' : getExt(q.file.name);
    const audioName = folder + sourceExt;
    files.push({ name: `${folder}/${folder}.ssc`, data: enc.encode(buildSscForSong(q)) });
    const audioBytes = new Uint8Array(await sourceBlob.arrayBuffer());
    files.push({ name: `${folder}/${audioName}`, data: audioBytes });
  }
  const zipBytes = makeZip(files);
  const blob = new Blob([zipBytes], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `StepManiaWeb_${done.length}_songs.zip`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  status.innerHTML = `<span style="color:#00ff64">✓ ZIP descargado (${(blob.size/1024/1024).toFixed(1)} MB)</span>`;
}

// ----- Self-contained ZIP encoder (mode "store", no compression) ------------
let CRC_TABLE = null;
function makeCrcTable() {
  CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    CRC_TABLE[n] = c;
  }
}
function crc32(data) {
  if (!CRC_TABLE) makeCrcTable();
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xFF];
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) {
  const enc = new TextEncoder();
  const local = [], central = [];
  let offset = 0;
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data);
    const crc = crc32(data), size = data.length;
    const lh = new Uint8Array(30 + nameBytes.length);
    const lhv = new DataView(lh.buffer);
    lhv.setUint32(0, 0x04034b50, true); lhv.setUint16(4, 20, true);
    lhv.setUint16(6, 0, true); lhv.setUint16(8, 0, true);
    lhv.setUint16(10, 0, true); lhv.setUint16(12, 0x0021, true);
    lhv.setUint32(14, crc, true); lhv.setUint32(18, size, true); lhv.setUint32(22, size, true);
    lhv.setUint16(26, nameBytes.length, true); lhv.setUint16(28, 0, true);
    lh.set(nameBytes, 30);
    local.push(lh, data);
    const ch = new Uint8Array(46 + nameBytes.length);
    const chv = new DataView(ch.buffer);
    chv.setUint32(0, 0x02014b50, true); chv.setUint16(4, 20, true); chv.setUint16(6, 20, true);
    chv.setUint16(8, 0, true); chv.setUint16(10, 0, true); chv.setUint16(12, 0, true);
    chv.setUint16(14, 0x0021, true); chv.setUint32(16, crc, true);
    chv.setUint32(20, size, true); chv.setUint32(24, size, true);
    chv.setUint16(28, nameBytes.length, true); chv.setUint16(30, 0, true);
    chv.setUint16(32, 0, true); chv.setUint16(34, 0, true);
    chv.setUint16(36, 0, true); chv.setUint32(38, 0, true); chv.setUint32(42, offset, true);
    ch.set(nameBytes, 46);
    central.push(ch);
    offset += lh.length + data.length;
  }
  let centralSize = 0; for (const c of central) centralSize += c.length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, offset, true); ev.setUint16(20, 0, true);
  let total = 0;
  for (const p of local) total += p.length;
  total += centralSize + 22;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of local) { out.set(p, pos); pos += p.length; }
  for (const c of central) { out.set(c, pos); pos += c.length; }
  out.set(eocd, pos);
  return out;
}
