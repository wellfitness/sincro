// Tests del pipeline de audio — verificamos la respuesta en frecuencia del
// pre-filtro `bassEmphasize` que cubre bass (<200 Hz) + mid (200-2500 Hz) en
// una sola pasada con blend 0.4/0.6 sin doblar la RAM.
//
// Estrategia: alimentamos senos puros de frecuencias conocidas y medimos el
// RMS de salida vs entrada. La salida de un filtro LTI a un tono puro es
// otro tono de la misma frecuencia con amplitud |H(f)|, así que el cociente
// RMS_out / RMS_in equivale a |H(f)|. Esperamos:
//   - Bass (50-100 Hz): ratio cerca de BLEND_BASS=0.4 (el band-pass del mid
//     a estas frecuencias da ~0 porque LP_2500 ≈ LP_200 ≈ x).
//   - Mid (1 kHz): ratio significativo por la contribución BLEND_MID·(LP_2500
//     - LP_200), que a 1 kHz vale ~0.88 en magnitud → ~0.53 ponderado.
//   - Alto (5 kHz): ratio bajo porque LP_2500 (2-polo) ya está en roll-off.
//   - Muy alto (10 kHz): ratio casi nulo.
//
// Saltamos el inicio del buffer al medir el RMS para evitar el transient
// (~100 ms) del rise del IIR — sin eso, el RMS sale artificialmente bajo
// y los tests se vuelven flaky con tolerancias estrechas.

import { describe, it, expect } from 'vitest';
import AudioPipeline from '../stepmania-web/js/audio-pipeline.js';
const { bassEmphasize, detectLevelJump } = AudioPipeline;

// Helper: AudioBuffer mock — replica solo la API que usa detectLevelJump
// (sampleRate, numberOfChannels, getChannelData). Suficiente en Node/Vitest
// sin necesidad de AudioContext real.
function makeBuffer(samples, sr) {
  const ch0 = samples instanceof Float32Array ? samples : Float32Array.from(samples);
  return {
    sampleRate: sr,
    numberOfChannels: 1,
    length: ch0.length,
    duration: ch0.length / sr,
    getChannelData: (idx) => idx === 0 ? ch0 : null
  };
}

function makeSinusoid(freqHz, sr, durationSec, amp = 1) {
  const N = Math.floor(sr * durationSec);
  const samples = new Float32Array(N);
  const omega = 2 * Math.PI * freqHz / sr;
  for (let i = 0; i < N; i++) samples[i] = amp * Math.sin(omega * i);
  return samples;
}

function rms(samples, skipStart = 0) {
  let sum = 0;
  let count = 0;
  for (let i = skipStart; i < samples.length; i++) {
    sum += samples[i] * samples[i];
    count++;
  }
  return count > 0 ? Math.sqrt(sum / count) : 0;
}

describe('bassEmphasize', () => {
  const SR = 44100;
  const DUR = 1;
  // ~113 ms de skip para que las dos cascadas IIR (BASS_FC y MID_LP_FC)
  // hayan llegado a régimen permanente antes de medir.
  const SKIP = 5000;

  it('preserva la longitud del buffer de entrada', () => {
    const input = makeSinusoid(100, SR, DUR);
    const output = bassEmphasize(input, SR);
    expect(output.length).toBe(input.length);
  });

  it('deja pasar las frecuencias bass (50 Hz) cerca de BLEND_BASS', () => {
    const input = makeSinusoid(50, SR, DUR);
    const output = bassEmphasize(input, SR);
    const ratio = rms(output, SKIP) / rms(input, SKIP);
    // Esperado ~0.40 (BLEND_BASS). Contribución del mid ≈ 0 porque LP_2500 y
    // LP_200 dejan pasar 50 Hz casi sin atenuar → su diferencia se cancela.
    expect(ratio).toBeGreaterThan(0.30);
    expect(ratio).toBeLessThan(0.55);
  });

  it('deja pasar las frecuencias bass (100 Hz) cerca de BLEND_BASS', () => {
    const input = makeSinusoid(100, SR, DUR);
    const output = bassEmphasize(input, SR);
    const ratio = rms(output, SKIP) / rms(input, SKIP);
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.55);
  });

  it('deja pasar las frecuencias mid (1 kHz) con contribución del band-pass', () => {
    const input = makeSinusoid(1000, SR, DUR);
    const output = bassEmphasize(input, SR);
    const ratio = rms(output, SKIP) / rms(input, SKIP);
    // A 1 kHz: LP_2500 2-polo ≈ 0.865, LP_200 2-polo ≈ 0.04. Su diferencia
    // (considerando fase) ≈ 0.88, ponderada por BLEND_MID=0.6 → ~0.53. El
    // bass contribuye despreciablemente. Tolerancia amplia por la suma
    // compleja con fase del bass residual.
    expect(ratio).toBeGreaterThan(0.20);
    expect(ratio).toBeLessThan(0.70);
  });

  it('atenúa frecuencias fuera de banda (5 kHz)', () => {
    const input = makeSinusoid(5000, SR, DUR);
    const output = bassEmphasize(input, SR);
    const ratio = rms(output, SKIP) / rms(input, SKIP);
    // 5 kHz > MID_LP_FC (2500): LP_2500 2-polo ≈ 0.21. Ponderado por mid
    // queda ~0.12. Bass es nulo. El filtro NO es brick-wall, así que
    // esperamos atenuación significativa pero no completa.
    expect(ratio).toBeLessThan(0.30);
  });

  it('atenúa fuertemente frecuencias muy altas (10 kHz)', () => {
    const input = makeSinusoid(10000, SR, DUR);
    const output = bassEmphasize(input, SR);
    const ratio = rms(output, SKIP) / rms(input, SKIP);
    expect(ratio).toBeLessThan(0.10);
  });

  it('es determinista: misma entrada produce salida bit-a-bit idéntica', () => {
    const input = makeSinusoid(440, SR, 0.1);
    const out1 = bassEmphasize(input, SR);
    const out2 = bassEmphasize(input, SR);
    for (let i = 0; i < out1.length; i++) {
      expect(out2[i]).toBe(out1[i]);
    }
  });

  it('no introduce NaN ni Infinity en la salida', () => {
    const input = makeSinusoid(200, SR, 0.5);
    const output = bassEmphasize(input, SR);
    for (let i = 0; i < output.length; i++) {
      expect(Number.isFinite(output[i])).toBe(true);
    }
  });
});

