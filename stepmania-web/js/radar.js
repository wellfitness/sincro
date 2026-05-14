// ============================================================================
//  RADAR — Pentágono de dificultad estilo StepMania ("Groove Radar").
//
//  Calcula 5 métricas por chart al vuelo (sin persistir en IndexedDB) desde
//  el texto del chart que ya guardamos (`sscText` para SM, `chartText` para
//  GH). El caller cachea por sesión para no recalcular en cada hover.
//
//  Métricas SM (etiquetas castellanas):
//   - Densidad   (Stream)   = NPS sostenido / 7 [SM5: NoteDataUtil.cpp:1142]
//   - Intensidad (Voltage)  = pico de densidad en ventana 8 beats / 10
//   - Saltos     (Air)      = jumps/s
//   - Sostenidos (Freeze)   = holds+rolls/s
//   - Caos       (Chaos)    = filas con quant raro / s * 0.5
//
//  Métricas GH (ad-hoc, no existe oficial):
//   - Flujo    = NPS sostenido / 6
//   - Pico     = pico de notas en 8 beats / 8 (cap = 8 NPS en ventana)
//   - Acordes  = chordNotes / totalNotes
//   - Sostén  = tiempo total sosteniendo / duración * 2 (cap = 50%)
//   - Tramos   = bigJumps (>=3 trastes) / totalTransitions
//
//  Todas las métricas se clampean a [0,1] como hace SM5 GrooveRadar.cpp:110.
//
//  El render SVG es puro string (testeable en Node, sin DOM).
// ============================================================================

