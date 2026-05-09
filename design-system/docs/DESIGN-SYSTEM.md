# DESIGN SYSTEM - System WOD Generator

Documentación completa del sistema de diseño implementado en el proyecto Next.js de System WOD Generator.

## PALETA DE COLORES & ARQUITECTURA CSS

### **Color System Architecture** (Based on guia-visual-app.html):

#### **TURQUESA - Primary Brand Color (#00BEC8)**:
```css
/* Turquesa Scale - Main brand color */
--turquesa-100: #cdfffb;         /* Light backgrounds, hover states */
--turquesa-400: #18f8f6;         /* Active states, highlights */
--turquesa-600: #00bec8;         /* PRIMARY - buttons, navigation */
--turquesa-700: #088b96;         /* Hover states for primary */
```

#### **ROSA FUERTE - Critical Actions (#E11D48)**:
```css
/* Rosa Scale - Critical/destructive actions */
--rosa-100: #ffe4ea;            /* Error backgrounds (soft) */
--rosa-400: #fb718f;            /* Critical hover states */
--rosa-600: #e11d48;            /* CRITICAL - delete, errors */
--rosa-700: #be1238;            /* Hover for critical buttons */
```

#### **TULIP TREE - Warning/Attention (#EAB308)**:
```css
/* Tulip Tree Scale - Warnings and attention */
--tulip-tree-50: #fef9e8;       /* Very soft warning backgrounds */
--tulip-tree-200: #fee28a;      /* Warning backgrounds */
--tulip-tree-300: #fdd147;      /* Warning highlights */
--tulip-tree-500: #eab308;      /* WARNING - important alerts */
```

#### **NEUTRAL GRAYS - Text and Surfaces**:
```css
/* Gray Scale - Complete neutral system */
--gris-50: #f9fafb;            /* Light surface */
--gris-100: #f3f4f6;           /* Border light */
--gris-200: #e5e7eb;           /* Border standard */
--gris-300: #d1d5db;           /* Border medium */
--gris-400: #9ca3af;           /* Text muted */
--gris-500: #6b7280;           /* Text light */
--gris-600: #4b5563;           /* Text medium */
--gris-700: #374151;           /* Text secondary */
--gris-800: #1f2937;           /* Text strong */
--gris-900: #111827;           /* Text primary */
```

### **Text Contrast Rules** (Critical for Accessibility):
- **Light Backgrounds** (Turquesa 100/400, Rosa 100/400, Tulip Tree 50/200/300): **BLACK TEXT**
- **Dark Backgrounds** (Turquesa 600/700, Rosa 600/700, Tulip Tree 500): **WHITE TEXT**

### **Semantic Color Aliases**:
```css
/* Semantic naming for consistency */
--color-primary: var(--turquesa-600);      /* Main brand actions */
--color-primary-light: var(--turquesa-400); /* Active states */
--color-primary-dark: var(--turquesa-700);  /* Hover states */
--color-critical: var(--rosa-600);         /* Destructive actions */
--color-warning: var(--tulip-tree-500);    /* Important alerts */
--color-success: #059669;                  /* Success states */
--color-error: var(--rosa-600);            /* Error states */
--color-info: var(--turquesa-600);         /* Information */
```

## SISTEMA DE TIPOGRAFÍA

### **Font Families**:
```css
--font-family-headings: 'Righteous', cursive;  /* Headers, titles */
--font-family-body: 'ABeeZee', sans-serif;     /* Body, UI text */
```

### **Font Sizes (Responsive)**:
```css
--font-size-3xl: 2.25rem;      /* Main titles */
--font-size-xl: 1.5rem;        /* Section titles */
--font-size-lg: 1.125rem;      /* Subsection titles */
--font-size-base: 1rem;        /* Body text */
--font-size-sm: 0.875rem;      /* Small text */
--font-size-xs: 0.75rem;       /* Micro text */
--font-size-button: 1.3125rem; /* 21px - Desktop buttons */
--font-size-tag: 1.0625rem;    /* 17px - Tags, labels */
--font-size-mobile-min: 1rem;  /* 16px - Mobile minimum */
```

