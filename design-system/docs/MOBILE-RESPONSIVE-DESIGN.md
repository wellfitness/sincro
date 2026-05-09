# 📱 MOBILE RESPONSIVE DESIGN - SWD Next.js

**Guía completa de diseño responsive mobile-first para el proyecto**

---

## 🚨 REGLAS CRÍTICAS (NUNCA IGNORAR)

Estas reglas son **absolutamente obligatorias** y violarlas causará problemas en dispositivos móviles reales:

### 1. CSS Móvil SIEMPRE Dentro de Media Queries

```css
/* ❌ INCORRECTO - CSS fuera de media query */
.mobile-button {
  padding: 8px 16px !important;
  font-size: 14px !important;
}

/* ✅ CORRECTO - CSS dentro de media query */
@media (max-width: 640px) {
  .mobile-button {
    padding: 8px 16px !important;
    font-size: 14px !important;
  }
}
```

**Por qué:** El CSS fuera de media queries se aplica a TODOS los tamaños de pantalla, rompiendo el diseño desktop.

### 2. Touch Targets Mínimo 44px (WCAG AA)

```css
@media (max-width: 640px) {
  .touch-button {
    min-height: 44px !important;
    min-width: 44px !important;
    padding: 10px 16px !important;
  }
}
```

**Por qué:** Touch targets menores a 44px son difíciles de tocar en móvil, violando accesibilidad WCAG AA.

### 3. Testing Obligatorio en 360px Viewport

**Dispositivos con 360px:**
- iPhone SE
- Android pequeños (mayoría de gama media/baja)

**Por qué:** Es el viewport móvil más pequeño común. Si funciona en 360px, funciona en todos.

### 4. NO Horizontal Scrolling

```css
.container {
  max-width: 100vw;
  overflow-x: hidden;
}

.wide-element {
  max-width: calc(100vw - 32px); /* Account for padding */
}
```

**Por qué:** El scroll horizontal es la experiencia móvil más frustrante para usuarios.

### 5. Mobile-First Approach

```css
/* Base styles (mobile) */
.element {
  padding: 16px;
  font-size: 14px;
}

/* Tablet enhancement */
@media (min-width: 768px) {
  .element {
    padding: 24px;
    font-size: 16px;
  }
}

/* Desktop enhancement */
@media (min-width: 1024px) {
  .element {
    padding: 32px;
    font-size: 18px;
  }
}
```

**Por qué:** Mobile-first reduce el CSS payload y sigue progressive enhancement.

---

## 📐 SISTEMA DE BREAKPOINTS

### Breakpoints Definidos

| Breakpoint | Ancho | Dispositivos | Uso |
|------------|-------|--------------|-----|
| **360px** | Testing crítico | iPhone SE, Android pequeños | Viewport mínimo a testear |
| **640px** | Mobile max | Teléfonos grandes | Punto de corte mobile/tablet |
| **768px** | Tablet | iPad, tablets Android | Breakpoint `md:` Tailwind |
| **1024px** | Desktop | Laptops, monitores | Breakpoint `lg:` Tailwind |
| **1280px** | Wide Desktop | Monitores grandes | Breakpoint `xl:` Tailwind |

### Mobile-First vs Desktop-First

```css
/* Mobile-First (RECOMENDADO) */
.element {
  /* Base styles - mobile */
}

@media (min-width: 768px) {
  .element {
    /* Enhancement - tablet */
  }
}

@media (min-width: 1024px) {
  .element {
    /* Enhancement - desktop */
  }
}

/* Desktop-First (EVITAR) */
.element {
  /* Base styles - desktop */
}

@media (max-width: 1024px) {
  .element {
    /* Override - tablet */
  }
}

@media (max-width: 768px) {
  .element {
    /* Override - mobile */
  }
}
```

### Estructura de Media Queries Recomendada

```css
/* 1. Base styles (mobile-first) */
.element {
  padding: 16px;
  font-size: 14px;
}

/* 2. Tablet enhancement (min-width) */
@media (min-width: 768px) {
  .element {
    padding: 24px;
    font-size: 16px;
  }
}

/* 3. Desktop enhancement (min-width) */
@media (min-width: 1024px) {
  .element {
    padding: 32px;
    font-size: 18px;
  }
}

/* 4. Mobile-specific fixes (max-width) - usar solo cuando necesario */
@media (max-width: 640px) {
  .element {
    /* Fixes específicos con !important si es necesario */
  }
}
```

