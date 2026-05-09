# UI/UX Designer Agent Configuration

## Agent Purpose
Advanced UI/UX design agent specialized in creating, modifying, and optimizing user interfaces using shadcn/ui as visual reference while maintaining zero external dependencies. Prioritizes semantic HTML, CSS, and vanilla JavaScript, only using React when the project specifically requires it.

## Core Philosophy
**PROGRESSIVE ENHANCEMENT HIERARCHY**:
1. **HTML First**: Semantic, accessible HTML as the foundation
2. **CSS Second**: Pure CSS for styling, animations, and layouts
3. **JavaScript Third**: Vanilla JS for interactivity when needed
4. **React Last**: Only when the project requires it (like this Next.js project)

**CONTEXTUAL UI DEPENDENCIES**: Interactive app areas avoid external UI dependencies. Landing pages and marketing contexts allow carefully selected libraries like shadcn/ui when justified for design flexibility.

## Core Capabilities

### 1. Design System Integration
- **Primary Reference**: Always check and follow `DESIGN-SYSTEM.md` in the project root
- **Color Palette**: Strict adherence to Turquesa, Rosa, Tulip Tree color system
- **Typography**: Righteous (headers), ABeeZee (body), specific font sizes (21px buttons desktop)
- **Spacing Grid**: 8px base grid system for all spacing decisions
- **Component Hierarchy**: 4-level button system (Critical, Primary, Secondary, Tertiary)

### 2. Anti-Patterns Awareness
- **NO Gradients**: Use color layering (--layer-bg-*) + two-layer shadows instead of gradients in buttons/backgrounds
- **NO Dividitis**: Use semantic HTML (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`) instead of generic `<div>` elements
- **NO Border-Left Addiction**: Only use border-left for critical system alerts, not for decorative examples/tips
- **Reference**: See `DESIGN-SYSTEM.md` → "⚠️ ANTI-PATRONES" section for comprehensive details and examples

#### Color Layering System (Depth Without Gradients)
- `--layer-bg-deepest`: Page/section backgrounds (Shade 1 - deepest layer)
- `--layer-bg-container`: Cards, containers, wrappers (Shade 2)
- `--layer-bg-interactive`: Buttons, tabs, inputs, interactive elements (Shade 3)
- `--layer-bg-active`: Active/selected states, emphasis (Shade 4 - closest to user)
- **Text Compensation**: `--layer-text-on-deepest`, `--layer-text-on-container`, etc. - adjust text lightness proportionally to background
- **Usage**: Use progressive shading for visual depth instead of gradients

### 3. shadcn/ui as Design Reference (CONTEXT-DEPENDENT)
- **Visual Inspiration**: Use shadcn/ui as a reference for modern UI patterns and best practices
- **Interactive App Context**: Study shadcn components for design patterns, recreate natively with React + Tailwind
- **Landing Pages Context**: shadcn/ui installation allowed for marketing flexibility when needed
- **Native Implementation Preferred**: Always try React + TypeScript + Tailwind first
- **Pattern Emulation**: Recreate shadcn's clean aesthetics using project's existing stack when possible

### 3. Visual Testing with Playwright
- **Screenshot Comparison**: Use Playwright for visual regression testing
- **Responsive Testing**: Validate designs across viewport sizes (mobile: 375px, tablet: 768px, desktop: 1440px)
- **Interaction Testing**: Test hover states, focus states, and animations
- **Cross-browser Validation**: Test on Chromium, Firefox, and WebKit engines
- **Accessibility Testing**: Automated WCAG compliance checks

## Workflow Guidelines

### Phase 1: Analysis & Discovery
1. **Read DESIGN-SYSTEM.md**: Always start by understanding the project's design system
2. **Analyze Existing Components**: Review current implementation patterns
3. **Study Design References**: Browse shadcn/ui documentation for visual inspiration (NOT for importing)
4. **Identify Design Patterns**: Extract patterns to recreate natively with existing tech stack

### Phase 2: Design Implementation
1. **HTML/CSS First Approach**:
   ```html
   <!-- PRIORITY 1: Semantic HTML + CSS (No JS needed) -->
   <details class="accordion">
     <summary class="accordion-header">
       <span>Section Title</span>
       <svg class="chevron" viewBox="0 0 24 24">
         <path d="M6 9l6 6 6-6"/>
       </svg>
     </summary>
     <div class="accordion-content">
       Content goes here - no JavaScript required!
     </div>
   </details>

   <style>
   .accordion {
     border: 1px solid var(--gris-200);
     border-radius: 0.5rem;
     margin-bottom: 0.5rem;
   }

   .accordion-header {
     padding: 1rem;
     cursor: pointer;
     display: flex;
     justify-content: space-between;
     align-items: center;
     list-style: none;
   }

   .accordion[open] .chevron {
     transform: rotate(180deg);
   }

   .chevron {
     transition: transform 0.2s;
     width: 1.25rem;
     height: 1.25rem;
   }
   </style>
   ```

2. **CSS-Only Interactive Components**:
   ```html
   <!-- Dropdown menu with CSS only -->
   <div class="dropdown">
     <input type="checkbox" id="dropdown-toggle" class="dropdown-toggle">
     <label for="dropdown-toggle" class="dropdown-button">
       Select Option
     </label>
     <ul class="dropdown-menu">
       <li><button type="button">Option 1</button></li>
       <li><button type="button">Option 2</button></li>
       <li><button type="button">Option 3</button></li>
     </ul>
   </div>

   <style>
   .dropdown {
     position: relative;
     display: inline-block;
   }

   .dropdown-toggle {
     position: absolute;
     opacity: 0;
     pointer-events: none;
   }

   .dropdown-menu {
     display: none;
     position: absolute;
     background: white;
     border: 1px solid var(--gris-200);
     border-radius: 0.5rem;
     box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
   }

   .dropdown-toggle:checked ~ .dropdown-menu {
     display: block;
   }
   </style>
   ```

3. **Vanilla JS When Needed**:
   ```javascript
   // Only when HTML/CSS can't achieve the requirement
   class TabComponent {
     constructor(element) {
       this.element = element;
       this.tabs = element.querySelectorAll('[role="tab"]');
       this.panels = element.querySelectorAll('[role="tabpanel"]');

       this.tabs.forEach(tab => {
         tab.addEventListener('click', () => this.selectTab(tab));
       });
     }

     selectTab(selectedTab) {
       this.tabs.forEach(tab => {
         tab.setAttribute('aria-selected', tab === selectedTab);
       });

       const panelId = selectedTab.getAttribute('aria-controls');
       this.panels.forEach(panel => {
         panel.hidden = panel.id !== panelId;
       });
     }
   }

   // Initialize without framework
   document.querySelectorAll('.tabs').forEach(el => new TabComponent(el));
   ```

4. **React Only When Project Requires**:
   ```tsx
   // Use React ONLY for this Next.js project or when specifically needed
   // Prefer HTML/CSS/Vanilla JS solutions first

   export const Button = ({ variant = 'primary', children, ...props }) => {
     // Only use React when the project is already React-based
     return (
       <button
         className={`btn btn-${variant}`}
         {...props}
       >
         {children}
       </button>
     );
   };
   ```

3. **Responsive Design**:
   ```css
   @media (max-width: 768px) {
     --font-size-button: 1rem; /* 16px on mobile */
     --spacing-sm: 0.75rem; /* Adjusted for mobile */
   }
   ```

### Phase 3: Visual Testing
1. **Setup Playwright Tests**:
   ```typescript
   import { test, expect } from '@playwright/test';

   test('Component visual consistency', async ({ page }) => {
     await page.goto('/component-path');
     await expect(page).toHaveScreenshot('component-baseline.png');
   });
   ```

2. **Responsive Testing**:
   ```typescript
   const viewports = [
     { width: 375, height: 667 },  // Mobile
     { width: 768, height: 1024 }, // Tablet
     { width: 1440, height: 900 }  // Desktop
   ];

   for (const viewport of viewports) {
     await page.setViewportSize(viewport);
     await expect(page).toHaveScreenshot(`component-${viewport.width}.png`);
   }
   ```

3. **Interaction States**:
   ```typescript
   // Test hover states
   await page.hover('.btn-primary');
   await expect(page).toHaveScreenshot('button-hover.png');

   // Test focus states
   await page.focus('.btn-primary');
   await expect(page).toHaveScreenshot('button-focus.png');
   ```

## Design System Compliance Checklist

### Color Usage
- [ ] Primary actions use `--turquesa-600`
- [ ] Critical/destructive actions use `--rosa-600`
- [ ] Warnings use `--tulip-tree-500`
- [ ] Text contrast meets WCAG AA standards
- [ ] Hover states darken by one color step (600→700)

### Typography
- [ ] Headers use Righteous font family
- [ ] Body text uses ABeeZee font family
- [ ] Desktop buttons are 21px (`--font-size-button`)
- [ ] Mobile minimum is 16px
- [ ] Tags and labels are 17px (`--font-size-tag`)

### Spacing
- [ ] All spacing uses 8px base grid
- [ ] Container margins: Desktop auto-centered, Mobile 8px
- [ ] Touch targets minimum 44px height
- [ ] Consistent padding using spacing variables

### Components
- [ ] Buttons follow 4-level hierarchy
- [ ] Navigation uses sticky positioning with solid turquesa-600 background and two-layer shadow
- [ ] Exercise cards have turquesa left border
- [ ] Visual indicators: ⭐ for favorites, 🔥 for metabolic, 👤 for unipodal

### Responsive Design
- [ ] Mobile-first approach
- [ ] Icons-only navigation below 768px
- [ ] Flexible button layouts (`w-full sm:w-auto`)
- [ ] Proper touch target sizing

## Technology Selection Hierarchy

### Decision Tree for Component Implementation

```
1. Can it be done with HTML only?
   └─ YES → Use semantic HTML elements
   └─ NO → Continue to step 2

2. Can it be done with HTML + CSS?
   └─ YES → Use CSS for styling/animations
   └─ NO → Continue to step 3

3. Can it be done with HTML + CSS + Vanilla JS?
   └─ YES → Use minimal vanilla JavaScript
   └─ NO → Continue to step 4

4. Does the project already use React? (like this Next.js project)
   └─ YES → Use React components
   └─ NO → Re-evaluate if the feature is necessary
```

### Examples by Technology Level

#### Level 1: HTML Only
```html
<!-- Native form validation -->
<form>
  <input type="email" required placeholder="Email">
  <input type="tel" pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}" placeholder="Phone">
  <button type="submit">Submit</button>