### **Typography Standards**:
- **Desktop Buttons**: 21px (var(--font-size-button))
- **Tags & Labels**: 17px (var(--font-size-tag))
- **Mobile Minimum**: 16px para legibilidad
- **Font Stack**: Righteous para headers, ABeeZee para texto del cuerpo

## SISTEMA DE ESPACIADO (8px Base Grid)

```css
/* Consistent spacing scale */
--space-1: 8px;    /* Micro spacing */
--space-2: 16px;   /* Small spacing */
--space-3: 24px;   /* Medium spacing */
--space-4: 32px;   /* Large spacing */
--space-5: 40px;   /* XL spacing */
--space-6: 48px;   /* XXL spacing */
--space-8: 64px;   /* Section spacing */

/* Spacing shortcuts */
--spacing-xs: 0.5rem;    /* 8px */
--spacing-sm: 1rem;      /* 16px */
--spacing-md: 1.5rem;    /* 24px */
--spacing-lg: 2rem;      /* 32px */
```

## JERARQUÍA DE BOTONES (4 Niveles)

### **1. CRITICAL** (`--rosa-600`):
- **Uso**: Delete, destructive actions
- **Color**: Rosa 600 + WHITE TEXT
- **Ejemplo**: Botones de eliminar, acciones peligrosas

### **2. PRIMARY** (`--turquesa-600`):
- **Uso**: Main actions, CTA
- **Color**: Turquesa 600 + WHITE TEXT
- **Ejemplo**: "Generar", "Descargar"

### **3. SECONDARY** (`--turquesa-100`):
- **Uso**: Secondary actions
- **Color**: Turquesa 100 + BLACK TEXT
- **Ejemplo**: "Exportar CSV", "Regenerar"

### **4. TERTIARY** (transparent):
- **Uso**: Least important actions
- **Color**: Transparent + GRAY TEXT
- **Ejemplo**: Botones de instrucciones, videos

### **CSS Implementation**:
```css
/* Critical/Primary Buttons (Generate, Download) */
.btn-primary {
  background: var(--turquesa-600);
  color: var(--color-text-inverse);
  font-size: var(--font-size-button);
  padding: var(--spacing-sm) var(--spacing-lg);
}

/* Secondary Actions (Regenerate blocks) */
.btn-secondary {
  background: var(--rosa-600);
  color: var(--color-text-inverse);
  font-size: var(--font-size-button);
}

/* Tertiary Actions (Video/Instructions) */
.btn-tertiary {
  background: #374151;  /* Dark gray */
  color: var(--color-text-inverse);
  font-size: 0.875rem;  /* 14px - Less prominent */
}

/* Method Selection */
.method-btn {
  background: var(--rosa-100);
  border: 2px solid var(--rosa-400);
  color: var(--rosa-700);
}
```

## ⚠️ ANTI-PATRONES - Lo que NO hacer

### **Gradientes y Degradados (EVITAR sistemáticamente)**

Los gradientes son visualmente atractivos pero reducen la jerarquía visual, cansan la vista y compiten por atención cuando se usan indiscriminadamente.

#### ❌ **MAL - No usar gradientes en:**
- **Fondos de páginas, secciones, cards, containers**
- **Botones (incluidos CTAs principales como Generate/Download)**
- **Elementos recurrentes del sistema**
- **Degradados "porque sí" sin propósito claro**

#### ✅ **BIEN - Alternativas profesionales:**

**Para Botones:**
- Colores sólidos (`var(--turquesa-600)`) + bordes
- Two-layer shadows para profundidad
- States con color layering (hover: darker shade)

