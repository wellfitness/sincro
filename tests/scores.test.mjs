// Tests del sistema arcade de puntuaciones — helpers puros que orquestan
// el ranking. Si esto se rompe, la suite muestra rankings incorrectos sin
// que nadie se entere hasta que un jugador note que su record desapareció.
//
// IndexedDB queda fuera de cobertura por diseño: probar IndexedDB en Node
// requiere fake-indexeddb y eso es testear el navegador, no nuestra lógica.

import { describe, it, expect } from 'vitest';
import pkg from '../stepmania-web/js/scores.js';
const { chartIdOf, sanitizePlayerName, rankRuns, bestRunPerPlayer } = pkg;

describe('chartIdOf', () => {
  it('produce string compuesto songId:chartKey', () => {
    expect(chartIdOf(7, 'hard')).toBe('7:hard');
  });

  it('acepta songId numérico o string sin perder estabilidad', () => {
    expect(chartIdOf(42, 'Challenge')).toBe('42:Challenge');
    expect(chartIdOf('42', 'Challenge')).toBe('42:Challenge');
  });

  it('preserva el casing del chartKey (importante para matching con .ssc)', () => {
    expect(chartIdOf(1, 'Beginner')).toBe('1:Beginner');
    expect(chartIdOf(1, 'beginner')).toBe('1:beginner');
  });
});

describe('sanitizePlayerName', () => {
  it('trim espacios al inicio y al final', () => {
    expect(sanitizePlayerName('  Elena  ')).toBe('Elena');
  });

  it('colapsa whitespace interno a un solo espacio', () => {
    expect(sanitizePlayerName('Elena   Cruces')).toBe('Elena Cruces');
  });

  it('strip de control chars (incluye DEL y \\u0000-\\u001f)', () => {
    expect(sanitizePlayerName('El\x00ena')).toBe('Elena');
    expect(sanitizePlayerName('El\x1fena')).toBe('Elena');
    expect(sanitizePlayerName('El\x7fena')).toBe('Elena');
  });

  it('capa a 12 caracteres', () => {
    expect(sanitizePlayerName('AbcdefghijklmnopQ')).toBe('Abcdefghijkl');
    expect(sanitizePlayerName('AbcdefghijklmnopQ').length).toBe(12);
  });

  it('vacío o solo whitespace → "Anónimo"', () => {
    expect(sanitizePlayerName('')).toBe('Anónimo');
    expect(sanitizePlayerName('   ')).toBe('Anónimo');
    expect(sanitizePlayerName('\t\n  \r')).toBe('Anónimo');
    expect(sanitizePlayerName(null)).toBe('Anónimo');
    expect(sanitizePlayerName(undefined)).toBe('Anónimo');
  });

  it('preserva acentos y caracteres no-ASCII Unicode', () => {
    expect(sanitizePlayerName('Élena')).toBe('Élena');
    expect(sanitizePlayerName('José')).toBe('José');
    expect(sanitizePlayerName('Ñoño')).toBe('Ñoño');
    expect(sanitizePlayerName('日本')).toBe('日本');
  });

  it('no rompe con input no-string (number, object)', () => {
    expect(sanitizePlayerName(42)).toBe('42');
    expect(sanitizePlayerName({})).toBe('[object Obje');  // toString truncado a 12
  });
});

describe('rankRuns', () => {
  const r = (score, playedAt, extras = {}) => ({ score, playedAt, ...extras });

  it('ordena por score descendente', () => {
    const sorted = rankRuns([r(100, 1), r(300, 2), r(200, 3)]);
    expect(sorted.map(x => x.score)).toEqual([300, 200, 100]);
  });

  it('en ties por score, gana el playedAt más antiguo (convención arcade)', () => {
    const sorted = rankRuns([r(500, 100), r(500, 50), r(500, 200)]);
    expect(sorted.map(x => x.playedAt)).toEqual([50, 100, 200]);
  });

  it('es estable cuando score y playedAt coinciden (orden original)', () => {
    const a = r(100, 1, { name: 'A' });
    const b = r(100, 1, { name: 'B' });
    const c = r(100, 1, { name: 'C' });
    const sorted = rankRuns([a, b, c]);
    expect(sorted.map(x => x.name)).toEqual(['A', 'B', 'C']);
  });

  it('no muta el array original', () => {
    const input = [r(100, 1), r(300, 2)];
    const inputCopy = [...input];
    rankRuns(input);
    expect(input).toEqual(inputCopy);
  });

  it('maneja runs sin playedAt (los trata como 0)', () => {
    const sorted = rankRuns([r(100, undefined), r(100, 500)]);
    // El undefined→0 sale primero por ser "más antiguo"
    expect(sorted[0].playedAt).toBe(undefined);
  });

  it('array vacío devuelve array vacío', () => {
    expect(rankRuns([])).toEqual([]);
  });
});

describe('bestRunPerPlayer', () => {
  const r = (playerLower, score, playedAt, playerName) => ({
    playerLower, score, playedAt, playerName: playerName || playerLower
  });

  it('colapsa runs del mismo jugador, quedándose con la de mayor score', () => {
    const runs = [
      r('elena', 100, 1),
      r('elena', 300, 2),
      r('elena', 200, 3)
    ];
    const best = bestRunPerPlayer(runs);
    expect(best.length).toBe(1);
    expect(best[0].score).toBe(300);
  });

  it('match case-insensitive vía playerLower', () => {
    const runs = [
      { playerLower: 'elena', playerName: 'Elena', score: 100, playedAt: 1 },
      { playerLower: 'elena', playerName: 'ELENA', score: 200, playedAt: 2 }
    ];
    const best = bestRunPerPlayer(runs);
    expect(best.length).toBe(1);
    expect(best[0].score).toBe(200);
    expect(best[0].playerName).toBe('ELENA'); // el del run ganador
  });

  it('preserva el playerName original (no lowercase) del run ganador', () => {
    const runs = [
      r('elena', 100, 1, 'Elena'),
      r('elena', 300, 2, 'ELENA-2'),
      r('mario', 200, 3, 'Mario')
    ];
    const best = bestRunPerPlayer(runs);
    const elena = best.find(x => x.playerLower === 'elena');
    expect(elena.playerName).toBe('ELENA-2');
  });

  it('en ties por score, el playedAt más antiguo se queda con el slot', () => {
    const runs = [
      r('elena', 500, 200),
      r('elena', 500, 100)  // más antigua, gana el slot
    ];
    const best = bestRunPerPlayer(runs);
    expect(best[0].playedAt).toBe(100);
  });

  it('devuelve el resultado ya ordenado por rankRuns (score desc)', () => {
    const runs = [
      r('mario', 100, 1),
      r('elena', 300, 2),
      r('ana', 200, 3)
    ];
    const best = bestRunPerPlayer(runs);
    expect(best.map(x => x.playerLower)).toEqual(['elena', 'ana', 'mario']);
  });

  it('fallback a playerName.toLowerCase() si falta playerLower', () => {
    const runs = [
      { playerName: 'Elena', score: 100, playedAt: 1 },
      { playerName: 'elena', score: 200, playedAt: 2 }
    ];
    const best = bestRunPerPlayer(runs);
    expect(best.length).toBe(1);
    expect(best[0].score).toBe(200);
  });

  it('array vacío devuelve array vacío', () => {
    expect(bestRunPerPlayer([])).toEqual([]);
  });
});