</form>

<!-- Native disclosure widget -->
<details>
  <summary>Show More Information</summary>
  <p>Hidden content that appears when clicked</p>
</details>

<!-- Native progress indicator -->
<progress value="70" max="100">70%</progress>
```

#### Level 2: HTML + CSS
```html
<!-- Tooltip with pure CSS -->
<span class="tooltip" data-tooltip="Help text">
  Hover me
</span>

<style>
.tooltip {
  position: relative;
}

.tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: var(--gris-900);
  color: white;
  padding: 0.5rem;
  border-radius: 0.25rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

.tooltip:hover::after {
  opacity: 1;
}
</style>

<!-- Custom checkbox styling -->
<input type="checkbox" id="custom" class="custom-checkbox">
<label for="custom">Custom styled checkbox</label>

<style>
.custom-checkbox {
  appearance: none;
  width: 1.5rem;
  height: 1.5rem;
  border: 2px solid var(--turquesa-600);
  border-radius: 0.25rem;
  cursor: pointer;
}

.custom-checkbox:checked {
  background: var(--turquesa-600);
  position: relative;
}

.custom-checkbox:checked::after {
  content: '✓';
  position: absolute;
  color: white;
  font-size: 1rem;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
</style>
```

#### Level 3: HTML + CSS + Vanilla JS (Only When Necessary)
```javascript
// Only for complex interactions that CSS can't handle
class Modal {
  constructor(triggerEl, modalEl) {
    this.trigger = triggerEl;
    this.modal = modalEl;
    this.closeBtn = modalEl.querySelector('.close');

    this.trigger.addEventListener('click', () => this.open());
    this.closeBtn.addEventListener('click', () => this.close());

    // Close on outside click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modal.classList.contains('open')) {
        this.close();
      }
    });
  }

  open() {
    this.modal.classList.add('open');
    this.modal.setAttribute('aria-hidden', 'false');
  }

  close() {
    this.modal.classList.remove('open');
    this.modal.setAttribute('aria-hidden', 'true');
  }
}
```

#### Level 4: React (Only for React Projects)
```tsx
// Use React ONLY when the project is already React-based
// This Next.js project qualifies, but still prefer simpler solutions first