```css
/* CORRECTO: Botón con profundidad sin gradiente */
.btn-primary {
  background: var(--turquesa-600);
  border: 2px solid var(--turquesa-700);
  box-shadow: var(--shadow-two-layer-md);
  color: white;
}

.btn-primary:hover {
  background: var(--turquesa-700);
  box-shadow: var(--shadow-two-layer-lg);
}
```

**Para Fondos:**
- Color layering (Shade 1→2→3→4) para crear profundidad
- Sombras multicapa entre elementos
- Contraste de color sólido como separador visual

```css
/* CORRECTO: Jerarquía con color layering */
.page-background {
  background: var(--layer-bg-deepest);      /* Shade 1: Más profundo */
}

.card-container {
  background: var(--layer-bg-container);    /* Shade 2: Contenedor */
  box-shadow: var(--shadow-two-layer-md);
}

.interactive-element {
  background: var(--layer-bg-interactive);  /* Shade 3: Interactivo */
}
```

#### 🎯 **Excepción ÚNICA permitida:**
- **Hero sections en landing pages** → SOLO si hay razón de negocio clara y aprobación explícita
- **Nunca en app funcional/dashboard**

#### 📊 **Razón científica:**
Los gradientes en fondos compiten por atención visual constante, reducen la capacidad del usuario para establecer jerarquía y causan fatiga visual en sesiones largas. Color layering + shadows crean profundidad profesional y limpia.

---

### **DIVIDITIS (Abuso de `<div>`) - CRÍTICO** 🚨

**Enfermedad crónica de IA:** Abuso indiscriminado de `<div>` cuando existe HTML semántico que funciona igual de bien para UI y es mejor para SEO/accesibilidad.

#### ❌ **MAL - Dividitis aguda:**
```html
<!-- MAL: Divs genéricos por todas partes -->
<div class="page">
  <div class="top-bar">
    <div class="logo">Logo</div>
    <div class="menu">
      <div class="menu-item">Home</div>
      <div class="menu-item">About</div>
    </div>
  </div>
  <div class="content">
    <div class="article">
      <div class="title">Título</div>
      <div class="text">Contenido...</div>
    </div>
  </div>
  <div class="bottom">© 2025</div>
</div>
```

#### ✅ **BIEN - HTML Semántico:**
```html
<!-- BIEN: HTML5 semántico y accesible -->
<main class="page">
  <header class="top-bar">
    <h1 class="logo">Logo</h1>
    <nav class="menu">
      <a href="/" class="menu-item">Home</a>
      <a href="/about" class="menu-item">About</a>
    </nav>
  </header>

  <section class="content">
    <article class="article">
      <h2 class="title">Título</h2>
      <p class="text">Contenido...</p>
    </article>
  </section>

  <footer class="bottom">© 2025</footer>
</main>
```

#### 📋 **Elementos Semánticos a Usar:**

| En vez de `<div>` | Usa HTML Semántico | Cuándo usarlo |
|-------------------|-------------------|---------------|
| `<div class="header">` | `<header>` | Encabezado de página/sección |
| `<div class="nav">` | `<nav>` | Navegación principal |
| `<div class="main">` | `<main>` | Contenido principal |
| `<div class="section">` | `<section>` | Sección temática de contenido |
| `<div class="article">` | `<article>` | Contenido independiente/reutilizable |
| `<div class="aside">` | `<aside>` | Contenido relacionado/lateral |
| `<div class="footer">` | `<footer>` | Pie de página/sección |
| `<div class="button">` | `<button>` | Elementos interactivos/acciones |
| `<div class="list">` | `<ul>`/`<ol>` | Listas de items |
| `<div class="table">` | `<table>` | Datos tabulares |

#### 🎯 **Cuándo SÍ usar `<div>`:**
- **Layout containers** sin significado semántico (flex/grid wrappers)
- **Styling hooks** donde no hay elemento semántico apropiado
- **JS manipulation** cuando necesitas un elemento neutro

```html
<!-- Uso legítimo de div: layout wrapper sin significado -->
<article>
  <h2>Título del artículo</h2>
  <div class="flex-container">  <!-- Solo para layout flexbox -->
    <p>Contenido...</p>
    <aside>Sidebar</aside>
  </div>
</article>
```

