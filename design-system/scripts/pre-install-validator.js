#!/usr/bin/env node
/**
 * Pre-install Validator for UI/UX Agent Rules
 * Intercepts npm install and asks for confirmation on risky dependencies
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class PreInstallValidator {
  constructor() {
    this.config = this.loadConfig();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  loadConfig() {
    // Try design-system config first, then root
    const designSystemConfigPath = path.join(process.cwd(), 'design-system', 'config', '.uiux-agent.config.json');
    const rootConfigPath = path.join(process.cwd(), '.uiux-agent.config.json');

    if (fs.existsSync(designSystemConfigPath)) {
      return JSON.parse(fs.readFileSync(designSystemConfigPath, 'utf8'));
    } else if (fs.existsSync(rootConfigPath)) {
      return JSON.parse(fs.readFileSync(rootConfigPath, 'utf8'));
    }
    return this.getDefaultConfig();
  }

  getDefaultConfig() {
    return {
      installationPolicy: { interceptInstalls: true, requireConfirmation: true },
      contexts: {
        'interactive-app': { strictMode: true, allowedUILibraries: [], riskLevel: 'high' },
        'landing-pages': { strictMode: false, allowedUILibraries: ['@mui/*', 'shadcn-ui'], riskLevel: 'medium' }
      }
    };
  }

  async validateInstallation() {
    // Get packages being installed from command line or package.json changes
    const packagesToInstall = this.getPackagesToInstall();

    if (packagesToInstall.length === 0) {
      console.log('✅ No UI libraries to validate');
      process.exit(0);
    }

    console.log('\n🔍 UI/UX Agent - Pre-installation Validation\n');
    console.log('📦 Packages to install:', packagesToInstall.join(', '));

    const riskAssessment = this.analyzeRisk(packagesToInstall);

    if (riskAssessment.safe) {
      console.log('✅ All packages are approved - installation proceeding...\n');
      process.exit(0);
    }

    await this.showRiskAssessment(riskAssessment);
    const decision = await this.getUserDecision(riskAssessment);

    this.logDecision(packagesToInstall, decision, riskAssessment);

    if (decision.proceed) {
      console.log('\n✅ Proceeding with installation...');
      console.log('📝 Decision logged for future reference\n');
      process.exit(0);
    } else {
      console.log('\n❌ Installation cancelled by user');
      console.log('💡 Consider using approved alternatives from UI-UX-DESIGNER-AGENT.md\n');
      process.exit(1);
    }
  }

  getPackagesToInstall() {
    // Get from npm command line arguments
    const args = process.argv.slice(2);
    const packages = [];

    // Extract package names from arguments
    for (const arg of args) {
      if (!arg.startsWith('-') && !arg.includes('=')) {
        packages.push(arg);
      }
    }

    return packages.filter(pkg => this.isUILibrary(pkg));
  }

  isUILibrary(packageName) {
    const uiLibraryPatterns = [
      '@mui', 'material-ui',
      '@chakra-ui', 'chakra-ui',
      'antd',
      'react-bootstrap',
      '@radix-ui',
      '@headlessui',
      'mantine', '@mantine',
      'styled-components',
      '@emotion',
      'theme-ui',
      'grommet',
      'evergreen-ui',
      'reakit',
      'rebass',
      'semantic-ui'
    ];

    return uiLibraryPatterns.some(pattern => packageName.includes(pattern));
  }

  analyzeRisk(packages) {
    const context = this.detectContext();
    const contextConfig = this.config.contexts[context];

    const analysis = {
      context: context,
      contextConfig: contextConfig,
      safe: true,
      risks: [],
      warnings: [],
      alternatives: [],
      packages: []
    };

    for (const pkg of packages) {
      const pkgAnalysis = this.analyzePackage(pkg, contextConfig);
      analysis.packages.push(pkgAnalysis);

      if (!pkgAnalysis.allowed) {
        analysis.safe = false;
        analysis.risks.push(pkgAnalysis.risk);
      }

      if (pkgAnalysis.warning) {
        analysis.warnings.push(pkgAnalysis.warning);
      }

      if (pkgAnalysis.alternatives) {
        analysis.alternatives = analysis.alternatives.concat(pkgAnalysis.alternatives);
      }
    }

    return analysis;
  }

  analyzePackage(packageName, contextConfig) {
    const analysis = {
      name: packageName,
      allowed: false,
      risk: null,
      warning: null,
      alternatives: []
    };

    // Check if allowed in current context
    if (contextConfig.allowedUILibraries.includes('*')) {
      analysis.allowed = true;
      analysis.warning = 'Prototyping context - all libraries allowed';
      return analysis;
    }

    // Check specific allowlist
    const isAllowed = contextConfig.allowedUILibraries.some(allowed => {
      if (allowed.endsWith('*')) {
        return packageName.startsWith(allowed.slice(0, -1));
      }
      return packageName === allowed || packageName.startsWith(allowed);
    });

    if (isAllowed) {
      analysis.allowed = true;
      analysis.warning = `Allowed in ${contextConfig.description.toLowerCase()}`;
      return analysis;
    }

    // Package not allowed - generate risk assessment
    analysis.risk = this.generateRiskAssessment(packageName, contextConfig);
    analysis.alternatives = this.suggestAlternatives(packageName);

    return analysis;
  }

  generateRiskAssessment(packageName, contextConfig) {
    const baseRisk = {
      level: contextConfig.riskLevel,
      reasons: [],
      impact: []
    };

    // Common risks for UI libraries
    baseRisk.reasons.push('Violates HTML-first philosophy');
    baseRisk.reasons.push('Adds external dependency');
    baseRisk.reasons.push('Increases bundle size');

    if (contextConfig.strictMode) {
      baseRisk.reasons.push('High-risk context (interactive app)');
      baseRisk.impact.push('Long-term maintenance burden');
      baseRisk.impact.push('Potential breaking changes');
      baseRisk.impact.push('Conflicts with design system');
    } else {
      baseRisk.impact.push('Acceptable for marketing needs');
      baseRisk.impact.push('Design flexibility trade-off');
    }

    // Package-specific risks
    if (packageName.includes('@mui')) {
      baseRisk.reasons.push('Large runtime overhead');
      baseRisk.reasons.push('Complex theme integration');
    }

    if (packageName.includes('styled-components')) {
      baseRisk.reasons.push('Runtime CSS-in-JS overhead');
      baseRisk.reasons.push('SSR complexity');
    }

    return baseRisk;
  }

  suggestAlternatives(packageName) {
    const alternatives = [];

    if (packageName.includes('@mui') || packageName.includes('material-ui')) {
      alternatives.push('HTML semantic elements (<details>, <dialog>, <progress>)');
      alternatives.push('CSS-only components with design tokens');
      alternatives.push('React components with Tailwind CSS');
    }

    if (packageName.includes('styled-components') || packageName.includes('@emotion')) {
      alternatives.push('CSS modules with design tokens');
      alternatives.push('Tailwind CSS utility classes');
      alternatives.push('CSS custom properties');
    }

    if (packageName.includes('@radix-ui')) {
      alternatives.push('Native HTML form elements');
      alternatives.push('CSS-only interactive components');
      alternatives.push('Vanilla JavaScript for complex interactions');
    }

    return alternatives;
  }

  detectContext() {
    // Analyze current working directory and recent file changes
    const cwd = process.cwd();
    const contexts = this.config.contexts;

    // Check if we're in a specific context directory
    for (const [contextName, contextConfig] of Object.entries(contexts)) {
      for (const contextPath of contextConfig.paths) {
        if (cwd.includes(contextPath) || fs.existsSync(path.join(cwd, contextPath))) {
          return contextName;
        }
      }
    }

    // Check recent git changes to infer context
    try {
      const { execSync } = require('child_process');
      const recentFiles = execSync('git diff --name-only HEAD~1..HEAD', { encoding: 'utf8' });

      for (const [contextName, contextConfig] of Object.entries(contexts)) {
        for (const contextPath of contextConfig.paths) {
          if (recentFiles.includes(contextPath)) {
            return contextName;
          }
        }
      }
    } catch (error) {
      // Git not available or no commits
    }

    return this.config.projectSpecific.defaultContext || 'interactive-app';
  }

  async showRiskAssessment(assessment) {
    console.log('='.repeat(60));
    console.log(`📍 CONTEXT: ${assessment.context}`);
    console.log(`📋 ${assessment.contextConfig.description}`);
    console.log(`🎯 Philosophy: ${assessment.contextConfig.philosophy}`);
    console.log(`⚠️  Risk Level: ${assessment.contextConfig.riskLevel.toUpperCase()}`);
    console.log('='.repeat(60));

    for (const pkg of assessment.packages) {
      console.log(`\n📦 ${pkg.name}:`);

      if (pkg.allowed) {
        console.log(`   ✅ ALLOWED - ${pkg.warning}`);
      } else {
        console.log(`   ❌ NOT RECOMMENDED`);
        console.log(`   🚨 Risk Level: ${pkg.risk.level.toUpperCase()}`);

        console.log('\n   📋 Reasons:');
        pkg.risk.reasons.forEach(reason => {
          console.log(`     • ${reason}`);
        });

        console.log('\n   🎯 Impact:');
        pkg.risk.impact.forEach(impact => {
          console.log(`     • ${impact}`);
        });

        if (pkg.alternatives.length > 0) {
          console.log('\n   💡 Recommended Alternatives:');
          pkg.alternatives.forEach(alt => {
            console.log(`     ✅ ${alt}`);
          });
        }
      }
    }

    console.log('\n' + '='.repeat(60));
  }

  async getUserDecision(assessment) {
    const hasRisks = !assessment.safe;

    if (!hasRisks) {
      return { proceed: true, reason: 'no-risks' };
    }

    console.log('\n🤔 What would you like to do?\n');
    console.log('1. ❌ Cancel installation (recommended for interactive app)');
    console.log('2. ✅ Proceed anyway (I understand the risks)');
    console.log('3. 📖 Learn more about alternatives');
    console.log('4. 🔧 Change context (if this is for landing pages)');

    const choice = await this.askQuestion('\nEnter your choice (1-4): ');

    switch (choice.trim()) {
      case '1':
        return { proceed: false, reason: 'user-cancelled' };

      case '2':
        const confirmation = await this.askQuestion('⚠️  Are you sure? Type "YES" to proceed: ');
        if (confirmation.trim().toUpperCase() === 'YES') {
          const reason = await this.askQuestion('📝 Reason for override (for documentation): ');
          return { proceed: true, reason: 'user-override', userReason: reason.trim() };
        }
        return { proceed: false, reason: 'user-cancelled' };

      case '3':
        this.showAlternatives(assessment);
        return await this.getUserDecision(assessment);

      case '4':
        await this.changeContext();
        // Re-analyze with new context
        const newAssessment = this.analyzeRisk(assessment.packages.map(p => p.name));
        if (newAssessment.safe) {
          return { proceed: true, reason: 'context-changed' };
        }
        return await this.getUserDecision(newAssessment);

      default:
        console.log('❌ Invalid choice. Please enter 1, 2, 3, or 4.');
        return await this.getUserDecision(assessment);
    }
  }

  showAlternatives(assessment) {
    console.log('\n📚 DETAILED ALTERNATIVES:\n');

    console.log('🏗️  HTML-FIRST APPROACH:');
    console.log('   • <details><summary> for accordions');
    console.log('   • <dialog> for modals');
    console.log('   • <progress> for progress bars');
    console.log('   • <input type="range"> for sliders');
    console.log('   • CSS-only dropdowns with checkbox hack');

    console.log('\n🎨 CSS-ONLY COMPONENTS:');
    console.log('   • Tooltips with ::after pseudo-elements');
    console.log('   • Tabs with :target or radio buttons');
    console.log('   • Carousels with scroll-snap');
    console.log('   • Loading spinners with CSS animations');

    console.log('\n⚛️  REACT COMPONENTS (THIS PROJECT):');
    console.log('   • Custom components with Tailwind CSS');
    console.log('   • Design system tokens (--turquesa-600, etc.)');
    console.log('   • Compound components pattern');
    console.log('   • Context + useReducer for state');

    console.log('\n📖 Full documentation: UI-UX-DESIGNER-AGENT.md\n');
  }

  async changeContext() {
    console.log('\n🔧 Available contexts:\n');

    const contexts = Object.entries(this.config.contexts);
    contexts.forEach(([name, config], index) => {
      console.log(`${index + 1}. ${name}: ${config.description}`);
      console.log(`   Risk: ${config.riskLevel}, Strict: ${config.strictMode}`);
    });

    const choice = await this.askQuestion('\nSelect context (1-' + contexts.length + '): ');
    const index = parseInt(choice.trim()) - 1;

    if (index >= 0 && index < contexts.length) {
      const [contextName] = contexts[index];

      // Update config temporarily
      this.config.projectSpecific.defaultContext = contextName;
      console.log(`✅ Context changed to: ${contextName}`);

      // Optionally save to config file
      const save = await this.askQuestion('💾 Save this context as default? (y/N): ');
      if (save.trim().toLowerCase() === 'y') {
        const configPath = path.join(process.cwd(), '.uiux-agent.config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2));
        console.log('✅ Default context saved');
      }
    } else {
      console.log('❌ Invalid choice');
    }
  }

  async askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  }

  logDecision(packages, decision, assessment) {
    if (!this.config.installationPolicy.logDecisions) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      packages: packages,
      context: assessment.context,
      decision: decision.proceed ? 'proceed' : 'cancel',
      reason: decision.reason,
      userReason: decision.userReason || null,
      riskLevel: assessment.contextConfig.riskLevel
    };

    const logFile = path.join(process.cwd(), '.uiux-decisions.log');
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }

  close() {
    this.rl.close();
  }
}

// CLI execution
if (require.main === module) {
  const validator = new PreInstallValidator();

  validator.validateInstallation()
    .then(() => {
      validator.close();
    })
    .catch((error) => {
      console.error('❌ Validation error:', error.message);
      validator.close();
      process.exit(1);
    });
}

module.exports = PreInstallValidator;