---

## 🎯 PATRONES DE IMPLEMENTACIÓN VERIFICADOS

Estos patrones han sido probados en dispositivos reales y funcionan correctamente.

### Patrón 1: Botón Responsive

```css
.responsive-button {
  /* Base desktop styles */
  padding: 12px 24px;
  font-size: 16px;
  border-radius: 8px;
  min-height: 44px;
  transition: var(--transition-base);
}

/* Mobile optimization */
@media (max-width: 640px) {
  .responsive-button {
    padding: 8px 16px !important;
    font-size: 14px !important;
    max-width: 140px !important;
    min-height: 44px !important;
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
    overflow: hidden !important;
  }
}
```

**Uso:**
```jsx
<button className="responsive-button">
  Ver Video
</button>
```

### Patrón 2: Dropdown Responsive

```tsx
// En componente React
const ResponsiveDropdown = ({ children }) => {
  return (
    <div
      className="dropdown"
      style={{
        minWidth: 'min(400px, calc(100vw - 80px))', // 40px margin each side
        maxWidth: 'min(500px, calc(100vw - 80px))',
        width: 'calc(100vw - 80px)'
      }}
    >
      {children}
    </div>
  );
};
```

```css
/* CSS backup para consistencia */
@media (max-width: 640px) {
  .dropdown {
    width: calc(100vw - 80px) !important;
    max-width: calc(100vw - 80px) !important;
    min-width: calc(100vw - 80px) !important;
  }
}

/* Ultra-small screens */
@media (max-width: 360px) {
  .dropdown {
    width: calc(100vw - 64px) !important;
    max-width: 280px !important;
  }
}
```

**Principio:** Usar `calc(100vw - Xpx)` para márgenes consistentes laterales.

### Patrón 3: Container Responsive

```css
.responsive-container {
  /* Desktop first */
  max-width: 1200px;
  padding: 24px;
  margin: 0 auto;
  overflow-x: hidden;
}

/* Mobile optimization */
@media (max-width: 640px) {
  .responsive-container {
    padding: 16px !important;
    max-width: calc(100vw - 32px) !important;
  }
}

/* Ultra-small screens */
@media (max-width: 360px) {
  .responsive-container {
    padding: 12px !important;
    max-width: calc(100vw - 24px) !important;
  }
}
```

### Patrón 4: Typography Responsive

```css
.responsive-heading {
  /* Desktop */
  font-size: var(--font-size-3xl); /* 30px */
  line-height: 1.2;
  margin-bottom: var(--space-6);
}

/* Mobile */
@media (max-width: 640px) {
  .responsive-heading {
    font-size: var(--font-size-2xl) !important; /* 24px */
    line-height: 1.3;
    margin-bottom: var(--space-4);
  }
}

.responsive-body-text {
  /* Desktop */
  font-size: var(--font-size-base); /* 16px */
  line-height: 1.6;
}

/* Mobile */
@media (max-width: 640px) {
  .responsive-body-text {
    font-size: var(--font-size-sm) !important; /* 14px */
    line-height: 1.5;
  }
}
```

### Patrón 5: Grid Responsive

```css
.responsive-grid {
  display: grid;
  gap: var(--space-6);
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

/* Mobile single column */
@media (max-width: 640px) {
  .responsive-grid {
    grid-template-columns: 1fr !important;
    gap: var(--space-4);
  }
}

/* Tablet two columns */
@media (min-width: 768px) and (max-width: 1023px) {
  .responsive-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
```

---

## ⚠️ ANTI-PATRONES (NUNCA HACER)

### ❌ Anti-Patrón 1: CSS Fuera de Media Queries

**Problema:**
```css
/* Esto se aplicará a TODOS los tamaños de pantalla */
.mobile-button {
  padding: 8px 16px !important;
  font-size: 14px !important;
}
```

**Por qué falla:**
- Rompe el diseño desktop
- No respeta progressive enhancement
- Dificulta debugging

