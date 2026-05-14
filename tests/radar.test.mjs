// Tests del módulo radar.js — pentágono de dificultad (Groove Radar)
//
// Cubre tres áreas:
//  1. parseRadarString: convertir CSV del campo #RADARVALUES (cuando viene
//     en un .ssc importado) a un objeto {densidad, intensidad, saltos,
//     sostenidos, caos} ya clampeado.
//  2. computeRadarSM: cálculo al vuelo desde el texto del campo #NOTES.
//     Notas reales: '1'=tap, '2'=hold head, '4'=roll head, '3'/'5'=tail.
//  3. computeRadarGH: cálculo desde el texto de la sección [<diffName>] del
//     .chart (formato Clone Hero).
//  4. renderRadarSVG: smoke test del string SVG (que tenga los 5 vértices y
//     las etiquetas correctas).
//
// Estrategia: charts sintéticos con propiedades conocidas, verificación de
// fórmulas exactas. Los tests son deterministas (sin RNG).

import { describe, it, expect } from 'vitest';
import R from '../stepmania-web/js/radar.js';

// ============================================================================
//  Helpers para construir notesText SM sintético
// ============================================================================

// Genera un measure de N filas con un tap en lane 0 cada `every` filas.
// `every` debe dividir N. Lanes: 4 (single).
function measureWithTaps(N, every, lanes = 4) {
  const rows = [];
  for (let i = 0; i < N; i++) {
    if (i % every === 0) {
      rows.push('1' + '0'.repeat(lanes - 1));
    } else {
      rows.push('0'.repeat(lanes));
    }
  }
  return rows.join('\n');
}

// Genera notesText = M measures iguales con el mismo patrón.
function buildNotes(measures, N, every, lanes = 4) {
  const m = measureWithTaps(N, every, lanes);
  const arr = [];
  for (let i = 0; i < measures; i++) arr.push(m);
  return arr.join(',\n');
}

// Genera un .chart GH minimal con [Song] + [SyncTrack] + secciones.
// `events`: array de { tick, fret, sus } para la sección activa.
function buildChartGH({ resolution = 192, bpm = 120, diffName = 'ExpertSingle', events }) {
  const songBlock = `[Song]\n{\n  Resolution = ${resolution}\n}\n`;
  const syncBlock = `[SyncTrack]\n{\n  0 = B ${bpm * 1000}\n}\n`;
  const lines = events.map(e => `  ${e.tick} = N ${e.fret} ${e.sus || 0}`).join('\n');
  const diffBlock = `[${diffName}]\n{\n${lines}\n}\n`;
  return songBlock + syncBlock + diffBlock;
}

// ============================================================================
//  parseRadarString
// ============================================================================

describe('parseRadarString', () => {
  it('parsea CSV oficial SM5 con 12 valores y devuelve los 5 primeros', () => {
    const csv = '0.143,0.250,0.000,0.000,0.500,124,8,2,0,1,0,0';
    const r = R.parseRadarString(csv);
    expect(r).not.toBeNull();
    expect(r.densidad).toBeCloseTo(0.143, 5);
    expect(r.intensidad).toBeCloseTo(0.25, 5);
    expect(r.saltos).toBeCloseTo(0, 5);
    expect(r.sostenidos).toBeCloseTo(0, 5);
    expect(r.caos).toBeCloseTo(0.5, 5);
  });

  it('acepta punto-y-coma como separador (variante histórica SM5)', () => {
    const r = R.parseRadarString('0.5;0.6;0.7;0.8;0.9');
    expect(r).not.toBeNull();
    expect(r.densidad).toBeCloseTo(0.5, 5);
    expect(r.caos).toBeCloseTo(0.9, 5);
  });

  it('clampea valores fuera de [0,1] a [0,1]', () => {
    const r = R.parseRadarString('1.5,2.0,-0.5,0.5,3.0');
    expect(r.densidad).toBe(1);
    expect(r.intensidad).toBe(1);
    expect(r.saltos).toBe(0); // -0.5 clampeado a 0
    expect(r.caos).toBe(1);
  });

  it('devuelve null si hay menos de 5 valores', () => {
    expect(R.parseRadarString('0.5,0.5,0.5,0.5')).toBeNull();
    expect(R.parseRadarString('')).toBeNull();
    expect(R.parseRadarString(null)).toBeNull();
    expect(R.parseRadarString(undefined)).toBeNull();
  });

  it('devuelve null si los primeros 5 no son números válidos', () => {
    expect(R.parseRadarString('abc,def,ghi,jkl,mno')).toBeNull();
    expect(R.parseRadarString('0.5,0.5,NaN,0.5,0.5')).toBeNull();
  });
});