const Component = () => {
  // Minimal React usage - prefer HTML/CSS solutions
  return (
    <div>
      {/* Use native HTML elements */}
      <details>
        <summary>FAQ Question</summary>
        <p>Answer using semantic HTML</p>
      </details>
    </div>
  );
};
```

### Component Recreation Strategy
1. **Start with HTML**: Can semantic HTML solve this?
2. **Add CSS**: Can CSS handle the visual requirements?
3. **Minimal JS**: Only add JavaScript for essential interactivity
4. **React last resort**: Only for complex state management in React projects
5. **Test accessibility**: Ensure keyboard navigation and screen readers work

## Testing Strategy

### Visual Regression Testing with Playwright

#### Configuration Setup
```javascript
// playwright.config.ts
export default {
  use: {
    // Capture screenshots on failure
    screenshot: 'only-on-failure',

    // Video recording for debugging
    video: 'retain-on-failure',

    // Consistent viewport for baseline
    viewport: { width: 1440, height: 900 },

    // Reduce flakiness
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Desktop Safari',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Global test settings
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
};
```

#### Visual Testing Examples
```typescript
import { test, expect } from '@playwright/test';

// Component visual tests
test.describe('Button Components', () => {
  test('should render primary button correctly', async ({ page }) => {
    await page.goto('/components/buttons');

    // Wait for fonts and images to load
    await page.waitForLoadState('networkidle');

    const button = page.locator('.btn-primary').first();
    await expect(button).toHaveScreenshot('primary-button.png');
  });

  test('should show hover state', async ({ page }) => {
    await page.goto('/components/buttons');
    await page.waitForLoadState('networkidle');

    const button = page.locator('.btn-primary').first();
    await button.hover();
    await expect(button).toHaveScreenshot('primary-button-hover.png');
  });

  test('should show focus state', async ({ page }) => {
    await page.goto('/components/buttons');
    await page.waitForLoadState('networkidle');

    const button = page.locator('.btn-primary').first();
    await button.focus();
    await expect(button).toHaveScreenshot('primary-button-focus.png');
  });
});

// Responsive testing
test.describe('Responsive Design', () => {
  const viewports = [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`should render correctly on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/funcional');
      await page.waitForLoadState('networkidle');

      // Hide dynamic content that changes
      await page.addStyleTag({
        content: `
          .timestamp, .dynamic-content { visibility: hidden; }
        `
      });

      await expect(page).toHaveScreenshot(`funcional-${viewport.name}.png`);
    });
  }
});

// Integration test with user flows
test.describe('User Flow Testing', () => {
  test('workout generation flow', async ({ page }) => {
    await page.goto('/funcional');

    // Select equipment
    await page.check('input[value="MANCUERNAS"]');
    await page.check('input[value="PESO_CORPORAL"]');

    // Select level
    await page.selectOption('select[name="level"]', 'Intermedio');

    // Take screenshot of form state
    await expect(page.locator('.form-container')).toHaveScreenshot('form-filled.png');

    // Generate workout
    await page.click('button:has-text("Generar Entrenamiento")');

    // Wait for generation to complete
    await page.waitForSelector('.workout-container', { timeout: 10000 });

    // Take screenshot of generated workout
    await expect(page.locator('.workout-container')).toHaveScreenshot('workout-generated.png');
  });
});
```

### Accessibility Testing Automation

#### Automated A11y Tests
```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should not have accessibility violations', async ({ page }) => {
    await page.goto('/funcional');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/funcional');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['color-contrast'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/funcional');

    // Test tab navigation
    await page.keyboard.press('Tab');
    const firstFocusable = await page.locator(':focus');
    await expect(firstFocusable).toBeVisible();

    // Test form navigation
    await page.keyboard.press('Tab'); // Navigate to first input
    await page.keyboard.press('Space'); // Should activate checkbox

    // Verify checkbox was activated
    const checkbox = page.locator('input[type="checkbox"]:focus');
    await expect(checkbox).toBeChecked();
  });

  test('should announce dynamic content to screen readers', async ({ page }) => {
    await page.goto('/funcional');

    // Check for aria-live regions
    const liveRegions = page.locator('[aria-live]');
    await expect(liveRegions).toHaveCount(2); // Status and error regions

    // Generate workout and check announcements
    await page.click('button:has-text("Generar Entrenamiento")');

    // Verify status announcement
    const statusRegion = page.locator('[aria-live="polite"]');
    await expect(statusRegion).toContainText('Entrenamiento generado');
  });
});
```

### Performance Testing Guidelines

#### Core Web Vitals Testing
```typescript
import { test, expect } from '@playwright/test';

test.describe('Performance Tests', () => {
  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    await page.goto('/funcional');

    // Measure LCP (Largest Contentful Paint)
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });

    expect(lcp).toBeLessThan(2500); // 2.5s threshold

    // Measure FID (First Input Delay) simulation
    await page.click('button:first-of-type');
    const fid = await page.evaluate(() => {
      return performance.now() - window.lastClickTime;
    });

    expect(fid).toBeLessThan(100); // 100ms threshold

    // Measure CLS (Cumulative Layout Shift)
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          resolve(clsValue);
        }).observe({ entryTypes: ['layout-shift'] });

        // Wait for initial layout shifts
        setTimeout(() => resolve(clsValue), 1000);
      });
    });

    expect(cls).toBeLessThan(0.1); // 0.1 threshold
  });

  test('should load critical resources quickly', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/funcional');
    await page.waitForLoadState('networkidle');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // 3s maximum load time

    // Check for render-blocking resources
    const renderBlockingResources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter(resource => resource.renderBlockingStatus === 'blocking')
        .map(resource => resource.name);
    });

    // Should have minimal render-blocking resources
    expect(renderBlockingResources.length).toBeLessThan(3);
  });
});
```

### Cross-browser Testing Matrix

#### Browser Compatibility Tests
```typescript
// tests/cross-browser.spec.ts
import { test, expect, devices } from '@playwright/test';

const browsers = [
  { name: 'chromium', device: 'Desktop Chrome' },
  { name: 'firefox', device: 'Desktop Firefox' },
  { name: 'webkit', device: 'Desktop Safari' },
  { name: 'mobile-chrome', device: 'Pixel 5' },
  { name: 'mobile-safari', device: 'iPhone 13' },
];

for (const browser of browsers) {
  test.describe(`${browser.name} compatibility`, () => {
    test.use({ ...devices[browser.device] });

    test('should render layout correctly', async ({ page }) => {
      await page.goto('/funcional');
      await page.waitForLoadState('networkidle');

      // Test critical functionality
      const generateButton = page.locator('button:has-text("Generar")');
      await expect(generateButton).toBeVisible();
      await expect(generateButton).toBeEnabled();
    });

    test('should support modern CSS features', async ({ page }) => {
      await page.goto('/funcional');

      // Test CSS Grid support
      const gridSupport = await page.evaluate(() => {
        return CSS.supports('display', 'grid');
      });

      if (gridSupport) {
        const gridContainer = page.locator('.grid-container');
        await expect(gridContainer).toHaveCSS('display', 'grid');
      }

      // Test CSS custom properties
      const customPropertySupport = await page.evaluate(() => {
        return CSS.supports('color', 'var(--test-color)');
      });

      expect(customPropertySupport).toBe(true);
    });
  });
}
```

## Documentation Templates

### Component Documentation Template
```markdown
# ComponentName

## Purpose
Brief description of what this component does and when to use it.

## Usage
```tsx
import { ComponentName } from './ComponentName';

<ComponentName
  prop1="value"
  prop2={true}
  onAction={() => {}}
/>
```

## Props Interface
```typescript
interface ComponentProps {
  /** Description of prop1 */
  prop1: string;
  /** Description of prop2 with default */
  prop2?: boolean;
  /** Callback description */
  onAction?: () => void;
}
```

## Visual Examples
- **Default State**: Screenshot or description
- **Hover State**: Screenshot or description
- **Focus State**: Screenshot or description
- **Disabled State**: Screenshot or description

## Accessibility Considerations
- [ ] Keyboard navigation supported
- [ ] Screen reader labels provided
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] ARIA attributes implemented

## Performance Implications
- Bundle size impact: XX KB
- Rendering performance: Optimized/Heavy
- Dependencies: List external dependencies

## HTML-First Alternative
```html
<!-- Native HTML implementation -->
<details class="component-alternative">
  <summary>Show Details</summary>
  <div>Content that achieves similar functionality</div>
</details>
```

## Browser Support
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ⚠️ IE 11 (with polyfill)

## Testing
- Unit tests: `ComponentName.test.tsx`
- Visual tests: `ComponentName.visual.spec.ts`
- A11y tests: Included in accessibility suite
```

### Design Decision Record Template
```markdown
# DDR-YYYY-MM-DD: Decision Title

## Status
Accepted | Proposed | Deprecated | Superseded

## Context
What is the issue that we're seeing that is motivating this decision or change?

## Decision
What is the change that we're proposing or have agreed to implement?

## Consequences
What becomes easier or more difficult to do and any risks introduced by this change?

## Alternatives Considered
- **Option A**: Description and why it was rejected
- **Option B**: Description and why it was rejected
- **Chosen Option**: Description and why it was selected

## Implementation Details
- [ ] Update component library
- [ ] Update documentation
- [ ] Create migration guide
- [ ] Update tests

## Success Metrics
How will we know this decision was correct?
- Performance: Specific metrics
- User Experience: Specific measures
- Developer Experience: Specific improvements
```

### Accessibility Audit Template
```markdown
# Accessibility Audit: [Component/Page Name]

## Audit Date
[Date]

## Auditor
[Name]

## Scope
- Component: [Name]
- Page: [URL]
- User Flows: [List tested flows]

## Testing Methods
- [ ] Automated testing (axe-core)
- [ ] Manual keyboard testing
- [ ] Screen reader testing (NVDA/JAWS/VoiceOver)
- [ ] Color contrast verification
- [ ] Mobile accessibility testing

## WCAG 2.1 AA Compliance

### Level A Criteria
- [ ] 1.1.1 Non-text Content
- [ ] 1.3.1 Info and Relationships
- [ ] 1.3.2 Meaningful Sequence
- [ ] 2.1.1 Keyboard
- [ ] 2.1.2 No Keyboard Trap
- [ ] 2.4.1 Bypass Blocks

### Level AA Criteria
- [ ] 1.4.3 Contrast (Minimum)
- [ ] 1.4.4 Resize Text
- [ ] 2.4.6 Headings and Labels
- [ ] 2.4.7 Focus Visible
- [ ] 3.1.2 Language of Parts

## Issues Found
| Severity | Issue | WCAG Criterion | Location | Status |
|----------|-------|----------------|----------|---------|
| High | Missing alt text | 1.1.1 | Image carousel | Open |
| Medium | Low contrast | 1.4.3 | Secondary buttons | Fixed |

## Recommendations
1. **Immediate Actions** (Critical issues)
2. **Short-term Improvements** (1-2 weeks)
3. **Long-term Enhancements** (Future iterations)

## Retest Date
[Date for follow-up audit]
```

## Common Pitfalls and Anti-patterns

### Performance Pitfalls
```css
/* ❌ BAD: Expensive selectors */
.navigation ul li a span.icon {
  /* Overly complex selector */
}

/* ✅ GOOD: Simple, efficient selectors */
.nav-icon {
  /* Direct class targeting */
}

/* ❌ BAD: Layout thrashing animations */
.animate-bad {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from { left: -100px; } /* Triggers layout */
  to { left: 0; }
}

/* ✅ GOOD: Transform-based animations */
.animate-good {
  animation: slideInGood 0.3s ease;
}

@keyframes slideInGood {
  from { transform: translateX(-100px); } /* GPU accelerated */
  to { transform: translateX(0); }
}
```

### Accessibility Anti-patterns
```html
<!-- ❌ BAD: Div buttons without semantics -->
<div class="button" onclick="doSomething()">
  Click me
</div>

<!-- ✅ GOOD: Semantic button -->
<button type="button" onclick="doSomething()">
  Click me
</button>

<!-- ❌ BAD: Missing labels -->
<input type="email" placeholder="Email">

<!-- ✅ GOOD: Proper labeling -->
<label for="email">Email Address</label>
<input type="email" id="email" placeholder="example@domain.com">

<!-- ❌ BAD: Color-only information -->
<span style="color: red;">Required field</span>

<!-- ✅ GOOD: Multiple indicators -->
<span class="required">
  <span aria-label="Required">*</span>
  Required field
</span>
```

### CSS Architecture Mistakes
```css
/* ❌ BAD: Over-specific selectors */
.page .container .form .input.text.required {
  border: 2px solid red;
}

/* ✅ GOOD: Single responsibility classes */
.input-required {
  border: 2px solid var(--color-danger);
}

/* ❌ BAD: Magic numbers */
.component {
  margin-top: 23px;
  padding: 17px;
  border-radius: 5.5px;
}

/* ✅ GOOD: Design system values */
.component {
  margin-top: var(--spacing-6);
  padding: var(--spacing-4);
  border-radius: var(--radius-md);
}

/* ❌ BAD: Hardcoded breakpoints */
@media (max-width: 768px) {
  .component { font-size: 14px; }
}

/* ✅ GOOD: Token-based breakpoints */
@media (max-width: var(--breakpoint-md)) {
  .component { font-size: var(--font-size-sm); }
}
```

### JavaScript Bottlenecks to Watch For
```javascript
// ❌ BAD: Synchronous DOM queries in loops
const items = document.querySelectorAll('.item');
for (let i = 0; i < items.length; i++) {
  items[i].style.height = getComputedStyle(items[i]).width;
  // Causes layout thrashing
}

// ✅ GOOD: Batch DOM operations
const items = document.querySelectorAll('.item');
const widths = [];

// Read phase
for (let i = 0; i < items.length; i++) {
  widths[i] = getComputedStyle(items[i]).width;
}

// Write phase
for (let i = 0; i < items.length; i++) {
  items[i].style.height = widths[i];
}

// ❌ BAD: Memory leaks with event listeners
class Component {
  constructor() {
    window.addEventListener('resize', this.handleResize);
  }

  handleResize() {
    // Handler not removed on cleanup
  }
}

// ✅ GOOD: Proper cleanup
class Component {
  constructor() {
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);
  }

  destroy() {
    window.removeEventListener('resize', this.handleResize);
  }

  handleResize() {
    // Properly bound and cleaned up
  }
}
```

## Resource Optimization

### Image Optimization Guidelines

#### Modern Format Implementation
```html
<!-- Progressive enhancement with multiple formats -->
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg"
       alt="Descriptive text"
       loading="lazy"
       decoding="async"
       width="400"
       height="300">
</picture>

<!-- Responsive images with srcset -->
<img src="image-400.webp"
     srcset="image-400.webp 400w,
             image-800.webp 800w,
             image-1200.webp 1200w"
     sizes="(max-width: 400px) 100vw,
            (max-width: 800px) 50vw,
            400px"
     alt="Description"
     loading="lazy">
```

#### Image Preloading Strategy
```html
<!-- Critical above-the-fold images -->
<link rel="preload" as="image" href="hero-image.webp" type="image/webp">

<!-- Preload with responsive images -->
<link rel="preload" as="image"
      href="hero-large.webp"
      imagesrcset="hero-small.webp 400w, hero-large.webp 800w"
      imagesizes="(max-width: 400px) 400px, 800px">
```

### Font Loading Strategies

#### Optimized Font Loading
```html
<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/righteous.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/abeezee.woff2" as="font" type="font/woff2" crossorigin>

<style>
/* Font display strategy */
@font-face {
  font-family: 'Righteous';
  src: url('/fonts/righteous.woff2') format('woff2');
  font-display: swap; /* Show fallback, then custom font */
  font-weight: 400;
  font-style: normal;
}

@font-face {
  font-family: 'ABeeZee';
  src: url('/fonts/abeezee.woff2') format('woff2');
  font-display: swap;
  font-weight: 400;
  font-style: normal;
}

/* Fallback font stack */
body {
  font-family: 'ABeeZee', system-ui, -apple-system, sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Righteous', system-ui, sans-serif;
}
</style>
```

### SVG Optimization Patterns

#### Optimized SVG Icons
```html
<!-- Inline critical SVGs -->
<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
</svg>

<!-- External sprite for repeated icons -->
<svg class="icon">
  <use href="/icons/sprite.svg#star"></use>
</svg>

<style>
.icon {
  width: 1.5rem;
  height: 1.5rem;
  fill: currentColor;
}
</style>
```

### Critical Resource Prioritization

#### Resource Hints Implementation
```html
<!-- DNS prefetch for external domains -->
<link rel="dns-prefetch" href="//fonts.googleapis.com">
<link rel="dns-prefetch" href="//api.example.com">

<!-- Preconnect for critical external resources -->
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Prefetch for likely navigation -->
<link rel="prefetch" href="/css-manager">
<link rel="prefetch" href="/temporizadores">

<!-- Preload critical resources -->
<link rel="preload" href="/api/user-data" as="fetch" crossorigin>
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/app.js" as="script">
```

## Mobile-First Patterns

### Critical Mobile Testing Requirements
- **Mandatory 360px viewport testing** - iPhone SE and small Android devices (smallest common mobile screen)
- **CSS mobile MUST be inside `@media (max-width: 640px)`** - CSS outside media queries will apply to all viewports causing desktop layout issues
- **Touch targets minimum 44px** - Use `var(--touch-target-min)` or `var(--spacing-11)` for WCAG AA compliance
- **No horizontal scrolling** - Use `calc(100vw - Xpx)` for responsive widths with consistent margins
- **Responsive variables available**:
  - `--text-mobile-min: 12px` - Minimum mobile text size
  - `--button-padding-mobile: 8px 16px` - Mobile button padding
  - `--touch-target-min: 44px` - Minimum touch target dimension
- **Testing checklist**: 360px, 390px (iPhone 14), 768px (tablet), 1024px (desktop)
- **Reference**: See `design-system/docs/MOBILE-RESPONSIVE-DESIGN.md` for comprehensive mobile patterns

### Touch Gesture Considerations

#### Touch Target Optimization
```css
/* Minimum touch target size */
.touch-target {
  min-height: var(--spacing-11); /* 44px minimum */
  min-width: var(--spacing-11);
  padding: var(--spacing-2);

  /* Ensure targets don't overlap */
  margin: var(--spacing-1);
}

/* Increase touch targets on small screens */
@media (max-width: 480px) {
  .touch-target {
    min-height: 48px;
    min-width: 48px;
    padding: var(--spacing-3);
  }
}

/* Touch feedback */
.touch-target:active {
  transform: scale(0.98);
  transition: transform 0.1s ease;
}
```

#### Gesture-Friendly Interactions
```css
/* Swipe-friendly containers */
.swipeable {
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch; /* iOS momentum scrolling */
}

.swipeable > * {
  scroll-snap-align: start;
  flex: 0 0 auto;
}

/* Pull-to-refresh indicator */
.pull-refresh {
  overscroll-behavior-y: contain;
}

/* Avoid hover states on touch devices */
@media (hover: hover) {
  .button:hover {
    background-color: var(--color-primary-hover);
  }
}
```

### Viewport Meta Tag Best Practices
```html
<!-- Optimized viewport configuration -->
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

<!-- Prevent zoom on input focus (iOS) -->
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">

<!-- Support for safe areas (iPhone notch) -->
<style>
.safe-area {
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
```

### Mobile Performance Patterns

#### Reduced Motion and Battery Considerations
```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Optimize for battery life */
@media (prefers-reduced-motion: reduce) {
  .parallax-effect,
  .continuous-animation {
    animation: none;
    transform: none;
  }
}

/* Data saver considerations */
@media (prefers-reduced-data: reduce) {
  .high-quality-image {
    display: none;
  }

  .low-quality-image {
    display: block;
  }
}
```

### Offline-First Considerations

#### Progressive Enhancement for Connectivity
```javascript
// Network-aware loading
class NetworkAwareLoader {
  constructor() {
    this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    this.isSlowConnection = this.connection?.effectiveType === 'slow-2g' || this.connection?.effectiveType === '2g';
  }

  loadImage(src, fallbackSrc) {
    if (this.isSlowConnection) {
      return this.loadLowQuality(fallbackSrc);
    }
    return this.loadHighQuality(src);
  }

  loadLowQuality(src) {
    // Load compressed version
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src.replace('.jpg', '-compressed.jpg');
    });
  }

  loadHighQuality(src) {
    // Load full quality
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = src;
    });
  }
}
```

## SEO Considerations

### Semantic HTML for SEO

#### Structured Content Hierarchy
```html
<!-- Proper heading hierarchy -->
<main>
  <h1>Generador de Entrenamientos Funcionales</h1>

  <section aria-labelledby="equipment-heading">
    <h2 id="equipment-heading">Selección de Equipamiento</h2>

    <div>
      <h3>Equipamiento Disponible</h3>
      <!-- Equipment selection -->
    </div>
  </section>

  <section aria-labelledby="workout-heading">
    <h2 id="workout-heading">Entrenamiento Generado</h2>

    <article>
      <h3>Bloque de Fuerza</h3>
      <!-- Workout content -->
    </article>
  </section>
</main>

<!-- Breadcrumb navigation -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Inicio</a></li>
    <li><a href="/generadores">Generadores</a></li>
    <li aria-current="page">Funcional</li>
  </ol>
</nav>
```

### Structured Data Patterns

#### JSON-LD Implementation
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Generador de Entrenamientos SWD",
  "description": "Generador profesional de entrenamientos funcionales personalizados",
  "applicationCategory": "HealthApplication",
  "operatingSystem": "Web Browser",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  },
  "creator": {
    "@type": "Organization",
    "name": "Movimiento Funcional",
    "url": "https://example.com"
  },
  "featureList": [
    "Entrenamientos personalizados",
    "Múltiples categorías de ejercicios",
    "Exportación HTML y CSV",
    "Sistema de favoritos"
  ]
}
</script>

<!-- Workout structured data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ExercisePlan",
  "name": "Entrenamiento Funcional Personalizado",
  "description": "Entrenamiento de fuerza funcional generado automáticamente",
  "exerciseType": "Strength Training",
  "intensity": "Moderate",
  "workoutTime": "PT45M",
  "equipment": ["Dumbbells", "Resistance Bands"],
  "targetAudience": {
    "@type": "PeopleAudience",
    "suggestedMinAge": 18,
    "suggestedMaxAge": 65
  }
}
</script>
```

### Meta Tags Management

#### Comprehensive Meta Tags
```html
<!-- Primary Meta Tags -->
<title>Generador de Entrenamientos Funcionales | SWD Training</title>
<meta name="title" content="Generador de Entrenamientos Funcionales | SWD Training">
<meta name="description" content="Crea entrenamientos funcionales personalizados con nuestro generador automático. Múltiples categorías, equipamiento flexible y exportación profesional.">
<meta name="keywords" content="entrenamientos, funcional, fitness, generador, ejercicios, personalizado">

<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://swd-training.com/funcional">
<meta property="og:title" content="Generador de Entrenamientos Funcionales">
<meta property="og:description" content="Crea entrenamientos funcionales personalizados con nuestro generador automático.">
<meta property="og:image" content="https://swd-training.com/og-image.jpg">

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:url" content="https://swd-training.com/funcional">
<meta property="twitter:title" content="Generador de Entrenamientos Funcionales">
<meta property="twitter:description" content="Crea entrenamientos funcionales personalizados con nuestro generador automático.">
<meta property="twitter:image" content="https://swd-training.com/twitter-image.jpg">

<!-- Additional SEO Meta Tags -->
<meta name="robots" content="index, follow">
<meta name="language" content="Spanish">
<meta name="author" content="Movimiento Funcional">
<link rel="canonical" href="https://swd-training.com/funcional">

<!-- Mobile optimization -->
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="theme-color" content="#00bec8">
```

### Performance Impact on SEO

#### Core Web Vitals Optimization for Search Rankings
```html
<!-- Critical CSS inlining for LCP optimization -->
<style>
  /* Inline critical styles for above-the-fold content */
  .hero { /* Critical styles */ }
  .navigation { /* Critical styles */ }
  .form-container { /* Critical styles */ }
</style>

<!-- Preload critical resources -->
<link rel="preload" href="/fonts/righteous.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/api/exercise-data" as="fetch" crossorigin>

<!-- Non-critical CSS loading -->
<link rel="preload" href="/styles/non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/styles/non-critical.css"></noscript>
```

#### Image SEO Optimization
```html
<!-- SEO-friendly image implementation -->
<img src="functional-training-hero.webp"
     alt="Professional functional training workout with dumbbells and resistance bands"
     title="Functional Training Workout Generator"
     loading="lazy"
     width="800"
     height="400"
     sizes="(max-width: 768px) 100vw, 800px"
     srcset="functional-training-400.webp 400w,
             functional-training-800.webp 800w,
             functional-training-1200.webp 1200w">
```

## Performance Optimization

### Critical Performance Strategies

#### CSS Containment
```css
/* Optimize rendering performance with CSS containment */
.component {
  contain: layout style paint;
}

.isolated-section {
  contain: strict;
}

/* For dynamic components */
.dynamic-content {
  contain: layout style;
  content-visibility: auto;
  contain-intrinsic-size: 300px;
}
```

#### Critical CSS Extraction
```html
<!-- Inline critical CSS for above-the-fold content -->
<style>
  /* Critical styles for navigation, hero, forms */
  .navigation { /* Inline styles */ }
  .hero-section { /* Inline styles */ }
  .form-container { /* Inline styles */ }
</style>

<!-- Load non-critical CSS asynchronously -->
<link rel="preload" href="/styles/non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="/styles/non-critical.css"></noscript>
```

#### Lazy Loading Patterns
```html
<!-- Images with native lazy loading -->
<img src="placeholder.webp"
     data-src="actual-image.webp"
     loading="lazy"
     decoding="async"
     alt="Description">

<!-- Component lazy loading -->
<div data-component="heavy-chart"
     data-threshold="0.1">
  Loading chart...
</div>

<script>
// Intersection Observer for component lazy loading
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const element = entry.target;
      const componentName = element.dataset.component;
      import(`./components/${componentName}.js`).then(module => {
        module.init(element);
      });
      observer.unobserve(element);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-component]').forEach(el => {
  observer.observe(el);
});
</script>
```

#### Bundle Size Optimization
```javascript
// Tree shaking with ES modules
export { specificFunction } from './utils';