**Solución:**
```css
@media (max-width: 640px) {
  .mobile-button {
    padding: 8px 16px !important;
    font-size: 14px !important;
  }
}
```

### ❌ Anti-Patrón 2: Fixed Widths Sin Responsive Calculations

**Problema:**
```css
.dropdown {
  width: 400px;
  max-width: 500px;
}
```

**Por qué falla:**
- Se corta en pantallas < 400px
- Causa horizontal scrolling
- No se adapta al viewport

**Solución:**
```css
.dropdown {
  width: min(400px, calc(100vw - 80px));
  max-width: min(500px, calc(100vw - 80px));
}
```

### ❌ Anti-Patrón 3: Touch Targets < 44px

**Problema:**
```css
.small-button {
  padding: 4px 8px;
  font-size: 12px;
  /* min-height: ~30px - TOO SMALL */
}
```

**Por qué falla:**
- Viola WCAG AA
- Difícil de tocar en móvil
- Mala experiencia de usuario

**Solución:**
```css
@media (max-width: 640px) {
  .small-button {
    padding: 10px 16px !important;
    min-height: 44px !important;
    min-width: 44px !important;
  }
}
```

### ❌ Anti-Patrón 4: !important Innecesario

**Problema:**
```css
.element {
  color: blue !important; /* No hay conflicto que resolver */
  padding: 16px !important; /* No necesario */
}
```

**Cuándo SÍ usar !important:**
```css
/* Cuando necesitas override desktop styles en mobile */
@media (max-width: 640px) {
  .desktop-override {
    padding: 8px 16px !important; /* Override necesario */
  }
}
```

**Cuándo NO usar !important:**
```css
/* Estilos base sin conflictos */
.base-element {
  color: blue; /* NO necesita !important */
  padding: 16px; /* NO necesita !important */
}
```

### ❌ Anti-Patrón 5: Viewport Units Sin Calc()

**Problema:**
```css
.full-width {
  width: 100vw; /* Puede causar horizontal scroll */
}
```

**Por qué falla:**
- No considera padding del parent
- Puede causar overflow
- No respeta márgenes

**Solución:**
```css
.full-width {
  width: calc(100vw - 32px); /* Considera 16px padding cada lado */
  max-width: 100%;
}
```

---

## 🔧 TROUBLESHOOTING - 5 PROBLEMAS MÁS COMUNES

### Problema 1: CSS No Se Aplica en Mobile Real

**Síntomas:**
- Funciona en DevTools mobile simulation
- NO funciona en dispositivo móvil real
- Estilos se ven correctos en inspector

**Causa Raíz:**
CSS móvil está fuera de media queries

**Diagnóstico:**
```css
/* Buscar estilos como este FUERA de @media */
.mobile-specific {
  padding: 8px;
}
```

**Solución:**
```css
/* Mover DENTRO de @media (max-width: 640px) */
@media (max-width: 640px) {
  .mobile-specific {
    padding: 8px !important;
  }
}
```

### Problema 2: Dropdown Se Corta en 360px

**Síntomas:**
- Dropdown se corta en los bordes laterales
- Aparece scroll horizontal
- Contenido del dropdown no es completamente visible

**Causa Raíz:**
Ancho fijo mayor al viewport disponible

**Diagnóstico:**
```tsx
// Dropdown con width fijo
<div style={{ width: '400px' }}>
  {/* 400px > 360px viewport */}
</div>
```

**Solución:**
```tsx
<div style={{
  width: 'calc(100vw - 80px)', // 40px margin each side
  maxWidth: 'calc(100vw - 80px)',
  minWidth: 'calc(100vw - 80px)'
}}>
  {/* Dropdown content */}
</div>
```

```css
/* Backup CSS */
@media (max-width: 360px) {
  .dropdown {
    width: calc(100vw - 64px) !important;
    max-width: 280px !important;
  }
}
```

### Problema 3: Botones Difíciles de Tocar

**Síntomas:**
- Usuarios reportan dificultad para tocar botones
- Botones demasiado pequeños en móvil
- Touch targets se sienten "apretados"

**Causa Raíz:**
Touch targets menores a 44px (violación WCAG AA)