#### ✅ **Beneficios del HTML Semántico:**
1. **SEO mejorado** - Los motores de búsqueda entienden la estructura
2. **Accesibilidad** - Lectores de pantalla navegan correctamente
3. **Mantenibilidad** - El código es auto-documentado
4. **Menos CSS** - Los elementos semánticos ya tienen roles
5. **Standards compliance** - HTML5 válido

#### 🚨 **Regla de Oro:**
**"Pregúntate: ¿Este elemento tiene un significado? → Usa HTML semántico. ¿Solo es para layout/estilo? → Usa `<div>`"**

---

### **BORDER-LEFT ADDICTION (Abuso de Bordes Decorativos)** 🚨

**Síntoma de IA:** Uso indiscriminado de `border-left` + icono decorativo en todos los callouts/ejemplos por inercia visual.

#### ❌ **MAL - Border left everywhere:**
```html
<!-- MAL: TODO tiene border left, nada destaca -->
<div class="example" style="border-left: 4px solid var(--turquesa-600);">
  💡 Ejemplo normal
</div>

<div class="note" style="border-left: 4px solid var(--rosa-600);">
  ⚠️ Nota normal
</div>

<div class="tip" style="border-left: 4px solid var(--tulip-tree-500);">
  🔥 Tip normal
</div>
```

**Problema:** Cuando todo tiene énfasis visual, nada tiene énfasis real.

#### ✅ **BIEN - Uso estratégico:**

**Usar border-left SOLO para alertas del sistema:**
1. **⚠️ Advertencias críticas** → Información que el usuario DEBE ver (errores, problemas)
2. **🔴 Errores/Peligros** → Acciones destructivas, pérdida de datos
3. **ℹ️ Información importante** → Cambios del sistema, actualizaciones relevantes
4. **✅ Confirmaciones críticas** → Acciones completadas que requieren conocimiento

**NO usar para:**
- ❌ Ejemplos de código (usar background suave)
- ❌ Tips generales (usar solo texto o background)
- ❌ Notas informativas (usar background color)
- ❌ Bloques decorativos (innecesario)

```html
<!-- BIEN: Border left solo para elementos críticos -->

<!-- Sin border: Ejemplo regular -->
<div class="example">
  <code>const data = fetchData();</code>
</div>

<!-- CON border: Advertencia crítica -->
<div class="warning" style="border-left: 4px solid var(--rosa-600); padding-left: 1rem;">
  ⚠️ CRÍTICO: Esta operación elimina datos permanentemente
</div>

<!-- Sin border: Nota informativa -->
<div class="note">
  ℹ️ Puedes usar async/await para mejor legibilidad
</div>
```

#### 🎯 **Alternativas sin border:**

**Para destacar SIN border-left:**
- **Background color suave**: `background: var(--gris-100)` + padding
- **Box shadow**: `box-shadow: var(--shadow-two-layer-sm)`
- **Typography**: Font weight bold para títulos
- **Spacing**: Más padding/margin para separar visualmente

```css
/* Ejemplo destacado sin border */
.example {
  background: var(--gris-100);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-two-layer-sm);
}

/* Nota informativa sin border */
.note {
  background: var(--turquesa-100);
  padding: var(--space-3);
  border-radius: var(--radius-base);
}
```

#### 📊 **Regla de Jerarquía:**
- **Nivel 1 (Crítico)**: Border-left + color fuerte + icono
- **Nivel 2 (Importante)**: Background color + shadow
- **Nivel 3 (Informativo)**: Background color suave
- **Nivel 4 (Normal)**: Texto plain sin decoración

#### 🚨 **Regla de Oro:**
**"Máximo 1-2 elementos con border-left por página. Si TODO es importante, NADA es importante."**

---

## PATRONES DE LAYOUT