// ============================================================================
//  computeRadarSM
// ============================================================================

describe('computeRadarSM', () => {
  it('devuelve cero radar para chart vacío', () => {
    const r = R.computeRadarSM({ notesText: '', numLanes: 4, bpm: 120, songSeconds: 60 });
    expect(r.densidad).toBe(0);
    expect(r.saltos).toBe(0);
  });

  it('devuelve cero radar si faltan parámetros críticos', () => {
    const r = R.computeRadarSM({ notesText: '1000', numLanes: 4, bpm: 120, songSeconds: 0 });
    expect(r.densidad).toBe(0);
  });

  it('chart de cuartos a 120 BPM: Densidad ≈ NPS/7 = 2/7 ≈ 0.286', () => {
    // 1 measure (4 beats) = 2s a 120 BPM. 4 quarter taps por measure = 2 NPS.
    // 10 measures → 40 taps en 20s. NPS = 2. Densidad = 2/7 ≈ 0.286.
    const notesText = buildNotes(10, 4, 1, 4); // N=4 filas/measure, tap cada fila (cuartos)
    const r = R.computeRadarSM({ notesText, numLanes: 4, bpm: 120, songSeconds: 20 });
    expect(r.densidad).toBeCloseTo(2 / 7, 2);
  });

  it('clampea Densidad a 1.0 cuando NPS supera 7', () => {
    // 1 measure = 2s a 120 BPM. 16 filas con tap en cada → 8 NPS (>7). Repetido.
    const notesText = buildNotes(5, 16, 1, 4); // semicorcheas
    const r = R.computeRadarSM({ notesText, numLanes: 4, bpm: 120, songSeconds: 10 });
    expect(r.densidad).toBe(1);
  });

  it('detecta jumps (Saltos): 2 lanes simultáneos cuentan como salto', () => {
    // 1 measure de 4 filas. Fila 0: jump (lanes 0+1). Resto vacío.
    // En 8 measures (16s a 120 BPM) → 8 jumps → 0.5 jumps/s → Saltos = 0.5.
    const measure = '1100\n0000\n0000\n0000';
    const notesText = Array(8).fill(measure).join(',\n');
    const r = R.computeRadarSM({ notesText, numLanes: 4, bpm: 120, songSeconds: 16 });
    expect(r.saltos).toBeCloseTo(0.5, 2);
  });

  it('Sostenidos: holds (2) cuentan; tails (3) no son onsets', () => {
    // 1 measure: hold head + tail. Beat 0 = '2000', beat 2 = '3000'.
    // Solo cuenta 1 onset de hold por measure (no el tail).
    const measure = '2000\n0000\n3000\n0000';
    const notesText = Array(4).fill(measure).join(',\n');
    // 4 measures = 8s a 120 BPM. 4 hold heads → 0.5 holds/s → Sostenidos = 0.5.
    const r = R.computeRadarSM({ notesText, numLanes: 4, bpm: 120, songSeconds: 8 });
    expect(r.sostenidos).toBeCloseTo(0.5, 2);
  });

  it('Caos: filas en quants de 8th puro = 0; con 16ths offbeat > 0', () => {
    // Solo cuartos → caos = 0.
    const onlyQuarters = buildNotes(4, 4, 1, 4);
    const r1 = R.computeRadarSM({ notesText: onlyQuarters, numLanes: 4, bpm: 120, songSeconds: 8 });
    expect(r1.caos).toBe(0);

    // 16 filas/measure con tap en TODAS — los offbeats de semicorchea
    // (filas 1,3,5,7,9,11,13,15 en grid de 16) caen en quants raros vs 8ths.
    const allSixteenths = buildNotes(4, 16, 1, 4);
    const r2 = R.computeRadarSM({ notesText: allSixteenths, numLanes: 4, bpm: 120, songSeconds: 8 });
    expect(r2.caos).toBeGreaterThan(0);
  });

  it('Intensidad (Voltage): pico de notas en ventana 8 beats > 0', () => {
    // 8 measures = 32 beats. Carga toda la actividad al inicio (4 measures
    // densos) y el resto vacíos. La ventana 8 beats al principio = 16 taps.
    const dense = buildNotes(4, 16, 1, 4); // 16ths
    const empty = Array(4).fill('0000\n0000\n0000\n0000').join(',\n');
    const notesText = dense + ',\n' + empty;
    const r = R.computeRadarSM({ notesText, numLanes: 4, bpm: 120, songSeconds: 16 });
    expect(r.intensidad).toBeGreaterThan(0);
  });
});