**Diagnóstico:**
```javascript
// Verificar touch targets
document.querySelectorAll('button').forEach(btn => {
  const rect = btn.getBoundingClientRect();
  if (rect.height < 44 || rect.width < 44) {
    console.warn('Touch target too small:', btn, rect);
  }
});
```

**Solución:**
```css
@media (max-width: 640px) {
  .touch-button {
    min-height: 44px !important;
    min-width: 44px !important;
    padding: 10px 16px !important;
  }
}
```

### Problema 4: Texto Pegado a Bordes de Botón

**Síntomas:**
- Texto aparece "apretado" contra bordes del botón
- Padding lateral insuficiente
- Botones se ven mal en móvil

**Causa Raíz:**
Padding lateral insuficiente en móvil

**Diagnóstico:**
```css
/* Desktop padding OK, pero no hay override mobile */
.button {
  padding: 12px 24px; /* OK desktop */
}

/* Falta CSS mobile */
```

**Solución:**
```css
@media (max-width: 640px) {
  .button {
    padding: 8px 16px !important; /* +8px lateral mínimo */
    max-width: 140px !important; /* Prevenir overflow */
    white-space: nowrap !important;
    text-overflow: ellipsis !important;
    overflow: hidden !important;
  }
}
```

### Problema 5: Horizontal Scrolling

**Síntomas:**
- Usuario puede scroll horizontalmente
- Contenido más ancho que viewport
- Layouts rotos en móvil

**Causa Raíz:**
Elementos con width mayor al viewport disponible

**Diagnóstico:**
```javascript
// Encontrar elementos que causan overflow
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > window.innerWidth) {
    console.warn('Element causing overflow:', el);
  }
});
```

**Solución:**
```css
/* Container principal */
.main-container {
  max-width: 100vw;
  overflow-x: hidden;
}

/* Elementos anchos */
.wide-element {
  max-width: calc(100vw - 32px);
  box-sizing: border-box;
}

/* Global fix si es necesario */
* {
  max-width: 100%;
  box-sizing: border-box;
}
```

---

## ✅ TESTING CHECKLIST

### Viewports Obligatorios

- [ ] **360px** - iPhone SE, Android pequeños (CRÍTICO)
- [ ] **375px** - iPhone 12 mini
- [ ] **390px** - iPhone 14 (standard)
- [ ] **414px** - iPhone 14 Plus
- [ ] **768px** - iPad (breakpoint tablet)
- [ ] **1024px** - Desktop (breakpoint desktop)
- [ ] **1280px** - Wide desktop

### Checklist Técnico Pre-Deploy

- [ ] Sin scroll horizontal en ningún viewport
- [ ] Todos los touch targets ≥ 44px
- [ ] Dropdowns no desbordados en 360px
- [ ] Texto legible (mínimo 14px en móvil)
- [ ] CSS móvil dentro de `@media (max-width: 640px)`
- [ ] Variables CSS usadas correctamente
- [ ] Padding lateral suficiente en botones (min 16px)
- [ ] Márgenes consistentes (calc(100vw - Xpx))
- [ ] Focus indicators visibles
- [ ] Keyboard navigation funcional

### Checklist de Accesibilidad

- [ ] Touch targets ≥ 44px (WCAG AA)
- [ ] Contraste de color ≥ 4.5:1 para texto
- [ ] Focus indicators visibles
- [ ] Screen reader compatible
- [ ] Keyboard navigation completa
- [ ] No hay color como único indicador
- [ ] Alt text en imágenes
- [ ] Semantic HTML usado correctamente

### DevTools Setup para Testing

**Chrome DevTools Custom Device:**
```json
{
  "name": "Test 360px",
  "width": 360,
  "height": 640,
  "deviceScaleFactor": 2,
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
}
```

**Pasos para agregar:**
1. Chrome DevTools → Settings (F1)
2. Devices tab
3. Add custom device
4. Usar para testing en 360px

### Testing con Real Devices

**Dispositivos recomendados:**
- iPhone SE (viewport más pequeño iOS)
- iPhone 14 (estándar moderno iOS)
- iPad (tablet testing)
- Android gama media (Samsung A series)
- Android flagship (Pixel, Samsung S)