### **Two-column Block Layout**:
```css
.strength-blocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-lg);
  margin: var(--spacing-lg) 0;
}
```

### **Exercise Items con Turquesa Borders**:
```css
.exercise-item {
  border-left: 4px solid var(--turquesa-600);
  padding: var(--spacing-md);
  background: white;
  margin-bottom: var(--spacing-sm);
}
```

### **Section Backgrounds with Palette Colors**:
```css
.specifications-section {
  background: linear-gradient(135deg, var(--rosa-100) 0%, #fff 100%);
}

.equipment-section {
  background: linear-gradient(135deg, var(--turquesa-100) 0%, #fff 100%);
}

.day-header {
  background: linear-gradient(135deg, var(--turquesa-600) 0%, var(--turquesa-700) 100%);
}
```

## INDICADORES VISUALES

### **Tag Styling - Reduced Prominence**:
```css
.category-tag, .equipment-tag, .level-tag {
  background: var(--color-background-neutral);
  color: var(--color-text-muted);
  font-size: var(--font-size-tag);
  padding: 0.25rem 0.5rem;
}
```

### **Special Tags with Palette Colors**:
```css
.metabolic-tag {
  background: var(--rosa-600);
  color: var(--color-text-inverse);
}

.unipodal-tag {
  background: var(--turquesa-600);
  color: var(--color-text-inverse);
}
```

### **Visual Indicators Standards**:
- **⭐ Favorites**: Estrella para ejercicios favoritos
- **🔥 METABÓLICO**: Tag en rosa para ejercicios metabólicos
- **👤 UNIPODAL**: Tag en turquesa para ejercicios unipodales
- **Tags**: Prominencia reducida para no distraer del contenido principal

## GUÍAS DE USO POR CONTEXTO