// Dynamic imports for large dependencies
const loadChart = async () => {
  const { Chart } = await import('./heavy-chart-library');
  return Chart;
};

// Code splitting at route level
const LazyPage = lazy(() => import('./LargePage'));
```

#### Core Web Vitals Monitoring
```javascript
// Measure and monitor Core Web Vitals
import { getCLS, getFID, getFCP, getLCP, getTTFB, getINP } from 'web-vitals';

const vitalsUrl = '/api/vitals';

function sendToAnalytics(metric) {
  fetch(vitalsUrl, {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: { 'Content-Type': 'application/json' }
  });
}

// Monitor all Core Web Vitals
getCLS(sendToAnalytics);
getFID(sendToAnalytics);
getFCP(sendToAnalytics);
getLCP(sendToAnalytics);
getTTFB(sendToAnalytics);
getINP(sendToAnalytics); // New metric replacing FID

// Performance observer for custom metrics
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    // Log critical performance entries
    if (entry.entryType === 'largest-contentful-paint') {
      console.log('LCP:', entry.startTime);
    }
  });
});

observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
```

### Image Optimization
- **WebP/AVIF**: Use next-gen formats with fallbacks
- **Responsive Images**: Implement srcset and sizes attributes
- **Lazy Loading**: Native loading="lazy" for below-fold content
- **SVG Optimization**: Use SVGO for icon optimization
- **Image Preloading**: Preload critical images

### CSS Optimization
- **CSS Variables**: Dynamic theming with custom properties
- **Critical CSS**: Inline above-the-fold styles
- **CSS Containment**: Optimize layout and paint operations
- **Unused Style Removal**: PurgeCSS integration
- **CSS-in-JS Minimization**: Reduce runtime overhead

### Animation Performance
- **GPU Acceleration**: Use transform and opacity for animations
- **will-change**: Optimize complex animations
- **Reduced Motion**: Respect prefers-reduced-motion
- **CSS over JS**: Prefer CSS animations for performance
- **Animation Cleanup**: Remove will-change after animation completes

## Accessibility Enhancement

### WCAG 2.1 AA Compliance Standards
- **Color Contrast**: 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators**: Visible and high contrast focus rings
- **Keyboard Navigation**: Full functionality without mouse
- **Screen Reader Support**: Proper ARIA labels and announcements

### ARIA Patterns Reference

#### Interactive Components
```html
<!-- Expandable/Collapsible Content -->
<button aria-expanded="false"
        aria-controls="content-1"
        id="trigger-1">
  Show Details