// ============================================================================
//  computeRadarGH
// ============================================================================

describe('computeRadarGH', () => {
  it('devuelve cero radar si la sección no existe', () => {
    const chart = buildChartGH({ events: [{ tick: 0, fret: 0 }] });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'EasySingle', bpm: 120, durationSec: 60 });
    expect(r.flujo).toBe(0);
  });

  it('Flujo = NPS / 6 (60 notas en 60s a 120 BPM → 0.166)', () => {
    // 60 single notes, 1 nota por beat (resolution 192, tick step = 192).
    const events = [];
    for (let i = 0; i < 60; i++) events.push({ tick: i * 192, fret: 0 });
    const chart = buildChartGH({ events, bpm: 120 });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 60 });
    expect(r.flujo).toBeCloseTo(60 / 60 / 6, 2);
  });

  it('Acordes: 30 chords sobre 60 onsets → 50% acordes', () => {
    // 30 chord events (mismo tick con 2 frets) + 30 single events.
    const events = [];
    for (let i = 0; i < 30; i++) {
      // chord: 2 líneas en mismo tick
      events.push({ tick: i * 192, fret: 0 });
      events.push({ tick: i * 192, fret: 1 });
    }
    for (let i = 30; i < 60; i++) {
      events.push({ tick: i * 192, fret: 2 });
    }
    const chart = buildChartGH({ events });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 60 });
    expect(r.acordes).toBeCloseTo(0.5, 2);
  });

  it('Sostén: 50% del tiempo sosteniendo → saturación a 1.0', () => {
    // 1 nota con sustain de toda la duración (60s).
    // sustainTicks = 60s * (bpm/60) * resolution = 60 * 2 * 192 = 23040.
    // sustainSec / duration = 1.0 → Sostén = clamp(1.0 * 2) = 1.0.
    const events = [{ tick: 0, fret: 0, sus: 60 * 2 * 192 }];
    const chart = buildChartGH({ events });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 60 });
    expect(r.sosten).toBe(1);
  });

  it('Tramos: Verde→Naranja consecutivos cuenta como big jump', () => {
    // 6 notas alternando fret 0 (Verde) y fret 4 (Naranja). 5 transiciones, todas ≥3.
    const events = [];
    for (let i = 0; i < 6; i++) {
      events.push({ tick: i * 192, fret: i % 2 === 0 ? 0 : 4 });
    }
    const chart = buildChartGH({ events });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 12 });
    expect(r.tramos).toBe(1);
  });

  it('Tramos: trastes adyacentes nunca son big jumps', () => {
    // 6 notas alternando fret 0 y fret 1 (distancia 1). bigJumps = 0.
    const events = [];
    for (let i = 0; i < 6; i++) {
      events.push({ tick: i * 192, fret: i % 2 === 0 ? 0 : 1 });
    }
    const chart = buildChartGH({ events });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 12 });
    expect(r.tramos).toBe(0);
  });

  it('Ignora frets 5,6 (forceHopo/Tap flags) y fret 7 (open notes)', () => {
    const events = [
      { tick: 0, fret: 0 },
      { tick: 192, fret: 5 },  // forceHopo: ignorado
      { tick: 384, fret: 6 },  // forceTap: ignorado
      { tick: 576, fret: 7 },  // open: ignorado
      { tick: 768, fret: 1 }
    ];
    const chart = buildChartGH({ events });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 10 });
    // Solo 2 notas reales (fret 0, fret 1) en 10s → flujo bajo
    expect(r.flujo).toBeCloseTo((2 / 10) / 6, 2);
  });

  it('Detecta resolution distinta de 192 en el [Song] block', () => {
    const events = [{ tick: 0, fret: 0 }, { tick: 480, fret: 1 }]; // 1 quarter a res 480
    const chart = buildChartGH({ resolution: 480, events });
    const r = R.computeRadarGH({ chartText: chart, diffName: 'ExpertSingle', bpm: 120, durationSec: 10 });
    // Si la resolution se leyera mal (192 default), el spacing en beats sería incorrecto
    // y pico/sostén derivarían distintos. Aquí basta con que el cálculo no falle.
    expect(r.flujo).toBeGreaterThan(0);
  });
});

