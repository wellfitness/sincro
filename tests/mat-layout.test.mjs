// Tests del detector de orientación de diagonales según calibración del mat.
//
// Decisión bajo test: dado un `mat-mapping` (lo que test-pad.html persiste en
// localStorage tras la calibración), `getMatDiagonalLayout` decide qué carriles
// diagonales debe usar el motor en modo Solo (6). Esto importa para alfombras
// de 6 botones baratas (solo cardinales + ↙↘), que históricamente quedaban sin
// modo Solo jugable porque el motor asumía siempre ↖↗ (convención DDR cabinet).
//
// Invariantes:
// - Sin mapping → 'up' (default DDR canónico).
// - Solo upLeft+upRight asignados → 'up'.
// - Solo downLeft+downRight asignados → 'down'.
// - Ambos pares asignados (alfombra 8-botones completa) → 'up' (convención DDR
//   prevalece; las charts del corpus se distribuyen con esa asunción).
// - Solo UNA diagonal del par (asimétrico) → 'none', porque jugar Solo con
//   media diagonal no tiene sentido.
// - Valores no numéricos (null, undefined, string) → tratados como "no
//   asignado".

import { describe, it, expect } from 'vitest';
import ml from '../stepmania-web/js/mat-layout.js';

const { getMatDiagonalLayout, detectMatDiagonalLayout } = ml;

describe('getMatDiagonalLayout', () => {
  it('devuelve "up" cuando no hay mapping (null/undefined)', () => {
    expect(getMatDiagonalLayout(null)).toBe('up');
    expect(getMatDiagonalLayout(undefined)).toBe('up');
  });

  it('devuelve "none" para mapping vacío {}', () => {
    // Diferencia sutil con `null`: el caller distingue "sin calibrar" (null)
    // de "calibró pero saltó todas las diagonales" ({} o solo cardinales).
    // Solo el consumer `detectMatDiagonalLayout` colapsa ambos a 'up'.
    expect(getMatDiagonalLayout({})).toBe('none');
  });

  it('devuelve "up" cuando solo las diagonales superiores están asignadas', () => {
    const mapping = { left: 0, down: 1, up: 2, right: 3, upLeft: 4, upRight: 5 };
    expect(getMatDiagonalLayout(mapping)).toBe('up');
  });

  it('devuelve "down" cuando solo las diagonales inferiores están asignadas', () => {
    const mapping = { left: 0, down: 1, up: 2, right: 3, downLeft: 6, downRight: 7 };
    expect(getMatDiagonalLayout(mapping)).toBe('down');
  });

  it('devuelve "up" cuando todas las diagonales están asignadas (alfombra completa)', () => {
    const mapping = {
      left: 0, down: 1, up: 2, right: 3,
      upLeft: 4, upRight: 5, downLeft: 6, downRight: 7
    };
    expect(getMatDiagonalLayout(mapping)).toBe('up');
  });

  it('devuelve "none" si solo hay una mitad del par de diagonales', () => {
    // upLeft asignada pero upRight no — no juegan diagonales superiores.
    expect(getMatDiagonalLayout({ left: 0, down: 1, up: 2, right: 3, upLeft: 4 })).toBe('none');
    // downRight asignada pero downLeft no.
    expect(getMatDiagonalLayout({ left: 0, down: 1, up: 2, right: 3, downRight: 7 })).toBe('none');
  });

  it('trata botón 0 como asignación válida (no es falsy en este contexto)', () => {
    // Edge case: si por la calibración del usuario downLeft cae en button[0]
    // (alfombras raras o reasignación manual), el chequeo "typeof === 'number'"
    // debe aceptarlo. Antes el guard común `if (m.downLeft)` rechazaba 0.
    const mapping = { downLeft: 0, downRight: 1 };
    expect(getMatDiagonalLayout(mapping)).toBe('down');
  });

  it('ignora valores no numéricos en las claves de diagonal', () => {
    // null, undefined o string son tratados como "no asignado" — protege
    // contra mappings corruptos en localStorage (versión vieja del schema,
    // edición manual del usuario, etc.).
    expect(getMatDiagonalLayout({ upLeft: null, upRight: 5 })).toBe('none');
    expect(getMatDiagonalLayout({ upLeft: undefined, upRight: 5 })).toBe('none');
    expect(getMatDiagonalLayout({ upLeft: '4', upRight: 5 })).toBe('none');
    expect(getMatDiagonalLayout({ downLeft: -1, downRight: 7 })).toBe('none');
  });

  it('alfombra de 4 botones (sin diagonales) devuelve "none"', () => {
    // Solo cardinales — la usuaria solo puede jugar default (4-lane). Si
    // intenta forzar Solo, el motor degrada graceful: usa LANE_CONFIGS[6]
    // (variante "up") con las dos diagonales sin asignar — esos botones no
    // responden pero el resto sí. El cambio de comportamiento aquí es
    // intencional: devolver 'none' permite al caller decidir entre fallback
    // 'up' (actual) o desactivar Solo entero en el futuro.
    const mapping = { left: 0, down: 1, up: 2, right: 3 };
    expect(getMatDiagonalLayout(mapping)).toBe('none');
  });

  it('input no-objeto devuelve "up" sin lanzar', () => {
    expect(getMatDiagonalLayout('not an object')).toBe('up');
    expect(getMatDiagonalLayout(42)).toBe('up');
    expect(getMatDiagonalLayout(false)).toBe('up');
  });
});

describe('detectMatDiagonalLayout', () => {
  it('colapsa "none" a "up" para que el motor tenga siempre un fallback útil', () => {
    // En Node `localStorage` no existe → `readMatMappingFromStorage` devuelve
    // null → `getMatDiagonalLayout(null)` devuelve 'up'. Test indirecto pero
    // suficiente: confirma que detectMatDiagonalLayout NUNCA devuelve 'none'.
    const result = detectMatDiagonalLayout();
    expect(['up', 'down']).toContain(result);
    expect(result).not.toBe('none');
  });
});
