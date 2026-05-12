// ============================================================================
//  MAT LAYOUT — helpers puros para resolver la orientación de las diagonales
//  de la alfombra del usuario según su calibración (`localStorage['mat-mapping']`).
//
//  Motivación: las alfombras de bajo coste (10-25€) suelen llevar SOLO las dos
//  diagonales inferiores (↙ ↘) — las superiores son paneles decorativos sin
//  switch. El motor del juego (6-lane Solo) asumía históricamente diagonales
//  superiores (UP-LEFT / UP-RIGHT) porque esa es la convención de las cabinas
//  DDR originales. Resultado: usuarias con esas alfombras tenían que jugar
//  poniendo la alfombra al revés (rompiendo los cardinales) o no podían jugar
//  Solo en absoluto.
//
//  Este módulo expone una función pura `getMatDiagonalLayout(mapping)` que
//  devuelve 'up' | 'down' | 'none' a partir de qué diagonales tiene asignadas
//  el usuario en su mat-mapping. El motor consulta esto en `getActiveLaneConfig`
//  (game.js) cuando el modo Solo está activo y elige la variante de
//  LANE_CONFIG apropiada (rotaciones de flecha + roles a leer del mapping).
//
//  Política con alfombras completas (4 diagonales asignadas): devolvemos 'up'
//  porque es la convención canónica DDR/ITG/Etterna; las charts de la comunidad
//  están autorizadas con esa asunción. Las usuarias que ya juegan con cabinets
//  reales no notan ningún cambio. Solo las usuarias con alfombras de 6
//  paneles (down-only) ganan el modo Solo que antes no podían usar.
// ============================================================================

// Devuelve 'up' | 'down' | 'none' según qué diagonales tenga calibradas el
// usuario en `mapping` (objeto con keys 'upLeft', 'upRight', 'downLeft',
// 'downRight' apuntando a índices de botón). Es una función pura — no toca
// localStorage ni DOM, así que es testeable directamente en Node.
//
// La condición de "tener un par de diagonales" es que AMBAS estén asignadas
// a un número de botón válido. Tener solo upLeft (sin upRight) no cuenta como
// "tiene diagonales superiores" — la usuaria no podría jugar Solo con una
// sola diagonal del par.
function getMatDiagonalLayout(mapping) {
  if (!mapping || typeof mapping !== 'object') return 'up';
  const has = (k) => typeof mapping[k] === 'number' && mapping[k] >= 0;
  const hasUp = has('upLeft') && has('upRight');
  const hasDown = has('downLeft') && has('downRight');
  // Convención DDR: si tiene ambas (alfombra completa), priorizamos las
  // superiores. Las charts del corpus público están escritas con esa
  // asunción y los rivales online comparten la misma referencia visual.
  if (hasUp) return 'up';
  if (hasDown) return 'down';
  return 'none';
}

// Lee y parsea el mat-mapping desde localStorage. Devuelve `null` si falta,
// está corrupto, o estamos en Node (tests). Aislado para facilitar el mock.
function readMatMappingFromStorage() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem('mat-mapping');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

// Atajo para el caller habitual: detecta el layout directamente del
// localStorage. Si no hay calibración, devuelve 'up' (default DDR).
function detectMatDiagonalLayout() {
  const layout = getMatDiagonalLayout(readMatMappingFromStorage());
  return layout === 'none' ? 'up' : layout;
}

if (typeof window !== 'undefined') {
  window.MatLayout = { getMatDiagonalLayout, readMatMappingFromStorage, detectMatDiagonalLayout };
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getMatDiagonalLayout, readMatMappingFromStorage, detectMatDiagonalLayout };
}