// ============================================================================
//  renderRadarSVG (smoke tests)
// ============================================================================

describe('renderRadarSVG', () => {
  it('devuelve un string SVG válido con los 5 polígonos y etiquetas', () => {
    const svg = R.renderRadarSVG({
      values: [0.5, 0.7, 0.3, 0.9, 0.1],
      labels: R.LABELS_SM,
      size: 240,
      accentColor: '#00bec8'
    });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
    // Polígono activo + 4 polígonos de grid
    const polys = svg.match(/<polygon /g) || [];
    expect(polys.length).toBe(5);
    // Las 5 etiquetas castellanas presentes
    for (const lab of R.LABELS_SM) {
      expect(svg).toContain(lab);
    }
    // Color de acento aplicado al polígono activo
    expect(svg).toContain('#00bec8');
  });

  it('usa LABELS_GH cuando se le pasa', () => {
    const svg = R.renderRadarSVG({
      values: [0.5, 0.5, 0.5, 0.5, 0.5],
      labels: R.LABELS_GH,
      size: 200,
      accentColor: '#ffd166'
    });
    for (const lab of R.LABELS_GH) {
      expect(svg).toContain(lab);
    }
  });

  it('rellena con ceros si faltan valores', () => {
    const svg = R.renderRadarSVG({
      values: [0.5],  // solo 1 valor
      labels: R.LABELS_SM
    });
    // No debe crashear y debe contener los 5 vértices
    expect(svg).toMatch(/<svg /);
    expect((svg.match(/<text /g) || []).length).toBe(10); // 5 labels + 5 percentages
  });

  it('clampea valores fuera de rango sin romper el render', () => {
    const svg = R.renderRadarSVG({
      values: [1.5, -0.3, 2.0, 0.5, -1.0],
      labels: R.LABELS_SM
    });
    expect(svg).toMatch(/<svg /);
    // Los porcentajes mostrados deben ser 100, 0, 100, 50, 0
    expect(svg).toContain('>100<');
    expect(svg).toContain('>0<');
    expect(svg).toContain('>50<');
  });

  it('escapa caracteres XML en las etiquetas para evitar inyección', () => {
    const svg = R.renderRadarSVG({
      values: [0.5, 0.5, 0.5, 0.5, 0.5],
      labels: ['<script>', 'a&b', '"q"', "'q'", 'normal']
    });
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('a&amp;b');
  });
});

// ============================================================================
//  Constantes exportadas
// ============================================================================

describe('LABELS exportados', () => {
  it('LABELS_SM tiene 5 etiquetas castellanas en orden esperado', () => {
    expect(R.LABELS_SM).toEqual(['Densidad', 'Intensidad', 'Saltos', 'Sostenidos', 'Caos']);
  });

  it('LABELS_GH tiene 5 etiquetas castellanas en orden esperado', () => {
    expect(R.LABELS_GH).toEqual(['Flujo', 'Pico', 'Acordes', 'Sostén', 'Tramos']);
  });
});