- **Navigation Menu**: Turquesa 600 background + white text
- **Success Messages**: Success green (#059669) + white text
- **Warning Alerts**: Tulip Tree 500 + white text
- **Error States**: Rosa 600 + white text
- **Form Inputs Focus**: Turquesa 600 border + shadow
- **Hover States**: Darken by one step (600→700, 400→600)
- **Active States**: Turquesa 400 background + black text

## RESPONSIVE DESIGN STANDARDS

### **Mobile Responsive Adjustments**:
```css
@media (max-width: 768px) {
  /* Reduced spacing for mobile */
  --space-1: 6px; --space-2: 12px; --space-3: 18px;
  /* Smaller typography */
  --font-size-3xl: 1.875rem; --font-size-xl: 1.25rem;
  --font-size-button: 1rem; /* 16px en móvil */
}
```

### **Container Behavior**:
- **Desktop**: Centered with auto-margin, max-width constraints
- **Mobile**: 8px margins, full-width with padding

### **Navigation Responsive**:
- **Desktop**: Full text + icons
- **Mobile (<768px)**: Icons only
- **Mobile (<480px)**: Compact layout with minimal padding

### **Button Responsive**:
- **Touch-friendly**: Minimum 44px height for touch targets
- **Flexible layouts**: `w-full sm:w-auto` patterns
- **Proper spacing**: Adequate padding for thumb interaction

## SISTEMA DE NAVEGACIÓN

### **Sticky Menu Architecture**:
```css
.generators-menu {
  background: linear-gradient(135deg, var(--turquesa-600) 0%, var(--turquesa-700) 100%);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  position: sticky;
  top: 0;
  z-index: 1000;
}
```

### **Menu Container**:
- **Max-width**: 1400px centered
- **Flex layout**: Space-between alignment
- **Responsive**: Column layout on mobile
- **User integration**: Email display + logout button

### **Menu Items**:
- **Desktop**: Full text with icons
- **Mobile**: Icon-only with tooltips
- **Active states**: Visual indication of current page
- **Hover effects**: Color transitions and scale transforms

## COMPONENTES ESTÁNDAR

### **Footer Signature**:
```tsx
<div className="signature">
  <img src="/swg-logo-transp.webp" alt="System WOD Generator Logo" />
  <div className="signature-text">    
    <p>System WOD Generator by © Movimiento Funcional</p>
    <a href="https://wod.movimientofuncional.com">wod.movimientofuncional.app</a>
  </div>
</div>
```

### **Professional Branding**:
- **Logo**: `swg-logo-transp.webp` (WebP optimized)
- **Colors**: Generator-specific gradients with orange signatures
- **Copyright**: "© Movimiento Funcional - Todos los derechos reservados"

## ARQUITECTURA CSS VARIABLES

### **Complete Variable Set**:
```css
:root {
  /* Color System */
  --turquesa-100: #cdfffb; --turquesa-400: #18f8f6;
  --turquesa-600: #00bec8; --turquesa-700: #088b96;
  --rosa-100: #ffe4ea; --rosa-400: #fb718f;
  --rosa-600: #e11d48; --rosa-700: #be1238;
  --tulip-tree-50: #fef9e8; --tulip-tree-200: #fee28a;
  --tulip-tree-300: #fdd147; --tulip-tree-500: #eab308;

  /* Typography */
  --font-family-heading: 'Righteous', sans-serif;
  --font-family-body: 'ABeeZee', sans-serif;
  --font-size-button: 1.3125rem;
  --font-size-tag: 1.0625rem;

  /* Spacing */
  --spacing-xs: 0.5rem; --spacing-sm: 1rem;
  --spacing-md: 1.5rem; --spacing-lg: 2rem;

  /* Semantic Colors */
  --color-text-primary: #1f2937;
  --color-text-inverse: white;
  --color-text-muted: #6b7280;
  --color-background-neutral: #f3f4f6;
}
```

## IMPLEMENTACIÓN EN COMPONENTES

### **Button State Management**:
```tsx
disabled={(!workout && workouts.length === 0)}
style={{
  background: disabled ? 'var(--color-text-muted)' : 'linear-gradient(145deg, var(--turquesa-600), var(--turquesa-700))',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1
}}
```

### **Exercise Display with Visual Indicators**:
```tsx
{exercise.favoritos && <span title="Ejercicio favorito">⭐</span>}
{exercise.isMetabolic && <span className="metabolic-tag">🔥 METABÓLICO</span>}
{exercise.isUnipodal && <span className="unipodal-tag">👤 UNIPODAL</span>}
```

### **Method Selection Buttons**:
```tsx
<button
  className="method-btn"
  style={{
    background: selectedMethods.includes(method) ? 'var(--rosa-400)' : 'var(--rosa-100)',
    border: '2px solid var(--rosa-400)',
    color: 'var(--rosa-700)'
  }}
>
  {method}
</button>
```

## ESTÁNDARES DE CALIDAD

### **Accessibility Standards**:
- **Text contrast**: WCAG AA compliance
- **Touch targets**: Minimum 44px for mobile
- **Focus indicators**: Visible focus states
- **Screen reader**: Proper aria labels

### **Performance Standards**:
- **CSS Variables**: Efficient styling updates
- **WebP Images**: Optimized logo formats
- **Minimal CSS**: No unused style declarations
- **Mobile-first**: Progressive enhancement approach

### **Consistency Standards**:
- **8px base grid**: All spacing multiples of 8px
- **Color palette**: Only predefined color variables
- **Typography**: Consistent font stacks and sizes
- **Component patterns**: Reusable design components

---

## 🌑 TWO-LAYER SHADOW SYSTEM

Sistema profesional de sombras que crea profundidad realista mediante la combinación de una capa de luz superior (glow) y una sombra oscura inferior.

### **Concepto Base**
Cada sombra tiene **dos capas**:
1. **Top layer**: Borde/glow claro (`inset 0 Xpx 0 rgba(255,255,255,0.1-0.3)`)
2. **Bottom layer**: Sombra oscura (`0 Xpx Xpx rgba(0,0,0,0.1-0.2)`)

### **Niveles de Profundidad**

#### **Small Shadow (Subtle depth)**
```css
/* Uso: Elementos sutiles, nav items, tabs, small cards */
box-shadow: var(--shadow-two-layer-sm);
/* Equivale a:
  inset 0 1px 0 rgba(255, 255, 255, 0.1),
  0 1px 2px rgba(0, 0, 0, 0.1); */
```

#### **Medium Shadow (Standard depth)**
```css
/* Uso: Cards, dropdowns, modals, componentes estándar */
box-shadow: var(--shadow-two-layer-md);
/* Equivale a:
  inset 0 1px 0 rgba(255, 255, 255, 0.15),
  0 3px 6px rgba(0, 0, 0, 0.15); */
```

#### **Large Shadow (Prominent depth)**
```css
/* Uso: Hover states, focused elements, important modals */
box-shadow: var(--shadow-two-layer-lg);
/* Equivale a:
  inset 0 2px 0 rgba(255, 255, 255, 0.2),
  0 6px 12px rgba(0, 0, 0, 0.2); */
```

### **Estados Interactivos**

```css
/* Hover state */
.button:hover {
  box-shadow: var(--shadow-hover);
}

/* Focus state (incluye ring de turquesa) */
.button:focus {
  box-shadow: var(--shadow-focus);
}
```

### **Guía de Selección**
- **Profile cards** → Small shadow (natural feel)
- **Dashboard cards** → Medium shadow (default)
- **Hover states** → Large shadow (feedback interactivo)
- **Mejor en light mode**, adaptar para dark mode

---

## 🎨 COLOR LAYERING & DEPTH SYSTEM

Sistema de jerarquía visual mediante 4 niveles de shades de color, creando profundidad sin usar gradientes.

### **Concepto: Sistema de 4 Shades**

Cada elemento tiene un nivel de profundidad visual basado en su shade:

1. **Shade 1 (Deepest)** → Page/section backgrounds
2. **Shade 2 (Container)** → Cards, containers, wrappers
3. **Shade 3 (Interactive)** → Buttons, tabs, inputs
4. **Shade 4 (Active)** → Selected/hover/active states

**Regla visual:** Más claro = más cerca del usuario. Más oscuro = más profundo/alejado.

### **Implementación con Variables CSS**

```css
/* Shade 1: Más profundo (page backgrounds) */
.page-background {
  background: var(--layer-bg-deepest);
  color: var(--layer-text-on-deepest);
}

/* Shade 2: Contenedor (cards, containers) */
.card {
  background: var(--layer-bg-container);
  color: var(--layer-text-on-container);
  box-shadow: var(--shadow-two-layer-md);
}

/* Shade 3: Interactivo (buttons, tabs) */
.button {
  background: var(--layer-bg-interactive);
  color: var(--layer-text-on-interactive);
}

/* Shade 4: Activo (selected, hover states) */
.button:hover,
.tab-selected {
  background: var(--layer-bg-active);
  color: var(--layer-text-on-active);
}
```

### **Text & Icon Compensation Rules** ⚡

**Regla crítica:** Cuando aumentas lightness de fondo → aumenta lightness de texto/iconos proporcionalmente.

```css
/* MAL: Texto muy oscuro en fondo muy claro (bajo contraste) */
.element {
  background: var(--gris-300);  /* Claro */
  color: var(--gris-900);        /* Muy oscuro → Contraste excesivo */
}

/* BIEN: Text compensation aplicado */
.element {
  background: var(--gris-300);  /* Claro */
  color: var(--gris-600);        /* Medium → Contraste óptimo */
}
```

### **Border Removal Strategy** 📐

- **Quitar bordes** en elementos Shade 3 o 4 (el contraste de color crea la separación)
- **Mantener bordes** solo en Shade 1 o 2 si absolutamente necesario

```css
/* El color layering crea separación natural */
.card {
  background: var(--layer-bg-container);
  border: none;  /* No necesario, el contraste separa */
  box-shadow: var(--shadow-two-layer-md);
}
```

### **Element-Specific Guidelines** 🧩

#### **Tabs:**
```css
.tabs-container {
  background: var(--layer-bg-container);  /* Shade 2 */
}

.tab {
  background: transparent;
}

.tab-selected {
  background: var(--layer-bg-interactive);  /* Shade 3 */
  color: var(--layer-text-on-interactive);
  box-shadow: var(--shadow-two-layer-sm);
}
```

#### **Cards:**
```css
.card-wrapper {
  background: var(--layer-bg-container);  /* Shade 2 */
  box-shadow: var(--shadow-two-layer-md);
}

.card-content-important {
  background: var(--layer-bg-interactive);  /* Shade 3 para énfasis */
}
```

#### **Dropdowns/Buttons:**
```css
.dropdown {
  background: var(--layer-bg-container);  /* Shade 2 default */
}

.dropdown-item-highlighted {
  background: var(--layer-bg-interactive);  /* Shade 3 importante */
}
```

#### **Navigation:**
```css
.nav {
  background: var(--layer-bg-container);  /* Shade 2 */
}

.nav-item {
  background: var(--layer-bg-interactive);  /* Shade 3 */
}

/* Múltiples capas crean efecto de profundidad */
```

#### **Tables (de-enfatizar):**
```css
.table {
  background: var(--layer-bg-deepest);  /* Shade 1 para empujar al fondo */
}
```

### **Emphasis Control**
- **Enfatizar**: Usa shades más claros (Shade 3 o 4) → "Pop" hacia el usuario
- **De-enfatizar**: Usa shades más oscuros (Shade 1 o 2) → Recede al fondo

---

## 📊 REGLA 60-30-10 (Proporción de Color)

Sistema de proporción visual para mantener balance y jerarquía clara en layouts.

### **Distribución de Colores:**

- **60% Dominante** → Neutrals (grises 50-200)
  - Page backgrounds, containers, cards
  - Mayoría del espacio visual

- **30% Secundario** → Supporting colors (tulip-tree, rosa 100)
  - Secciones destacadas, iconos, elementos de soporte
  - Variedad visual sin competir

- **10% Acento** → Primary color (turquesa 600)
  - CTAs, botones principales, elementos críticos
  - Máxima prominencia por usar menos espacio

### **Aplicación Práctica:**

```css
/* 60% - Neutrals en backgrounds y containers */
.page { background: var(--gris-50); }
.card { background: var(--gris-100); }

/* 30% - Secondary en headers, sections destacadas */
.section-header { background: var(--tulip-tree-50); }
.highlight-box { border-left: 4px solid var(--rosa-400); }

/* 10% - Primary en CTAs y elementos críticos */
.btn-generate { background: var(--turquesa-600); }
.active-indicator { color: var(--turquesa-600); }
```

### **Beneficios:**
- Jerarquía visual clara e inmediata
- Reduce competencia por atención
- Balance profesional sin saturación
- Guía el ojo del usuario naturalmente

---

## APLICACIÓN EN GENERADORES

### **Required Implementation for All Generators**:
1. **Complete CSS variable architecture**
2. **Button hierarchy compliance** (Primary: Turquesa, Secondary: Rosa, Tertiary: Dark gray)
3. **Layout pattern standards** (Two-column blocks, palette backgrounds)
4. **Typography consistency** (21px buttons desktop, 17px tags)
5. **Visual indicator styling** (Reduced tag prominence, color-coded tags)
6. **Mobile-responsive layout** with 8px spacing system
7. **Professional signature** with logo and branding
8. **Navigation menu integration** with authentication
9. **Loading states** and button state management
10. **Accessibility compliance** and touch-friendly design

### **Design System Status**: ✅ **COMPLETED** in Funcional generator (reference implementation)

Este sistema de diseño garantiza consistencia visual, accesibilidad y experiencia de usuario profesional across todos los generadores del proyecto.