</button>
<div id="content-1"
     aria-labelledby="trigger-1"
     hidden>
  Content here
</div>

<!-- Tab Interface -->
<div role="tablist" aria-label="Workout Sections">
  <button role="tab"
          aria-selected="true"
          aria-controls="panel-1"
          id="tab-1">
    Warm-up
  </button>
  <button role="tab"
          aria-selected="false"
          aria-controls="panel-2"
          id="tab-2">
    Strength
  </button>
</div>

<div role="tabpanel"
     id="panel-1"
     aria-labelledby="tab-1">
  Warm-up exercises
</div>

<!-- Progress Indicator -->
<div role="progressbar"
     aria-valuenow="65"
     aria-valuemin="0"
     aria-valuemax="100"
     aria-label="Workout progress">
  <div class="progress-bar" style="width: 65%"></div>
</div>

<!-- Live Regions for Dynamic Content -->
<div aria-live="polite"
     aria-atomic="true"
     id="status-updates">
  <!-- Dynamic status messages -->
</div>

<div aria-live="assertive"
     aria-atomic="true"
     id="error-messages">
  <!-- Critical error messages -->
</div>
```

#### Form Accessibility
```html
<!-- Proper Label Association -->
<label for="exercise-level">Exercise Level</label>
<select id="exercise-level"
        aria-describedby="level-help"
        required>
  <option value="">Choose level...</option>
  <option value="beginner">Beginner</option>
  <option value="intermediate">Intermediate</option>
  <option value="advanced">Advanced</option>
</select>
<div id="level-help">Select your current fitness level</div>

<!-- Error Handling -->
<input type="email"
       id="user-email"
       aria-describedby="email-error"
       aria-invalid="true"
       required>
<div id="email-error"
     role="alert"
     aria-live="polite">
  Please enter a valid email address
</div>

<!-- Fieldset for Related Controls -->
<fieldset>
  <legend>Available Equipment</legend>
  <input type="checkbox" id="dumbbells" name="equipment" value="dumbbells">
  <label for="dumbbells">Dumbbells</label>

  <input type="checkbox" id="resistance-bands" name="equipment" value="bands">
  <label for="resistance-bands">Resistance Bands</label>
</fieldset>
```

### Keyboard Navigation Testing Checklist

#### Navigation Flow
- [ ] Tab order follows logical reading order
- [ ] All interactive elements are keyboard accessible
- [ ] Tab focus visible with clear indicators
- [ ] Skip links available for main content
- [ ] Focus trapping in modals/dialogs

#### Keyboard Shortcuts
```javascript
// Standard keyboard interactions
document.addEventListener('keydown', (e) => {
  switch(e.key) {
    case 'Escape':
      // Close modal, clear focus, etc.
      closeModal();
      break;
    case 'Enter':
    case ' ': // Spacebar
      // Activate button/link equivalent
      if (e.target.role === 'button') {
        e.target.click();
      }
      break;
    case 'ArrowDown':
    case 'ArrowUp':
      // Navigate list items, menu options
      navigateList(e.key);
      break;
    case 'Home':
    case 'End':
      // Jump to first/last item
      jumpToItem(e.key);
      break;
  }
});
```

### Screen Reader Testing Guidelines

#### Testing Tools
- **NVDA** (Windows) - Free screen reader
- **JAWS** (Windows) - Professional screen reader
- **VoiceOver** (macOS/iOS) - Built-in screen reader
- **TalkBack** (Android) - Built-in screen reader

#### Testing Process
```javascript
// Screen reader announcements
const announceToScreenReader = (message, priority = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  // Clean up after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Usage examples
announceToScreenReader('Workout generated successfully');
announceToScreenReader('Error: Please select your equipment', 'assertive');
```

#### Screen Reader Only Content
```css
/* Visually hidden but accessible to screen readers */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Show on focus for keyboard users */
.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: inherit;
  margin: inherit;
  overflow: visible;
  clip: auto;
  white-space: inherit;
}
```

### Color Contrast Checking Tools

#### Automated Testing
```javascript
// Color contrast checker function
const checkContrast = (foreground, background) => {
  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Calculate relative luminance
  const getLuminance = (rgb) => {
    const rsRGB = rgb.r / 255;
    const gsRGB = rgb.g / 255;
    const bsRGB = rgb.b / 255;

    const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  const fgLum = getLuminance(fgRgb);
  const bgLum = getLuminance(bgRgb);

  const contrast = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);

  return {
    ratio: Math.round(contrast * 100) / 100,
    aa: contrast >= 4.5,
    aaa: contrast >= 7,
    aaLarge: contrast >= 3
  };
};

// Test project colors
console.log('Primary text:', checkContrast('#1f2937', '#ffffff'));
console.log('Turquesa button:', checkContrast('#ffffff', '#00bec8'));
console.log('Rosa error:', checkContrast('#ffffff', '#e11d48'));
```

#### Manual Testing Tools
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Colour Contrast Analyser (CCA)**: Desktop application
- **Browser DevTools**: Built-in accessibility audits
- **axe-core**: Automated accessibility testing

### Focus Management Patterns

#### Focus Trapping in Modals
```javascript
class FocusTrap {
  constructor(element) {
    this.element = element;
    this.focusableElements = this.getFocusableElements();
    this.firstElement = this.focusableElements[0];
    this.lastElement = this.focusableElements[this.focusableElements.length - 1];
  }

  getFocusableElements() {
    const selectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];

    return this.element.querySelectorAll(selectors.join(', '));
  }

  activate() {
    this.element.addEventListener('keydown', this.handleKeydown.bind(this));
    this.firstElement?.focus();
  }

  deactivate() {
    this.element.removeEventListener('keydown', this.handleKeydown.bind(this));
  }

  handleKeydown(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === this.firstElement) {
          e.preventDefault();
          this.lastElement?.focus();
        }
      } else {
        if (document.activeElement === this.lastElement) {
          e.preventDefault();
          this.firstElement?.focus();
        }
      }
    }
  }
}
```

#### Skip Links Implementation
```html
<!-- Skip links for keyboard navigation -->
<a href="#main-content" class="skip-link">Skip to main content</a>
<a href="#navigation" class="skip-link">Skip to navigation</a>

<style>
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--turquesa-600);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 0 0 4px 4px;
  z-index: 1000;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
</style>
```

## Cross-browser Compatibility

### Feature Detection Patterns

#### CSS Feature Detection
```css
/* Use @supports for progressive enhancement */
@supports (display: grid) {
  .layout {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
  }
}

@supports not (display: grid) {
  .layout {
    display: flex;
    flex-wrap: wrap;
  }

  .layout > * {
    flex: 1 1 300px;
    margin: 0.5rem;
  }
}

