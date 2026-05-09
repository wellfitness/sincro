// ============================================================================
//  PARSER — SSC/SM tag parser, timing engine (BPMS+STOPS+DELAYS+WARPS),
//  notes-to-events with quant colors. Mirrors StepMania TimingData.cpp.
// ============================================================================

function parseSscOrSm(text) {
  text = text.replace(/\/\/[^\n]*/g, '');
  const tags = [];
  let i = 0;
  while (i < text.length) {
    const h = text.indexOf('#', i);
    if (h === -1) break;
    const colon = text.indexOf(':', h);
    if (colon === -1) break;
    const semi = text.indexOf(';', colon);
    if (semi === -1) break;
    tags.push({ key: text.slice(h+1, colon).trim().toUpperCase(), val: text.slice(colon+1, semi) });
    i = semi+1;
  }
  const header = {};
  const charts = [];
  let cur = null;
  for (const { key, val } of tags) {
    if (key === 'NOTEDATA') {
      if (cur) charts.push(cur);
      cur = {};
    } else if (key === 'NOTES') {
      if (cur === null) {
        const parts = val.split(':');
        if (parts.length >= 6) charts.push({
          STEPSTYPE: parts[0].trim(), DESCRIPTION: parts[1].trim(),
          DIFFICULTY: parts[2].trim(), METER: parts[3].trim(),
          RADARVALUES: parts[4].trim(), NOTES: parts.slice(5).join(':').trim()
        });
      } else {
        cur.NOTES = val.trim(); charts.push(cur); cur = null;
      }
    } else if (cur !== null) {
      cur[key] = val.trim();
    } else {
      header[key] = val.trim();
    }
  }
  if (cur) charts.push(cur);
  return { header, charts };
}

// ----------------------------------------------------------------------------
//  Timing engine — beat→time conversion with full SSC features.
// ----------------------------------------------------------------------------
function parseSscPairs(s) {
  if (!s) return [];
  return s.replace(/\s+/g, '').split(',').filter(Boolean).map(p => {
    const [b, v] = p.split('=').map(parseFloat);
    return { beat: b, val: v };
  }).filter(x => !isNaN(x.beat) && !isNaN(x.val)).sort((a,b) => a.beat - b.beat);
}

function buildTimingEngine(header, chartHeader) {
  const get = k => (chartHeader && chartHeader[k]) || header[k] || '';
  const bpms   = parseSscPairs(get('BPMS'));
  const stops  = parseSscPairs(get('STOPS'));
  const delays = parseSscPairs(get('DELAYS'));
  const warps  = parseSscPairs(get('WARPS'));
  const offset = parseFloat(get('OFFSET') || '0') || 0;
  if (!bpms.length) bpms.push({ beat: 0, val: 120 });
  if (bpms[0].beat > 0) bpms.unshift({ beat: 0, val: bpms[0].val });

  // StepMania convention: audioTime(0) = -OFFSET. Stops add at their beat
  // (after passing). Delays add BEFORE their beat (notes pushed back).
  // Warps skip [w.beat, w.beat+w.val) instantly.
  function beatToTime(beat) {
    for (const w of warps) if (beat > w.beat && beat < w.beat + w.val) return null;
    let t = -offset;
    let cur = 0;
    let warpedRemoved = 0;
    for (const w of warps) if (w.beat < beat) warpedRemoved += Math.min(w.val, beat - w.beat);
    const effBeat = beat - warpedRemoved;

    for (let i = 0; i < bpms.length; i++) {
      const segEnd = (i+1 < bpms.length) ? bpms[i+1].beat : Infinity;
      if (segEnd <= cur) continue;
      const segBpm = bpms[i].val || 120;
      const useEnd = Math.min(segEnd, effBeat);
      if (useEnd > cur) { t += (useEnd - cur) * 60 / segBpm; cur = useEnd; }
      if (cur >= effBeat) break;
    }
    for (const s of stops)  if (s.beat <  beat) t += s.val;
    for (const d of delays) if (d.beat <= beat) t += d.val;
    return t;
  }
  function bpmAtBeat(beat) {
    let v = bpms[0].val;
    for (const b of bpms) if (b.beat <= beat) v = b.val;
    return v;
  }
  let minBpm = Infinity, maxBpm = -Infinity;
  for (const b of bpms) { if (b.val < minBpm) minBpm = b.val; if (b.val > maxBpm) maxBpm = b.val; }
  return { beatToTime, bpmAtBeat, minBpm, maxBpm, offset, hasChanges: bpms.length > 1 || stops.length > 0 || delays.length > 0 || warps.length > 0 };
}

// Per-row beat = measure*4 + r/total*4. Each measure is exactly 4 beats.
function parseNotesToEvents(notesText, timingEngine) {
  const measures = notesText.split(',').map(m => m.trim());
  const events = [];
  for (let m = 0; m < measures.length; m++) {
    const rows = measures[m].split('\n').map(r => r.trim()).filter(r => r.length > 0);
    const total = rows.length;
    if (!total) continue;
    for (let r = 0; r < total; r++) {
      const row = rows[r];
      if (row.length < 4) continue;
      const beat = m*4 + (r/total)*4;
      for (let lane = 0; lane < 4; lane++) {
        const ch = row[lane];
        if (ch === '0' || ch === undefined) continue;
        let type;
        if (ch === '1') type = 'tap';
        else if (ch === '2') type = 'hold-head';
        else if (ch === '3') type = 'hold-tail';
        else if (ch === '4') type = 'roll-head';
        else if (ch === 'M' || ch === 'm') type = 'mine';
        else if (ch === 'L' || ch === 'F') type = 'tap';
        else continue;
        events.push({ beat, lane, type, row: r, total });
      }
    }
  }
  const finalNotes = [];
  const openHolds = [null, null, null, null];
  for (const e of events) {
    const t = timingEngine.beatToTime(e.beat);
    if (t === null) continue;
    if (e.type === 'tap' || e.type === 'mine') {
      finalNotes.push({ beat: e.beat, lane: e.lane, type: e.type, time: t, row: e.row, total: e.total });
    } else if (e.type === 'hold-head' || e.type === 'roll-head') {
      const note = { beat: e.beat, lane: e.lane, type: e.type === 'roll-head' ? 'roll' : 'hold', time: t, endBeat: null, endTime: null, row: e.row, total: e.total };
      finalNotes.push(note);
      openHolds[e.lane] = note;
    } else if (e.type === 'hold-tail') {
      const h = openHolds[e.lane];
      if (h) { h.endBeat = e.beat; h.endTime = t; openHolds[e.lane] = null; }
    }
  }
  return finalNotes;
}

// Beat denominator → ITG/SM color.
function quantColorFor(row, total) {
  const idx = Math.round(row * 192 / total);
  if (idx % 48 === 0) return '#ff3a3a';   // 4ths
  if (idx % 24 === 0) return '#3a86ff';   // 8ths
  if (idx % 16 === 0) return '#a259ff';   // 12ths
  if (idx % 12 === 0) return '#ffd400';   // 16ths
  if (idx %  8 === 0) return '#ff66c4';   // 24ths
  if (idx %  6 === 0) return '#00f5d4';   // 32nds
  if (idx %  4 === 0) return '#88ff88';   // 48ths
  if (idx %  3 === 0) return '#ff8800';   // 64ths
  return '#cccccc';
}