describe('detectLevelJump', () => {
  const SR = 22050; // SR bajo: tests rápidos sin perder resolución de ventana (1s)

  it('señal estable (seno 440 Hz a amplitud constante) → no flag', () => {
    // 4 segundos de seno a amplitud 0.3 (RMS ≈ 0.21 → ~-13 dB). Sin cambios.
    const samples = makeSinusoid(440, SR, 4, 0.3);
    const result = detectLevelJump(makeBuffer(samples, SR));
    expect(result.hasLevelJump).toBe(false);
  });

  it('salto súbito de +20 dB a mitad → flag con deltaDb > 0', () => {
    // 2s a amp 0.05 (~-29 dB), 2s a amp 0.5 (~-9 dB). Diferencia "limpia"
    // entre ventanas puras = 20 dB; tras blur del paso de 0.5s que cae a
    // caballo de la transición, el Δ máximo observable cae a ~17 dB.
    const a = makeSinusoid(440, SR, 2, 0.05);
    const b = makeSinusoid(440, SR, 2, 0.5);
    const combined = new Float32Array(a.length + b.length);
    combined.set(a, 0);
    combined.set(b, a.length);
    const result = detectLevelJump(makeBuffer(combined, SR));
    expect(result.hasLevelJump).toBe(true);
    expect(result.deltaDb).toBeGreaterThan(10);
    // El salto está en t=2s; con paso 0.5s la ventana cae cerca de ahí.
    expect(result.tSec).toBeGreaterThan(1.0);
    expect(result.tSec).toBeLessThan(2.5);
  });

  it('salto súbito a la baja → flag con deltaDb < 0', () => {
    const a = makeSinusoid(440, SR, 2, 0.5);
    const b = makeSinusoid(440, SR, 2, 0.05);
    const combined = new Float32Array(a.length + b.length);
    combined.set(a, 0);
    combined.set(b, a.length);
    const result = detectLevelJump(makeBuffer(combined, SR));
    expect(result.hasLevelJump).toBe(true);
    expect(result.deltaDb).toBeLessThan(-10);
  });

  it('silencio intro (1.5s) → música (2.5s) NO debe flagear (ignorado < -40 dB)', () => {
    // Sin el guard, el salto silencio→música sería enorme (∞ dB) y dispararía
    // todas las canciones con intro silencioso.
    const silence = new Float32Array(Math.floor(SR * 1.5)); // ceros
    const music = makeSinusoid(440, SR, 2.5, 0.3);
    const combined = new Float32Array(silence.length + music.length);
    combined.set(silence, 0);
    combined.set(music, silence.length);
    const result = detectLevelJump(makeBuffer(combined, SR));
    expect(result.hasLevelJump).toBe(false);
  });

  it('fade gradual de -20 dB a -8 dB en 4s → no flag (cada paso < 10 dB)', () => {
    // Crescendo: cada paso de 0.5s sube ≈ 1.5 dB. Δ por ventana < 2 dB.
    const N = SR * 4;
    const samples = new Float32Array(N);
    const omega = 2 * Math.PI * 440 / SR;
    for (let i = 0; i < N; i++) {
      const t = i / SR;
      const amp = 0.1 + (0.4 - 0.1) * (t / 4);
      samples[i] = amp * Math.sin(omega * i);
    }
    const result = detectLevelJump(makeBuffer(samples, SR));
    expect(result.hasLevelJump).toBe(false);
  });

  it('umbral configurable: salto intermedio supera 5 dB pero no 10 dB', () => {
    // amp 0.15 → 0.5: salto "limpio" ≈ +10.5 dB, tras blur ≈ +7.9 dB en la
    // ventana de la transición. Threshold 5 → flag; threshold 10 → no flag.
    const a = makeSinusoid(440, SR, 2, 0.15);
    const b = makeSinusoid(440, SR, 2, 0.5);
    const combined = new Float32Array(a.length + b.length);
    combined.set(a, 0);
    combined.set(b, a.length);
    const lo = detectLevelJump(makeBuffer(combined, SR), { thresholdDb: 5 });
    expect(lo.hasLevelJump).toBe(true);
    const hi = detectLevelJump(makeBuffer(combined, SR), { thresholdDb: 10 });
    expect(hi.hasLevelJump).toBe(false);
  });
});