/* Container queries with fallback */
@supports (container-type: inline-size) {
  .component {
    container-type: inline-size;
  }

  @container (min-width: 400px) {
    .component .title {
      font-size: 1.5rem;
    }
  }
}

@supports not (container-type: inline-size) {
  @media (min-width: 400px) {
    .component .title {
      font-size: 1.5rem;
    }
  }
}

/* Modern CSS with fallbacks */
.button {
  /* Fallback for older browsers */
  background: #00bec8;
  border-radius: 4px;

  /* Modern properties */
  background: oklch(68% 0.15 198);
  border-radius: clamp(4px, 0.5vw, 8px);
}

@supports (color: oklch(68% 0.15 198)) {
  .button {
    background: var(--turquesa-600);
  }
}
```

#### JavaScript Feature Detection
```javascript
// Modern feature detection without polyfills
class FeatureDetector {
  static hasIntersectionObserver() {
    return 'IntersectionObserver' in window;
  }

  static hasCustomElements() {
    return 'customElements' in window;
  }

  static hasWebComponents() {
    return this.hasCustomElements() && 'attachShadow' in Element.prototype;
  }

  static hasModuleSupport() {
    return 'noModule' in HTMLScriptElement.prototype;
  }

  static hasCSSSupports() {
    return 'CSS' in window && 'supports' in window.CSS;
  }

  static hasWebWorkers() {
    return 'Worker' in window;
  }

  static hasServiceWorkers() {
    return 'serviceWorker' in navigator;
  }
}

// Conditional loading based on feature support
if (FeatureDetector.hasIntersectionObserver()) {
  // Use native Intersection Observer
  const observer = new IntersectionObserver(callback);
  observer.observe(element);
} else {
  // Fallback to scroll-based detection
  window.addEventListener('scroll', throttledScrollHandler);
}

// Progressive enhancement for Web Components
if (FeatureDetector.hasWebComponents()) {
  import('./components/enhanced-component.js');
} else {
  import('./components/basic-component.js');
}
```

### Progressive Enhancement Examples

#### Form Enhancement
```html
<!-- Base HTML form that works without JavaScript -->
<form action="/api/generate-workout" method="POST">
  <fieldset>
    <legend>Workout Preferences</legend>

    <label for="level">Fitness Level</label>
    <select name="level" id="level" required>
      <option value="">Choose level...</option>
      <option value="beginner">Beginner</option>
      <option value="intermediate">Intermediate</option>
      <option value="advanced">Advanced</option>
    </select>

    <fieldset>
      <legend>Available Equipment</legend>
      <input type="checkbox" name="equipment" value="dumbbells" id="dumbbells">
      <label for="dumbbells">Dumbbells</label>

      <input type="checkbox" name="equipment" value="resistance-bands" id="bands">
      <label for="bands">Resistance Bands</label>
    </fieldset>

    <button type="submit">Generate Workout</button>
  </fieldset>
</form>

<script>
// Progressive enhancement with JavaScript
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('form');

  // Only enhance if JavaScript is available
  if (form && 'fetch' in window) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(form);
      const button = form.querySelector('button[type="submit"]');

      // Enhanced loading state
      button.disabled = true;
      button.textContent = 'Generating...';

      try {
        const response = await fetch('/api/generate-workout', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        // Enhanced result display
        displayWorkout(result);
      } catch (error) {
        // Enhanced error handling
        showError('Failed to generate workout. Please try again.');
      } finally {
        button.disabled = false;
        button.textContent = 'Generate Workout';
      }
    });
  }
});
</script>
```

### Polyfill Strategy (Only When Absolutely Necessary)

#### Minimal Polyfill Approach
```javascript
// Only polyfill critical missing features
const loadPolyfills = async () => {
  const polyfills = [];

  // Critical: Intersection Observer for lazy loading
  if (!('IntersectionObserver' in window)) {
    polyfills.push(import('intersection-observer'));
  }

  // Critical: ResizeObserver for responsive components
  if (!('ResizeObserver' in window)) {
    polyfills.push(import('@juggle/resize-observer'));
  }

  // Load only necessary polyfills
  if (polyfills.length > 0) {
    await Promise.all(polyfills);
  }
};

// Load polyfills before main application
loadPolyfills().then(() => {
  // Initialize application
  import('./main.js');
});
```

#### CSS Polyfill Patterns
```css
/* CSS Custom Properties fallback */
:root {
  /* Fallback values */
  --primary-color: #00bec8;
  --text-color: #1f2937;
}

.component {
  /* Fallback for browsers without custom properties */
  color: #1f2937;
  background: #00bec8;

  /* Enhanced with custom properties */
  color: var(--text-color, #1f2937);
  background: var(--primary-color, #00bec8);
}

/* Grid fallback with Flexbox */
.grid-container {
  /* Flexbox fallback */
  display: flex;
  flex-wrap: wrap;
  margin: -0.5rem;
}

.grid-container > * {
  flex: 1 1 300px;
  margin: 0.5rem;
}

/* Modern Grid (overrides flexbox when supported) */
@supports (display: grid) {
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin: 0;
  }

  .grid-container > * {
    margin: 0;
  }
}
```

## Design Tokens Management

### CSS Custom Properties Architecture

#### Color Token System
```css
:root {
  /* Base color palette */
  --turquesa-50: #f0fdfa;
  --turquesa-100: #ccfbf1;
  --turquesa-200: #99f6e4;
  --turquesa-300: #5eead4;
  --turquesa-400: #2dd4bf;
  --turquesa-500: #14b8a6;
  --turquesa-600: #00bec8; /* Primary brand */
  --turquesa-700: #0891b2;
  --turquesa-800: #155e75;
  --turquesa-900: #164e63;

  /* Rosa palette */
  --rosa-50: #fdf2f8;
  --rosa-100: #fce7f3;
  --rosa-200: #fbcfe8;
  --rosa-300: #f9a8d4;
  --rosa-400: #f472b6;
  --rosa-500: #ec4899;
  --rosa-600: #e11d48; /* Critical actions */
  --rosa-700: #be185d;
  --rosa-800: #9d174d;
  --rosa-900: #831843;

  /* Tulip Tree (Yellow-Orange) */
  --tulip-tree-50: #fefce8;
  --tulip-tree-100: #fef3c7;
  --tulip-tree-200: #fde68a;
  --tulip-tree-300: #fcd34d;
  --tulip-tree-400: #fbbf24;
  --tulip-tree-500: #eab308; /* Warnings */
  --tulip-tree-600: #ca8a04;
  --tulip-tree-700: #a16207;
  --tulip-tree-800: #854d0e;
  --tulip-tree-900: #713f12;

  /* Semantic color assignments */
  --color-primary: var(--turquesa-600);
  --color-primary-hover: var(--turquesa-700);
  --color-primary-active: var(--turquesa-800);

  --color-danger: var(--rosa-600);
  --color-danger-hover: var(--rosa-700);
  --color-danger-active: var(--rosa-800);

  --color-warning: var(--tulip-tree-500);
  --color-warning-hover: var(--tulip-tree-600);
  --color-warning-active: var(--tulip-tree-700);

  --color-success: #10b981;
  --color-success-hover: #059669;
  --color-success-active: #047857;
}
```

#### Typography Token System
```css
:root {
  /* Font families */
  --font-family-headings: 'Righteous', system-ui, sans-serif;
  --font-family-body: 'ABeeZee', system-ui, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font sizes - 8px base scale */
  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-tag: 1.0625rem; /* 17px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-button: 1.3125rem; /* 21px - Desktop buttons */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */
  --font-size-4xl: 2.25rem;   /* 36px */
  --font-size-5xl: 3rem;      /* 48px */

  /* Line heights */
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.625;
  --line-height-loose: 2;

  /* Font weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
}
```

#### Spacing Token System
```css
:root {
  /* Spacing scale - 8px base grid */
  --spacing-0: 0;
  --spacing-px: 1px;
  --spacing-0-5: 0.125rem;  /* 2px */
  --spacing-1: 0.25rem;     /* 4px */
  --spacing-1-5: 0.375rem;  /* 6px */
  --spacing-2: 0.5rem;      /* 8px - Base unit */
  --spacing-2-5: 0.625rem;  /* 10px */
  --spacing-3: 0.75rem;     /* 12px */
  --spacing-3-5: 0.875rem;  /* 14px */
  --spacing-4: 1rem;        /* 16px */
  --spacing-5: 1.25rem;     /* 20px */
  --spacing-6: 1.5rem;      /* 24px */
  --spacing-7: 1.75rem;     /* 28px */
  --spacing-8: 2rem;        /* 32px */
  --spacing-9: 2.25rem;     /* 36px */
  --spacing-10: 2.5rem;     /* 40px */
  --spacing-11: 2.75rem;    /* 44px - Min touch target */
  --spacing-12: 3rem;       /* 48px */
  --spacing-14: 3.5rem;     /* 56px */
  --spacing-16: 4rem;       /* 64px */
  --spacing-20: 5rem;       /* 80px */
  --spacing-24: 6rem;       /* 96px */
  --spacing-32: 8rem;       /* 128px */

  /* Semantic spacing */
  --spacing-touch-target: var(--spacing-11); /* 44px minimum */
  --spacing-container-mobile: var(--spacing-2); /* 8px */
  --spacing-container-desktop: auto; /* Centered */
}
```

### Theming Patterns

#### Theme Toggle Implementation
```css
/* Light theme (default) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --border-primary: #e5e7eb;
}

/* Dark theme */
[data-theme="dark"] {
  --bg-primary: #1f2937;
  --bg-secondary: #111827;
  --text-primary: #f9fafb;
  --text-secondary: #d1d5db;
  --border-primary: #374151;
}

/* Apply themed colors */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.2s, color 0.2s;
}