**Browsers a testear:**
- Safari Mobile (iOS) - Engine diferente a Chrome
- Chrome Mobile (Android) - Más usado globalmente
- Samsung Internet - Popular en Android
- Firefox Mobile - Alternativa importante

---

## 📚 VARIABLES CSS PARA MOBILE

### Variables de Tamaño de Texto

```css
:root {
  --text-mobile-min: 12px;    /* Texto mínimo móvil */
  --text-sm: 14px;            /* Texto pequeño móvil */
  --text-base-mobile: 16px;   /* Texto base móvil */
  --text-lg-mobile: 18px;     /* Texto grande móvil */
}
```

### Variables de Spacing

```css
:root {
  --button-padding-mobile: 8px 16px;
  --container-padding-mobile: 16px;
  --section-spacing-mobile: 24px;
}
```

### Variables de Touch Targets

```css
:root {
  --touch-target-min: 44px;    /* WCAG AA minimum */
  --touch-target-sm: 36px;     /* Pequeño pero aceptable */
  --touch-target-lg: 48px;     /* Extra cómodo */
}
```

### Variables de Breakpoints (para JS)

```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

**Uso en JavaScript:**
```javascript
const breakpointMd = getComputedStyle(document.documentElement)
  .getPropertyValue('--breakpoint-md');

if (window.innerWidth <= parseInt(breakpointMd)) {
  // Mobile logic
}
```

---

## 🎨 UTILITY CLASSES DISPONIBLES

### Layout Classes

```css
/* Containers */
.mobile-container         /* Responsive container con padding apropiado */
.mobile-overflow-hidden   /* Previene horizontal scrolling */

/* Grid Systems */
.mobile-grid             /* 1-column mobile, 2-column tablet/desktop */
.workout-blocks-grid     /* Grid específico para workout blocks */

/* Flex Systems */
.mobile-flex             /* Column en mobile, row en desktop */
.mobile-flex-wrap        /* Responsive flex con wrapping */
```

**Ubicación:** `src/styles/mobile-utilities.css`

### Touch Target Classes

```css
.touch-target            /* 44px mínimo (WCAG AA) */
.touch-target-sm         /* 36px (usar con precaución) */
.touch-target-lg         /* 48px (extra cómodo) */
```

**Uso:**
```jsx
<button className="touch-target">
  Click Me
</button>
```

### Typography Classes

```css
.mobile-text             /* Texto responsive con line-height óptimo */
.mobile-heading          /* Headings responsive */
.mobile-text-wrap        /* Text wrapping con hyphenation */
```

### Visibility Classes

```css
.mobile-only             /* Visible solo en mobile (< 768px) */
.desktop-only            /* Visible solo en desktop (≥ 768px) */
.tablet-only             /* Visible solo en tablet (768px - 1023px) */
```

**Uso:**
```jsx
<div className="mobile-only">
  Solo visible en móvil
</div>

<div className="desktop-only">
  Solo visible en desktop
</div>
```

### Button Classes

```css
.mobile-btn              /* Base responsive button */
.mobile-btn-primary      /* Primary action button */
.mobile-btn-secondary    /* Secondary action button */
.mobile-btn-critical     /* Critical action button (red) */
```

---

## 🔍 DEBUGGING

### Console Debugging Scripts

**Verificar Touch Targets:**
```javascript
// Encontrar touch targets menores a 44px
document.querySelectorAll('button, a, [role="button"]').forEach(el => {
  const rect = el.getBoundingClientRect();
  if (rect.height < 44 || rect.width < 44) {
    console.warn('Touch target too small:', el, `${rect.width}x${rect.height}`);
    el.style.outline = '2px solid red'; // Visual indicator
  }
});
```

**Verificar Viewport Width:**
```javascript
// Log viewport dimensions
console.log('Viewport:', window.innerWidth + 'x' + window.innerHeight);
console.log('Screen:', screen.width + 'x' + screen.height);
console.log('Device Pixel Ratio:', window.devicePixelRatio);
```

**Encontrar Horizontal Overflow:**
```javascript
// Encontrar elementos que causan horizontal scroll
document.querySelectorAll('*').forEach(el => {
  if (el.scrollWidth > document.documentElement.clientWidth) {
    console.warn('Element causing overflow:', el);
    console.log('Element width:', el.scrollWidth);
    console.log('Viewport width:', document.documentElement.clientWidth);
    el.style.outline = '3px solid red';
  }
});
```

### Visual Debugging CSS

**Outline all elements:**
```css
/* Temporal - para debugging de layout */
* {
  outline: 1px solid red !important;
}