(function () {
  'use strict';

  const LABELS_SM = ['Densidad', 'Intensidad', 'Saltos', 'Sostenidos', 'Caos'];
  const LABELS_GH = ['Flujo', 'Pico', 'Acordes', 'Sostén', 'Tramos'];

  const clamp01 = v => Math.max(0, Math.min(1, v));

  // --------------------------------------------------------------------------
  //  Parser del campo #RADARVALUES de un .ssc (12+ floats separados por ',').
  //  Solo usamos los 5 primeros — el resto son contadores (notes, jumps, ...).
  //  Devuelve null si el string no es parseable o tiene menos de 5 valores.
  //
  //  Util cuando un .ssc importado de un pack trae el campo populado: ahorra
  //  el cálculo. Si no existe o falla, el caller hace fallback a computeRadarSM.
  // --------------------------------------------------------------------------
  function parseRadarString(csv) {
    if (!csv || typeof csv !== 'string') return null;
    // SM5 admite tanto coma como punto-y-coma; aceptamos ambos.
    const parts = csv.replace(/;/g, ',').split(',').map(s => parseFloat(s.trim()));
    if (parts.length < 5 || parts.slice(0, 5).some(v => !isFinite(v))) return null;
    return {
      densidad:   clamp01(parts[0]),
      intensidad: clamp01(parts[1]),
      saltos:     clamp01(parts[2]),
      sostenidos: clamp01(parts[3]),
      caos:       clamp01(parts[4])
    };
  }

  // --------------------------------------------------------------------------
  //  SM: calcular las 5 métricas a partir del texto del campo #NOTES.
  //
  //  notesText: string crudo del body de #NOTES (measures separados por ','
  //  con filas '0010\\n0001\\n...'). numLanes: ancho de cada fila (4=single,
  //  6=solo, 8=double). bpm: BPM constante asumido (para ventana de 8 beats).
  //  songSeconds: duración del audio (para normalizar NPS).
  //
  //  Caracteres por celda:
  //   - '0' vacío
  //   - '1' tap
  //   - '2' hold head
  //   - '3' hold tail (no cuenta como onset)
  //   - '4' roll head
  //   - '5' roll tail (no cuenta como onset)
  //   - 'M', 'F', 'L' mines/fakes/lifts (no cuentan como tap o hold)
  // --------------------------------------------------------------------------
  function computeRadarSM({ notesText, numLanes, bpm, songSeconds }) {
    const blank = {
      densidad: 0, intensidad: 0, saltos: 0, sostenidos: 0, caos: 0
    };
    if (!notesText || !numLanes || !bpm || !songSeconds || songSeconds <= 0) return blank;

    // Split por measures (separador ',' en SSC/SM).
    const measures = notesText.split(',').map(m => m.trim()).filter(Boolean);
    if (!measures.length) return blank;

    // Acumuladores: totales por chart + array de beats con onset.
    let totalTaps = 0;
    let totalHolds = 0;       // hold heads + roll heads
    let totalJumps = 0;
    let chaosRows = 0;
    // onsetBeats: posición en BEATS (cuartos) de cada fila con ≥ 1 onset.
    // Lo usamos después para calcular el máximo de notas en una ventana
    // deslizante de 8 beats (Voltage / Intensidad).
    const onsetBeats = [];

    let measureIdx = 0;
    for (const measure of measures) {
      const rows = measure.split('\n').map(r => r.trim()).filter(r => r.length >= numLanes);
      const N = rows.length;
      if (!N) { measureIdx++; continue; }
      // Subdivisión: N filas por measure = N/4 por beat.
      // Quants "limpios" en SM5: 4, 8, 12, 16, 24, 32, 48, 64, 96, 192.
      // Chaos: filas que caen en quants raros (no múltiplo de 4 ni de 8).
      // El criterio canonico SM5 es "rows que no son cuartos ni octavos".
      // Aproximamos: una fila i de N filas es 8th-friendly si (i * 8) % N === 0.
      for (let i = 0; i < N; i++) {
        const row = rows[i];
        let pressed = 0;
        for (let c = 0; c < numLanes; c++) {
          const ch = row[c];
          if (ch === '1') { totalTaps++; pressed++; }
          else if (ch === '2' || ch === '4') { totalHolds++; pressed++; }
          // '3', '5', 'M', 'F', 'L' no son onsets.
        }
        if (pressed >= 1) {
          if (pressed >= 2) totalJumps++;
          // Beat absoluto de esta fila.
          const beat = (measureIdx + i / N) * 4;
          onsetBeats.push(beat);
          // ¿Quant raro? (no 4th ni 8th)
          if ((i * 8) % N !== 0) chaosRows++;
        }
      }
      measureIdx++;
    }

    const totalNotes = totalTaps + totalHolds;
    if (totalNotes === 0) return blank;

    // Densidad (Stream): NPS / 7. Stream=1.0 ≡ 7 NPS sostenido.
    const densidad = clamp01((totalNotes / songSeconds) / 7);

    // Intensidad (Voltage): pico de notas en ventana de 8 beats normalizado.
    // Algoritmo: 2-pointer sobre onsetBeats ordenados.
    let maxIn8 = 0;
    let j = 0;
    for (let i = 0; i < onsetBeats.length; i++) {
      while (onsetBeats[i] - onsetBeats[j] > 8) j++;
      const w = i - j + 1;
      if (w > maxIn8) maxIn8 = w;
    }
    // Replica burda de SM5 Voltage: (maxRowsIn8beats / 8) * avgBps / 10.
    // avgBps = bpm / 60. Saturación a 10 (densidad razón SM5).
    const avgBps = bpm / 60;
    const intensidad = clamp01(((maxIn8 / 8) * avgBps) / 10);

    // Saltos (Air): jumps/s. 1 jump/s = saturación.
    const saltos = clamp01(totalJumps / songSeconds);

    // Sostenidos (Freeze): holds/s. 1 hold/s = saturación.
    const sostenidos = clamp01(totalHolds / songSeconds);

    // Caos: filas raras/s * 0.5. 2 rare-rows/s = saturación.
    const caos = clamp01((chaosRows / songSeconds) * 0.5);

    return { densidad, intensidad, saltos, sostenidos, caos };
  }

  // --------------------------------------------------------------------------
  //  GH: calcular las 5 métricas a partir del texto del .chart entero +
  //  el nombre de la dificultad (e.g. 'ExpertSingle', 'MediumSingle').
  //
  //  chartText: string completo del notes.chart. diffName: clave de sección
  //  [EasySingle], [MediumSingle], [HardSingle], [ExpertSingle].
  //
  //  Parseo:
  //   - Resolución: la sacamos del [Song] block (`Resolution = 192`).
  //   - Líneas `<tick> = N <fret> <sustainTicks>`. Mismo tick con varias
  //     líneas = chord. Solo fret en [0..4] cuenta (5/6 = flags, 7 = open).
  //  Sustain en segundos: sustainTicks / resolution * (60/bpm).
  // --------------------------------------------------------------------------
  function computeRadarGH({ chartText, diffName, bpm, durationSec }) {
    const blank = {
      flujo: 0, pico: 0, acordes: 0, sosten: 0, tramos: 0
    };
    if (!chartText || !diffName || !bpm || !durationSec || durationSec <= 0) return blank;

    // Resolución por defecto 192 si no la encontramos.
    let resolution = 192;
    const resMatch = chartText.match(/Resolution\s*=\s*(\d+)/);
    if (resMatch) resolution = parseInt(resMatch[1]) || 192;

    // Localizar la sección de la diff. Las secciones están delimitadas por '{' '}'.
    const sectionRe = new RegExp('\\[' + diffName.replace(/[\[\]]/g, '') + '\\]\\s*\\{([\\s\\S]*?)\\}', 'm');
    const m = chartText.match(sectionRe);
    if (!m) return blank;
    const body = m[1];

    // Cada línea: '<tick> = N <fret> <sustainTicks>'.
    // Agrupamos por tick: notesMap.get(tick) = { frets:Set, sustainMaxTicks }.
    const notesMap = new Map();
    const lineRe = /^\s*(\d+)\s*=\s*N\s+(\d+)\s+(\d+)/gm;
    let lm;
    while ((lm = lineRe.exec(body)) !== null) {
      const tick = parseInt(lm[1]);
      const fret = parseInt(lm[2]);
      const sus  = parseInt(lm[3]) || 0;
      if (fret < 0 || fret > 4) continue; // 5/6 = flags forceHopo/Tap; 7 = open (sin fret jugable estándar)
      let entry = notesMap.get(tick);
      if (!entry) { entry = { frets: new Set(), sus: 0 }; notesMap.set(tick, entry); }
      entry.frets.add(fret);
      if (sus > entry.sus) entry.sus = sus;
    }
    if (!notesMap.size) return blank;

    // Lista ordenada por tick.
    const noteList = [...notesMap.entries()]
      .map(([tick, e]) => ({ tick, frets: [...e.frets].sort((a,b)=>a-b), sus: e.sus }))
      .sort((a, b) => a.tick - b.tick);

    const totalNotes = noteList.length;
    let chordNotes = 0;
    let sustainTicksTotal = 0;
    let bigJumps = 0;
    let transitionsSingle = 0;

    let prevSingleFret = null;
    for (let i = 0; i < noteList.length; i++) {
      const n = noteList[i];
      const isChord = n.frets.length >= 2;
      if (isChord) chordNotes++;
      sustainTicksTotal += n.sus;

      // Tramos: solo single→single, distancia ≥3 trastes.
      if (!isChord) {
        if (prevSingleFret !== null) {
          transitionsSingle++;
          if (Math.abs(n.frets[0] - prevSingleFret) >= 3) bigJumps++;
        }
        prevSingleFret = n.frets[0];
      } else {
        prevSingleFret = null; // reset entre chord y siguiente single
      }
    }

    // Flujo: NPS / 6 (cap Expert oficioso).
    const flujo = clamp01((totalNotes / durationSec) / 6);

    // Pico: máximo de notas en ventana de 8 beats, normalizado a 8 NPS-en-ventana.
    // 8 beats en segundos = 8 * 60/bpm. Convertimos ticks de cada nota a beats:
    // beat = tick / resolution.
    let maxIn8 = 0;
    let j = 0;
    for (let i = 0; i < noteList.length; i++) {
      while ((noteList[i].tick - noteList[j].tick) / resolution > 8) j++;
      const w = i - j + 1;
      if (w > maxIn8) maxIn8 = w;
    }
    const eightBeatsSec = 8 * 60 / bpm;
    const peakNps = eightBeatsSec > 0 ? maxIn8 / eightBeatsSec : 0;
    const pico = clamp01(peakNps / 8);

    // Acordes: chord ratio.
    const acordes = clamp01(chordNotes / totalNotes);

    // Sostén: tiempo total sosteniendo / duración. Cap 50% → saturación.
    const sustainSec = (sustainTicksTotal / resolution) * (60 / bpm);
    const sosten = clamp01((sustainSec / durationSec) * 2);

    // Tramos: bigJumps / transitionsSingle (entre singles consecutivos).
    const tramos = transitionsSingle > 0 ? clamp01(bigJumps / transitionsSingle) : 0;

    return { flujo, pico, acordes, sosten, tramos };
  }

  // --------------------------------------------------------------------------
  //  Render SVG inline. No depende del DOM — string puro.
  //
  //  values: array [v0..v4] en [0,1].
  //  labels: array de 5 strings.
  //  size: ancho/alto px del SVG.
  //  accentColor: color del polígono activo.
  // --------------------------------------------------------------------------
  function renderRadarSVG({ values, labels, size = 240, accentColor = '#00bec8' } = {}) {
    // viewBox NO cuadrado: damos margen horizontal para que las etiquetas
    // largas ("Sostenidos", "Intensidad") no se recorten por preserveAspectRatio.
    // Aspect ratio 1.4:1 — mismo ratio que SM5 GrooveRadar.cpp usa internamente.
    const W = size * 1.4;
    const H = size;
    const cx = W / 2;
    const cy = H / 2 + H * 0.02;
    const r  = H * 0.32;
    const labelR = H * 0.44;

    // 5 vértices: arrancando arriba (PI/2 negativo en SVG), 72° entre vértices.
    const angle = i => -Math.PI / 2 + (Math.PI * 2 / 5) * i;
    const verts = [0, 1, 2, 3, 4].map(i => ({
      x: Math.cos(angle(i)),
      y: Math.sin(angle(i))
    }));

    // Grid concentrico (4 anillos)
    let grid = '';
    for (const rad of [0.25, 0.5, 0.75, 1.0]) {
      const pts = verts.map(v => `${(cx + v.x * r * rad).toFixed(1)},${(cy + v.y * r * rad).toFixed(1)}`).join(' ');
      grid += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
    }

    // Spokes
    let spokes = '';
    for (const v of verts) {
      spokes += `<line x1="${cx}" y1="${cy}" x2="${(cx + v.x * r).toFixed(1)}" y2="${(cy + v.y * r).toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
    }

    // Polígono activo
    const safeVals = (values || []).slice(0, 5);
    while (safeVals.length < 5) safeVals.push(0);
    const valPts = verts.map((v, i) => {
      const k = clamp01(safeVals[i]);
      return `${(cx + v.x * r * k).toFixed(1)},${(cy + v.y * r * k).toFixed(1)}`;
    }).join(' ');
    const activePoly = `<polygon points="${valPts}" fill="${accentColor}" fill-opacity="0.32" stroke="${accentColor}" stroke-width="2" stroke-linejoin="round"/>`;

    // Puntos en cada vértice activo
    let dots = '';
    for (let i = 0; i < 5; i++) {
      const k = clamp01(safeVals[i]);
      dots += `<circle cx="${(cx + verts[i].x * r * k).toFixed(1)}" cy="${(cy + verts[i].y * r * k).toFixed(1)}" r="3.2" fill="${accentColor}"/>`;
    }

    // Etiquetas + porcentaje
    let labs = '';
    const labArr = labels || ['','','','',''];
    for (let i = 0; i < 5; i++) {
      const v = verts[i];
      const x = cx + v.x * labelR;
      const y = cy + v.y * labelR;
      const anchor = Math.abs(v.x) < 0.1 ? 'middle' : (v.x > 0 ? 'start' : 'end');
      const pct = Math.round(clamp01(safeVals[i]) * 100);
      labs += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="rgba(255,255,255,0.9)" font-size="${(H*0.058).toFixed(1)}" font-weight="600" font-family="ABeeZee, system-ui, sans-serif">${escapeXml(labArr[i] || '')}</text>`;
      labs += `<text x="${x.toFixed(1)}" y="${(y + H*0.058).toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" fill="${accentColor}" font-size="${(H*0.052).toFixed(1)}" font-weight="700" font-family="ABeeZee, system-ui, sans-serif">${pct}</text>`;
    }

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Radar de dificultad">${grid}${spokes}${activePoly}${dots}${labs}</svg>`;
  }

  function escapeXml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const api = {
    LABELS_SM,
    LABELS_GH,
    parseRadarString,
    computeRadarSM,
    computeRadarGH,
    renderRadarSVG,
    // exportados para tests
    _clamp01: clamp01,
    _escapeXml: escapeXml
  };

  if (typeof window !== 'undefined') window.Radar = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