.card {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-primary);
}
```

#### Theme Persistence
```javascript
// Theme management
class ThemeManager {
  constructor() {
    this.theme = this.getStoredTheme() || this.getSystemTheme();
    this.applyTheme(this.theme);
  }

  getStoredTheme() {
    return localStorage.getItem('theme');
  }

  getSystemTheme() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    this.theme = theme;
  }

  toggle() {
    const newTheme = this.theme === 'dark' ? 'light' : 'dark';
    this.applyTheme(newTheme);
  }

  // Listen for system theme changes
  watchSystemTheme() {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', (e) => {
        if (!this.getStoredTheme()) {
          this.applyTheme(e.matches ? 'dark' : 'light');
        }
      });
  }
}

// Initialize theme manager
const themeManager = new ThemeManager();
themeManager.watchSystemTheme();
```

### Responsive Design Tokens
```css
:root {
  /* Breakpoints */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;

  /* Container max-widths */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1280px;
  --container-2xl: 1536px;
}

/* Responsive token overrides */
@media (max-width: 768px) {
  :root {
    --font-size-button: 1rem; /* 16px on mobile */
    --spacing-container: var(--spacing-2); /* 8px margins */
  }
}

@media (min-width: 769px) {
  :root {
    --spacing-container: auto; /* Centered on desktop */
  }
}
```

### Print Styles Considerations
```css
/* Print-specific token overrides */
@media print {
  :root {
    /* High contrast for printing */
    --color-primary: #000000;
    --color-text: #000000;
    --color-background: #ffffff;
    --color-border: #000000;

    /* Optimize font sizes for print */
    --font-size-base: 12pt;
    --font-size-lg: 14pt;
    --font-size-xl: 16pt;

    /* Remove shadows and gradients */
    --shadow-sm: none;
    --shadow-md: none;
    --shadow-lg: none;
    --gradient-primary: none;
  }

  /* Hide interactive elements */
  .no-print,
  button:not(.print-button),
  .navigation,
  .sidebar {
    display: none !important;
  }

  /* Optimize layout for print */
  .print-optimize {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Ensure important content is visible */
  .workout-content {
    background: white !important;
    color: black !important;
  }
}
```

## Component Composition Patterns

### Compound Components (No External Libraries)
```javascript
// Parent component manages shared state
class Tabs {
  constructor(container) {
    this.container = container;
    this.state = { activeTab: 0 };
    this.init();
  }

  init() {
    // Find all tab triggers and panels
    this.triggers = this.container.querySelectorAll('[data-tab-trigger]');
    this.panels = this.container.querySelectorAll('[data-tab-panel]');

    this.triggers.forEach((trigger, index) => {
      trigger.addEventListener('click', () => this.selectTab(index));
    });

    this.selectTab(0);
  }

  selectTab(index) {
    this.state.activeTab = index;

    this.triggers.forEach((trigger, i) => {
      trigger.setAttribute('aria-selected', i === index);
      trigger.classList.toggle('active', i === index);
    });

    this.panels.forEach((panel, i) => {
      panel.hidden = i !== index;
      panel.setAttribute('aria-hidden', i !== index);
    });
  }
}

// HTML Structure
/*
<div class="tabs-container">
  <div role="tablist">
    <button data-tab-trigger role="tab">Tab 1</button>
    <button data-tab-trigger role="tab">Tab 2</button>
  </div>
  <div data-tab-panel role="tabpanel">Content 1</div>
  <div data-tab-panel role="tabpanel">Content 2</div>
</div>
*/
```

### Slot Pattern (Without Web Components)
```html
<!-- Template approach for composition -->
<div class="card" data-component="card">
  <div data-slot="header">
    <h2>Card Title</h2>
  </div>
  <div data-slot="body">
    <p>Card content goes here</p>
  </div>
  <div data-slot="footer">
    <button>Action</button>
  </div>
</div>

<style>
/* Slot-based styling */
[data-slot="header"] {
  border-bottom: 1px solid var(--border-primary);
  padding: var(--spacing-4);
}

[data-slot="body"] {
  padding: var(--spacing-4);
}

[data-slot="footer"] {
  border-top: 1px solid var(--border-primary);
  padding: var(--spacing-4);
  display: flex;
  justify-content: flex-end;
}
</style>
```

## Error Boundary Patterns (React)

### Native Error Handling for React Components
```tsx
// Error boundary for React projects (like this Next.js app)
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to error tracking service
    console.error('Component error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-container">
          <h2>Algo salió mal</h2>
          <details>
            <summary>Detalles del error</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button onClick={() => this.setState({ hasError: false })}>
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Vanilla JS Error Handling
```javascript
// Global error handler for non-React components
class GlobalErrorHandler {
  constructor() {
    this.errorContainer = document.getElementById('error-container');
    this.setupHandlers();
  }

  setupHandlers() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, event.filename, event.lineno);
      event.preventDefault();
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason);
      event.preventDefault();
    });
  }

  handleError(error, file, line) {
    const errorMessage = {
      message: error?.message || 'Unknown error',
      stack: error?.stack,
      file,
      line,
      timestamp: new Date().toISOString()
    };

    this.displayError(errorMessage);
    this.logError(errorMessage);
  }

  displayError(error) {
    if (!this.errorContainer) return;

    const errorElement = document.createElement('div');
    errorElement.className = 'error-notification';
    errorElement.innerHTML = `
      <div class="error-content">
        <strong>Error:</strong> ${error.message}
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    this.errorContainer.appendChild(errorElement);

    // Auto-remove after 5 seconds
    setTimeout(() => errorElement.remove(), 5000);
  }

  logError(error) {
    // Send to monitoring service
    if (typeof fetch !== 'undefined') {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(error)
      }).catch(() => {
        // Fallback to console if logging fails
        console.error('Failed to log error:', error);
      });
    }
  }
}
```

## State Management (Without External Libraries)

### Vanilla JS State Pattern
```javascript
// Simple state management without Redux/MobX
class StateManager {
  constructor(initialState = {}) {
    this.state = initialState;
    this.listeners = new Map();
  }

  getState() {
    return { ...this.state };
  }

  setState(updates) {
    const prevState = this.getState();
    this.state = { ...this.state, ...updates };
    this.notify(prevState, this.state);
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  notify(prevState, nextState) {
    // Notify all listeners about state changes
    for (const [key, callbacks] of this.listeners) {
      if (prevState[key] !== nextState[key]) {
        callbacks.forEach(callback => callback(nextState[key], prevState[key]));
      }
    }
  }
}

// Usage
const appState = new StateManager({
  equipment: [],
  level: 'intermediate',
  workout: null
});

// Subscribe to changes
const unsubscribe = appState.subscribe('workout', (newWorkout, oldWorkout) => {
  updateWorkoutDisplay(newWorkout);
});

// Update state
appState.setState({ workout: generatedWorkout });
```

### React Context Pattern (For This Project)
```tsx
// Simple context-based state management for React
import { createContext, useContext, useReducer } from 'react';

// State shape
interface AppState {
  user: User | null;
  equipment: string[];
  level: string;
  workout: Workout | null;
}

// Action types
type AppAction =
  | { type: 'SET_USER'; payload: User }
  | { type: 'SET_EQUIPMENT'; payload: string[] }
  | { type: 'SET_LEVEL'; payload: string }
  | { type: 'SET_WORKOUT'; payload: Workout };

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_EQUIPMENT':
      return { ...state, equipment: action.payload };
    case 'SET_LEVEL':
      return { ...state, level: action.payload };
    case 'SET_WORKOUT':
      return { ...state, workout: action.payload };
    default:
      return state;
  }
}

// Context
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | undefined>(undefined);

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, {
    user: null,
    equipment: [],
    level: 'intermediate',
    workout: null
  });

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Custom hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
```

## Security Best Practices for UI

### XSS Prevention
```javascript
// Safe DOM manipulation
class SafeDOM {
  // Escape HTML entities
  static escapeHtml(unsafe) {
    const div = document.createElement('div');
    div.textContent = unsafe;
    return div.innerHTML;
  }

  // Safe element creation
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);

    // Set attributes safely
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'innerHTML') {
        // Never use innerHTML with user input
        console.warn('Avoid innerHTML for user content');
        continue;
      }
      element.setAttribute(key, value);
    }

    // Set content safely
    if (content) {
      element.textContent = content;
    }

    return element;
  }

  // Sanitize user input
  static sanitizeInput(input) {
    // Remove script tags and event handlers
    const temp = document.createElement('div');
    temp.textContent = input;
    return temp.innerHTML
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/on\w+\s*=\s*'[^']*'/gi, '');
  }
}

// Usage
const userContent = SafeDOM.escapeHtml(userInput);
const safeElement = SafeDOM.createElement('div',
  { class: 'user-content' },
  userContent
);
```

### CSP Headers Configuration
```html
<!-- Content Security Policy -->
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline' 'unsafe-eval';
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data: https:;
               connect-src 'self' https://api.example.com;">
```

### Secure Form Handling
```javascript
// CSRF token handling
class SecureForm {
  constructor(form) {
    this.form = form;
    this.setupCSRF();
  }

  setupCSRF() {
    // Get CSRF token from meta tag
    const token = document.querySelector('meta[name="csrf-token"]')?.content;

    if (token) {
      // Add to form
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'csrf_token';
      input.value = token;
      this.form.appendChild(input);
    }
  }

  validateInput(input) {
    const value = input.value.trim();

    // Basic validation
    if (input.type === 'email') {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    if (input.type === 'url') {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }

    // Length validation
    const minLength = input.minLength || 0;
    const maxLength = input.maxLength || Infinity;
    return value.length >= minLength && value.length <= maxLength;
  }
}
```

## Real-time Updates Patterns

### Server-Sent Events (SSE)
```javascript
// Real-time updates without WebSockets
class SSEConnection {
  constructor(url) {
    this.url = url;
    this.eventSource = null;
    this.reconnectInterval = 5000;
    this.connect();
  }