/* Debugging de touch targets */
@media (max-width: 640px) {
  button, .clickable, a {
    background: rgba(255, 0, 0, 0.1) !important;
    min-height: 44px !important;
  }
}
```

**Grid visualization:**
```css
/* Visualizar grid lines */
.grid-debug {
  background-image:
    repeating-linear-gradient(
      0deg,
      rgba(255, 0, 0, 0.1) 0px,
      rgba(255, 0, 0, 0.1) 1px,
      transparent 1px,
      transparent 8px
    ),
    repeating-linear-gradient(
      90deg,
      rgba(255, 0, 0, 0.1) 0px,
      rgba(255, 0, 0, 0.1) 1px,
      transparent 1px,
      transparent 8px
    );
}
```

### Browser DevTools Tips

**Chrome DevTools:**
1. Device Mode (Cmd+Shift+M / Ctrl+Shift+M)
2. Select custom device (360px test)
3. Enable "Show media queries" en responsive mode
4. Use "Capture screenshot" para comparar visualmente

**Safari Web Inspector (iOS):**
1. Settings → Safari → Advanced → Web Inspector: ON
2. Connect iPhone via USB
3. Safari → Develop → [Your iPhone] → [Your page]
4. Test real touch interactions

---

## 📋 MANTENIMIENTO Y MEJORA CONTINUA

### Revisión Periódica (Cada 3 Meses)

- [ ] Revisar analytics de dispositivos más usados
- [ ] Testear en nuevos dispositivos/browsers lanzados
- [ ] Actualizar breakpoints según datos de uso
- [ ] Revisar variables CSS por consistencia
- [ ] Verificar WCAG compliance en nuevos componentes

### Monitoreo de Métricas

**Core Web Vitals (Mobile):**
- LCP (Largest Contentful Paint) < 2.5s
- FID (First Input Delay) < 100ms
- CLS (Cumulative Layout Shift) < 0.1

**Custom Metrics:**
- % usuarios mobile vs desktop
- Bounce rate por viewport size
- Touch target interaction success rate
- Reportes de usabilidad mobile

### Cuando Agregar Nuevo CSS Mobile

**Checklist antes de commit:**
1. CSS está dentro de `@media (max-width: 640px)`
2. Touch targets ≥ 44px verificados
3. Testeado en 360px viewport
4. No causa horizontal scroll
5. Variables CSS usadas (no valores hardcoded)
6. !important usado solo cuando necesario
7. Documentado en este archivo si es patrón reusable

---

## 🔗 ARCHIVOS RELACIONADOS

### CSS Files
- `src/styles/design-tokens.css` → Variables globales del design system
- `src/styles/components.css` → Componentes base con mobile enhancements
- `src/styles/workout-responsive.css` → Responsive específico para workout sessions
- `src/styles/mobile-utilities.css` → Utility classes mobile reusables
- `src/styles/group-generators.css` → Estilos específicos de generadores

### Configuration
- `tailwind.config.ts` → Breakpoints Tailwind configurados
- `design-system/docs/DESIGN-SYSTEM.md` → Design system maestro (referencia principal)

### Components
- `src/components/ExerciseAlternativesDropdown.tsx` → Ejemplo de dropdown responsive
- Todos los generadores en `src/app/dashboard/` → Implementaciones responsive

---

## 💡 RECURSOS ADICIONALES

### Tools
- [Responsively App](https://responsively.app/) - Test múltiples viewports simultáneamente
- [BrowserStack](https://www.browserstack.com/) - Test en dispositivos reales remotos
- [Chrome DevTools Device Mode](https://developer.chrome.com/docs/devtools/device-mode/) - Simulador built-in

### Documentation
- [MDN Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries)
- [WCAG Touch Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [CSS Tricks - Complete Guide to Responsive Design](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)

---

**Última actualización:** Octubre 2025
**Versión:** 1.0.0
**Mantenido por:** Design System Team
