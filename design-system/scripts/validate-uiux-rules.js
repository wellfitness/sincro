#!/usr/bin/env node
/**
 * UI/UX Agent Rules Validator
 * Validates code against the UI/UX Designer Agent guidelines
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class UIUXValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.rules = this.loadRules();
  }

  loadRules() {
    return {
      // Forbidden UI libraries
      forbiddenDependencies: [
        'radix-ui', '@radix-ui', 'headless-ui', '@headlessui',
        'chakra-ui', '@chakra-ui', 'material-ui', '@mui',
        'antd', 'react-bootstrap', 'semantic-ui', 'grommet',
        'mantine', '@mantine', 'evergreen-ui', 'rebass',
        'theme-ui', 'styled-system', 'reakit', '@reakit'
      ],

      // Design system variables that should be used
      designTokens: [
        '--turquesa-600', '--rosa-600', '--tulip-tree-500',
        '--font-family-headings', '--font-family-body',
        '--font-size-button', '--spacing-', '--color-primary'
      ],

      // Forbidden patterns
      antiPatterns: [
        { pattern: /innerHTML\s*=/, message: 'Avoid innerHTML for user content (XSS risk)' },
        { pattern: /document\.write/, message: 'Avoid document.write (security risk)' },
        { pattern: /eval\s*\(/, message: 'Avoid eval() (security risk)' },
        { pattern: /dangerouslySetInnerHTML/, message: 'Avoid dangerouslySetInnerHTML without sanitization' },
        { pattern: /style\s*=\s*["'][^"']*position\s*:\s*fixed/, message: 'Prefer CSS classes over inline styles for positioning' },
      ],

      // Required patterns for accessibility
      a11yRequirements: [
        { file: /\.tsx?$/, pattern: /aria-label|aria-labelledby|aria-describedby/, required: false },
        { file: /button|input|select/, pattern: /type=["']/, required: true },
      ],

      // HTML-first alternatives
      htmlFirstAlternatives: [
        { pattern: /class.*accordion/i, suggestion: 'Consider using <details><summary> for accordions' },
        { pattern: /class.*modal/i, suggestion: 'Consider using <dialog> element for modals' },
        { pattern: /class.*dropdown/i, suggestion: 'Consider CSS-only dropdown with checkbox pattern' },
        { pattern: /class.*tooltip/i, suggestion: 'Consider CSS-only tooltip with ::after pseudo-element' },
      ],
    };
  }

  async validateProject(projectPath = '.') {
    console.log('🔍 Starting UI/UX Agent Rules Validation...\n');

    // 1. Check package.json for forbidden dependencies
    await this.checkDependencies(projectPath);

    // 2. Check source files for violations
    await this.checkSourceFiles(projectPath);

    // 3. Check CSS for design token usage
    await this.checkDesignTokenUsage(projectPath);

    // 4. Check accessibility compliance
    await this.checkAccessibility(projectPath);

    // 5. Generate report
    this.generateReport();
  }

  async checkDependencies(projectPath) {
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      this.warnings.push('package.json not found');
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {},
      ...packageJson.peerDependencies || {}
    };

    for (const dep of Object.keys(allDeps)) {
      for (const forbidden of this.rules.forbiddenDependencies) {
        if (dep.includes(forbidden)) {
          this.errors.push(`❌ Forbidden UI library dependency: ${dep} (violates zero-dependency rule)`);
        }
      }
    }

    // Check for heavy dependencies that could be replaced
    const heavyDeps = ['lodash', 'moment', 'jquery'];
    for (const dep of Object.keys(allDeps)) {
      if (heavyDeps.some(heavy => dep.includes(heavy))) {
        this.warnings.push(`⚠️  Heavy dependency detected: ${dep} (consider native alternatives)`);
      }
    }
  }

  async checkSourceFiles(projectPath) {
    const extensions = ['.js', '.jsx', '.ts', '.tsx', '.css', '.scss'];
    const files = this.getFilesRecursively(projectPath, extensions);

    for (const file of files) {
      if (this.shouldSkipFile(file)) continue;

      const content = fs.readFileSync(file, 'utf8');
      this.validateFileContent(file, content);
    }
  }

  validateFileContent(filePath, content) {
    const relativePath = path.relative('.', filePath);

    // Check for anti-patterns
    for (const antiPattern of this.rules.antiPatterns) {
      if (antiPattern.pattern.test(content)) {
        this.errors.push(`❌ ${relativePath}: ${antiPattern.message}`);
      }
    }

    // Check for HTML-first alternatives
    for (const alternative of this.rules.htmlFirstAlternatives) {
      if (alternative.pattern.test(content)) {
        this.warnings.push(`💡 ${relativePath}: ${alternative.suggestion}`);
      }
    }

    // Check for hardcoded values instead of design tokens
    const hardcodedColors = content.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}/g);
    if (hardcodedColors) {
      for (const color of hardcodedColors) {
        if (!this.isAllowedHardcodedColor(color)) {
          this.warnings.push(`🎨 ${relativePath}: Hardcoded color ${color}, consider using design tokens`);
        }
      }
    }

    // Check for hardcoded spacing
    const hardcodedSpacing = content.match(/padding:\s*\d+px|margin:\s*\d+px/g);
    if (hardcodedSpacing) {
      this.warnings.push(`📏 ${relativePath}: Hardcoded spacing detected, use --spacing-* tokens`);
    }

    // Check for external UI library imports
    const uiLibraryImports = content.match(/import.*from\s+['"](@mui|@chakra-ui|antd|react-bootstrap)['"]/g);
    if (uiLibraryImports) {
      for (const importLine of uiLibraryImports) {
        this.errors.push(`❌ ${relativePath}: ${importLine} - Use native HTML/CSS instead`);
      }
    }
  }

  async checkDesignTokenUsage(projectPath) {
    const cssFiles = this.getFilesRecursively(projectPath, ['.css', '.scss']);
    let tokenUsageCount = 0;
    let totalStyleRules = 0;

    for (const file of cssFiles) {
      if (this.shouldSkipFile(file)) continue;

      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative('.', file);

      // Count CSS rules
      const rules = content.match(/[^{}]+\{[^{}]*\}/g) || [];
      totalStyleRules += rules.length;

      // Count design token usage
      for (const token of this.rules.designTokens) {
        const tokenRegex = new RegExp(`var\\(${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
        const matches = content.match(tokenRegex);
        if (matches) {
          tokenUsageCount += matches.length;
        }
      }

      // Check for direct design system compliance
      const hasSystemColors = /var\(--turquesa-|var\(--rosa-|var\(--tulip-tree-/.test(content);
      const hasSystemSpacing = /var\(--spacing-/.test(content);
      const hasSystemFonts = /var\(--font-family-|var\(--font-size-/.test(content);

      if (rules.length > 5 && !hasSystemColors && !hasSystemSpacing && !hasSystemFonts) {
        this.warnings.push(`🎨 ${relativePath}: Consider using design system tokens`);
      }
    }

    if (totalStyleRules > 0) {
      const tokenUsagePercentage = (tokenUsageCount / totalStyleRules) * 100;
      if (tokenUsagePercentage < 30) {
        this.warnings.push(`📊 Low design token usage: ${tokenUsagePercentage.toFixed(1)}% (aim for >50%)`);
      }
    }
  }

  async checkAccessibility(projectPath) {
    const htmlFiles = this.getFilesRecursively(projectPath, ['.html', '.tsx', '.jsx']);

    for (const file of htmlFiles) {
      if (this.shouldSkipFile(file)) continue;

      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative('.', file);

      // Check for missing alt attributes
      const imgTags = content.match(/<img[^>]*>/g) || [];
      for (const img of imgTags) {
        if (!img.includes('alt=')) {
          this.errors.push(`♿ ${relativePath}: Image missing alt attribute`);
        }
      }

      // Check for buttons without accessible names
      const buttonTags = content.match(/<button[^>]*>.*?<\/button>/g) || [];
      for (const button of buttonTags) {
        if (!button.includes('aria-label') && !button.match(/>([^<]+)</)) {
          this.warnings.push(`♿ ${relativePath}: Button may need accessible name`);
        }
      }

      // Check for form inputs without labels
      const inputTags = content.match(/<input[^>]*>/g) || [];
      for (const input of inputTags) {
        const inputId = input.match(/id=["']([^"']+)["']/);
        if (inputId) {
          const labelPattern = new RegExp(`<label[^>]*for=["']${inputId[1]}["']`);
          if (!labelPattern.test(content) && !input.includes('aria-label')) {
            this.warnings.push(`♿ ${relativePath}: Input ${inputId[1]} missing label`);
          }
        }
      }
    }
  }

  getFilesRecursively(dir, extensions) {
    const files = [];

    function traverse(currentDir) {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory() && !fullPath.includes('node_modules') && !fullPath.includes('.git')) {
          traverse(fullPath);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  shouldSkipFile(filePath) {
    const skipPatterns = [
      /node_modules/,
      /\.git/,
      /\.next/,
      /dist/,
      /build/,
      /coverage/,
      /\.min\./,
      /vendor/
    ];

    return skipPatterns.some(pattern => pattern.test(filePath));
  }

  isAllowedHardcodedColor(color) {
    const allowedColors = [
      '#ffffff', '#fff', '#000000', '#000',
      '#transparent', 'transparent'
    ];
    return allowedColors.includes(color.toLowerCase());
  }

  generateReport() {
    console.log('\n📋 UI/UX Agent Validation Report\n');
    console.log('='.repeat(50));

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All checks passed! Code follows UI/UX Agent guidelines.');
      process.exit(0);
    }

    if (this.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.errors.length}):`);
      this.errors.forEach(error => console.log(`  ${error}`));
    }

    if (this.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    console.log('\n📖 For more information, see: UI-UX-DESIGNER-AGENT.md');
    console.log('='.repeat(50));

    // Exit with error code if there are errors
    process.exit(this.errors.length > 0 ? 1 : 0);
  }
}

// CLI interface
if (require.main === module) {
  const projectPath = process.argv[2] || '.';
  const validator = new UIUXValidator();
  validator.validateProject(projectPath);
}

module.exports = UIUXValidator;