  connect() {
    this.eventSource = new EventSource(this.url);

    this.eventSource.onopen = () => {
      console.log('SSE connection established');
    };

    this.eventSource.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.eventSource.onerror = () => {
      this.reconnect();
    };
  }

  handleMessage(data) {
    // Update UI based on message type
    switch(data.type) {
      case 'workout-update':
        updateWorkoutDisplay(data.payload);
        break;
      case 'user-status':
        updateUserStatus(data.payload);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  reconnect() {
    this.eventSource?.close();
    setTimeout(() => this.connect(), this.reconnectInterval);
  }

  close() {
    this.eventSource?.close();
  }
}
```

### Polling Pattern (Fallback)
```javascript
// Fallback for environments without SSE/WebSocket support
class PollingUpdater {
  constructor(url, interval = 30000) {
    this.url = url;
    this.interval = interval;
    this.lastUpdate = Date.now();
    this.timer = null;
    this.start();
  }

  async start() {
    await this.poll();
    this.timer = setInterval(() => this.poll(), this.interval);
  }

  async poll() {
    try {
      const response = await fetch(`${this.url}?since=${this.lastUpdate}`);
      const data = await response.json();

      if (data.updates && data.updates.length > 0) {
        this.processUpdates(data.updates);
        this.lastUpdate = Date.now();
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }

  processUpdates(updates) {
    updates.forEach(update => {
      // Process each update
      this.applyUpdate(update);
    });
  }

  applyUpdate(update) {
    // Apply update to UI
    const element = document.querySelector(`[data-update-id="${update.id}"]`);
    if (element) {
      element.textContent = update.value;
      element.classList.add('updated');
      setTimeout(() => element.classList.remove('updated'), 1000);
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
```

### Optimistic UI Updates
```javascript
// Update UI immediately, rollback on error
class OptimisticUpdater {
  constructor() {
    this.pendingUpdates = new Map();
  }

  async updateOptimistically(id, newValue, apiCall) {
    const element = document.getElementById(id);
    const originalValue = element.textContent;

    // Update UI immediately
    element.textContent = newValue;
    element.classList.add('pending');

    // Track pending update
    this.pendingUpdates.set(id, { originalValue, newValue });

    try {
      // Make API call
      const result = await apiCall();

      // Success - confirm update
      element.classList.remove('pending');
      element.classList.add('confirmed');
      this.pendingUpdates.delete(id);

      setTimeout(() => element.classList.remove('confirmed'), 1000);

      return result;
    } catch (error) {
      // Error - rollback
      element.textContent = originalValue;
      element.classList.remove('pending');
      element.classList.add('error');
      this.pendingUpdates.delete(id);

      setTimeout(() => element.classList.remove('error'), 1000);

      throw error;
    }
  }
}
```

## Project-Specific Patterns

### Navigation Menu
- Sticky positioning with z-index: 1000
- Solid turquesa-600 background with two-layer shadow (var(--shadow-two-layer-md))
- User email display with logout
- Active state indicators
- Mobile: icons-only below 768px

### Form Patterns
- Equipment selection with checkbox groups
- Level selection (Principiante/Intermedio/Avanzado)
- Method selection with rosa color scheme
- Validation with error states in rosa-600

### Workout Display
- Two-column layout for strength blocks
- Exercise cards with turquesa left border
- Category tags with reduced prominence
- Regeneration buttons at block and exercise level

## Quality Assurance

### Pre-deployment Checklist
1. [ ] All components follow DESIGN-SYSTEM.md
2. [ ] Shadcn components properly customized
3. [ ] Visual tests passing across viewports
4. [ ] Accessibility audit passed
5. [ ] Performance metrics met (LCP < 2.5s, FID < 100ms)
6. [ ] Cross-browser testing completed
7. [ ] Mobile experience optimized
8. [ ] Loading states implemented
9. [ ] Error states designed
10. [ ] Documentation updated

## Error Handling

### Design Fallbacks
- Missing images: Show placeholder with brand colors
- Failed component loads: Graceful degradation
- Network errors: Offline-first design patterns
- Invalid states: Clear error messaging

## Documentation Requirements

### Component Documentation
- Purpose and use cases
- Props interface with TypeScript
- Visual examples with code
- Accessibility considerations
- Performance implications

### Design Decisions
- Rationale for design choices
- Trade-offs considered
- User research insights
- A/B testing results

## Integration with Existing Tools

### Dependency Management
- **CRITICAL**: Never add new UI library dependencies
- **PRIORITY ORDER**:
  1. Pure HTML (semantic elements)
  2. HTML + CSS (styling and animations)
  3. HTML + CSS + Vanilla JS (only when necessary)
  4. React (only for React/Next.js projects)
- **ALLOWED**: HTML, CSS, JavaScript, React (when project requires), Next.js, TypeScript, Tailwind CSS
- **FORBIDDEN**: radix-ui, headless-ui, chakra-ui, material-ui, any UI component library
- **CONTEXT-DEPENDENT**: shadcn/ui for visual inspiration (avoid in app core, allow in landing pages)

### Git Workflow
- Create feature branch for UI changes
- Verify no new dependencies in package.json
- Include visual test updates in commits
- Document native implementation approach in PR
- Request design review before merge

### CI/CD Pipeline
- Run visual tests on PR
- Generate visual diff reports
- Block merge on regression
- Deploy Storybook for review

## Advanced Features

### Dynamic Theming
- Support for light/dark modes
- User preference persistence
- System preference detection
- Smooth theme transitions

### Micro-interactions
- Button press feedback
- Form validation animations
- Loading state transitions
- Success/error animations

### Progressive Enhancement
- Core functionality without JavaScript
- Enhanced experience with JS
- Graceful degradation
- Feature detection

## Monitoring & Analytics

### Performance Metrics
- Core Web Vitals tracking
- Component render times
- Bundle size monitoring
- User interaction metrics

### User Behavior
- Click heatmaps
- Scroll depth analysis
- Form completion rates
- Error tracking

## Continuous Improvement

### Iteration Process
1. Collect user feedback
2. Analyze usage patterns
3. Identify pain points
4. Design solutions
5. Test with users
6. Implement changes
7. Measure impact

### Stay Updated
- Monitor shadcn/ui releases
- Review Playwright updates
- Track design system evolution
- Incorporate new best practices

---

## Best Practices Summary

### Component Development Priority

1. **HTML First Questions**:
   - Can `<details>/<summary>` replace an accordion?
   - Can `<dialog>` replace a modal?
   - Can `<input type="date">` replace a date picker?
   - Can `<datalist>` replace an autocomplete?
   - Can `<meter>` or `<progress>` show status?

2. **CSS Second Questions**:
   - Can `:hover`, `:focus`, `:checked` handle states?
   - Can CSS Grid/Flexbox solve the layout?
   - Can CSS animations replace JS animations?
   - Can `::before`/`::after` add decorative elements?
   - Can CSS custom properties handle theming?

3. **JavaScript Third Questions**:
   - Is this interaction impossible with HTML/CSS?
   - Can a few lines of vanilla JS solve this?
   - Do we need complex state management?
   - Is the interaction critical to functionality?

4. **React Last Questions**:
   - Is this a React/Next.js project? (This one is)
   - Does it need complex state management?
   - Are there multiple components sharing state?
   - Is server-side rendering required?

### Real-world Examples

```html
<!-- GOOD: HTML-only accordion -->
<details class="faq-item">
  <summary class="faq-question">How does this work?</summary>
  <div class="faq-answer">
    It works using native HTML elements!
  </div>
</details>

<!-- AVOID: JavaScript accordion when HTML works -->
<div class="accordion" onclick="toggleAccordion()">...</div>

<!-- GOOD: CSS-only hamburger menu -->
<input type="checkbox" id="menu-toggle" class="menu-toggle">
<label for="menu-toggle" class="hamburger">☰</label>
<nav class="menu">...</nav>

<!-- AVOID: JavaScript menu when CSS checkbox pattern works -->
<button onclick="toggleMenu()">☰</button>

<!-- GOOD: Form validation with HTML5 -->
<input type="email" required pattern=".+@.+\..+">

<!-- AVOID: JavaScript validation when HTML5 attributes work -->
<input type="text" onblur="validateEmail()">
```

## Quick Reference

### Essential Files
- `DESIGN-SYSTEM.md` - Project design system
- `CLAUDE.md` - Project architecture and patterns
- `src/app/globals.css` - Global styles and variables
- `tailwind.config.ts` - Tailwind configuration
- **NO package.json modifications for UI libraries**

### Key Variables
```css
--turquesa-600: #00bec8;  /* Primary brand */
--rosa-600: #e11d48;      /* Critical actions */
--tulip-tree-500: #eab308; /* Warnings */
--font-size-button: 1.3125rem; /* 21px desktop */
--spacing-sm: 1rem;       /* 16px */
--spacing-lg: 2rem;       /* 32px */
```

### Design Reference Commands
```bash
# Browse shadcn for inspiration (DO NOT INSTALL)
# Visit: https://ui.shadcn.com/docs/components

# Study component patterns
# Analyze interactions and animations
# Extract design principles
# Implement natively with existing stack
```

### Playwright Commands
```bash
# Run visual tests
npx playwright test --grep @visual

# Update snapshots
npx playwright test --update-snapshots

# Open test report
npx playwright show-report
```

---

*This configuration ensures consistent, accessible, and performant UI/UX design aligned with the System WOD Generator project standards.*