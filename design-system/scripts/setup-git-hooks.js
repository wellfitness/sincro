#!/usr/bin/env node
/**
 * Setup script for UI/UX Agent Git Hooks
 * Configures pre-commit hooks to validate dependencies and code patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function setupGitHooks() {
  console.log('🔧 Setting up UI/UX Agent Git Hooks...\n');

  try {
    // Check if we're in a git repository
    execSync('git rev-parse --git-dir', { stdio: 'ignore' });
  } catch (error) {
    console.error('❌ Not a git repository. Initialize git first with: git init');
    process.exit(1);
  }

  // Install husky if not present
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };

    if (!allDeps.husky) {
      console.log('📦 Installing husky for git hooks...');
      try {
        execSync('npm install --save-dev husky', { stdio: 'inherit' });
        execSync('npx husky install', { stdio: 'inherit' });
        console.log('✅ Husky installed successfully\n');
      } catch (error) {
        console.error('❌ Failed to install husky:', error.message);
        console.log('💡 Install manually: npm install --save-dev husky && npx husky install');
      }
    }
  }

  // Create .husky directory if it doesn't exist
  const huskyDir = path.join(process.cwd(), '.husky');
  if (!fs.existsSync(huskyDir)) {
    fs.mkdirSync(huskyDir, { recursive: true });
  }

  // Create husky script helper
  const huskyScriptPath = path.join(huskyDir, '_', 'husky.sh');
  if (!fs.existsSync(path.dirname(huskyScriptPath))) {
    fs.mkdirSync(path.dirname(huskyScriptPath), { recursive: true });
  }

  const huskyScript = `#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    if [ "$HUSKY_DEBUG" = "1" ]; then
      echo "husky (debug) - $1"
    fi
  }

  readonly hook_name="$(basename -- "$0")"
  debug "starting $hook_name..."

  if [ "$HUSKY" = "0" ]; then
    debug "HUSKY env variable is set to 0, skipping hook"
    exit 0
  fi

  if [ -f ~/.huskyrc ]; then
    debug "sourcing ~/.huskyrc"
    . ~/.huskyrc
  fi

  readonly husky_skip_init=1
  export husky_skip_init
  sh -e "$0" "$@"
fi`;

  fs.writeFileSync(huskyScriptPath, huskyScript);
  fs.chmodSync(huskyScriptPath, 0o755);

  // Make design-system scripts executable
  const designSystemScriptsDir = path.join(__dirname);
  if (fs.existsSync(designSystemScriptsDir)) {
    const scriptFiles = [
      'validate-dependencies.js',
      'validate-uiux-rules.js',
      'pre-install-validator.js',
      'install-wrapper.js',
      'test-system.js'
    ];

    for (const script of scriptFiles) {
      const scriptPath = path.join(designSystemScriptsDir, script);
      if (fs.existsSync(scriptPath)) {
        try {
          fs.chmodSync(scriptPath, 0o755);
          console.log(`✅ Made ${script} executable`);
        } catch (error) {
          console.log(`⚠️  Could not make ${script} executable:`, error.message);
        }
      }
    }
  }

  // Copy and setup pre-commit hook from design-system
  const sourcePreCommitPath = path.join(__dirname, '..', 'hooks', 'pre-commit');
  const targetPreCommitPath = path.join(huskyDir, 'pre-commit');

  if (fs.existsSync(sourcePreCommitPath)) {
    try {
      fs.copyFileSync(sourcePreCommitPath, targetPreCommitPath);
      fs.chmodSync(targetPreCommitPath, 0o755);
      console.log('✅ Pre-commit hook installed and made executable');
    } catch (error) {
      console.log('⚠️  Could not install pre-commit hook:', error.message);
    }
  } else {
    console.log('⚠️  Pre-commit hook source not found in design-system/hooks/');
  }

  console.log('\n🎉 Git hooks setup complete!');
  console.log('\n📋 What happens now:');
  console.log('   • Pre-commit: Validates dependencies and code patterns');
  console.log('   • Blocks commits with forbidden UI libraries');
  console.log('   • Warns about hardcoded values and potential issues');
  console.log('   • Ensures compliance with UI/UX Agent guidelines');

  console.log('\n🔧 Manual commands available:');
  console.log('   npm run validate:deps     - Check dependencies only');
  console.log('   npm run validate:uiux     - Full UI/UX validation');
  console.log('   npm run setup:hooks       - Re-run this setup');

  console.log('\n📖 For full guidelines: UI-UX-DESIGNER-AGENT.md');

  // Add npm scripts to package.json
  addNpmScripts();

  // Setup install interception
  setupInstallInterception();
}

function addNpmScripts() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    // Add validation scripts
    const scriptsToAdd = {
      'validate:deps': 'node design-system/scripts/validate-dependencies.js',
      'validate:uiux': 'node design-system/scripts/validate-uiux-rules.js',
      'setup:hooks': 'node design-system/scripts/setup-git-hooks.js',
      'install:safe': 'node design-system/scripts/install-wrapper.js',
      'add': 'node design-system/scripts/install-wrapper.js',
      'test:uiux': 'node design-system/scripts/test-system.js'
    };

    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    let added = false;
    for (const [script, command] of Object.entries(scriptsToAdd)) {
      if (!packageJson.scripts[script]) {
        packageJson.scripts[script] = command;
        added = true;
      }
    }

    if (added) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log('\n✅ Added npm scripts to package.json');
    }

  } catch (error) {
    console.log('⚠️  Could not update package.json scripts:', error.message);
  }
}

// CLI execution
if (require.main === module) {
  setupGitHooks();
}

function setupInstallInterception() {
  console.log('\n🛡️  Setting up dependency interception...');

  // Make install wrapper executable
  const wrapperPath = path.join(__dirname, 'install-wrapper.js');
  const validatorPath = path.join(__dirname, 'pre-install-validator.js');

  try {
    if (fs.existsSync(wrapperPath)) {
      fs.chmodSync(wrapperPath, 0o755);
    }
    if (fs.existsSync(validatorPath)) {
      fs.chmodSync(validatorPath, 0o755);
    }
  } catch (error) {
    console.log('⚠️  Could not make scripts executable:', error.message);
  }

  console.log('\n🎯 SAFE INSTALLATION COMMANDS:');
  console.log('   npm run add <package>     - Install with validation');
  console.log('   npm run install:safe      - Safe install mode');
  console.log('   npm install               - Direct install (bypasses validation)');

  console.log('\n📋 CONTEXTS CONFIGURED:');
  console.log('   🔒 interactive-app    - Strict rules (no UI libraries)');
  console.log('   🎨 landing-pages      - Allows @mui, shadcn for marketing');
  console.log('   🚀 prototyping        - Permissive for experiments');

  console.log('\n💡 EXAMPLE USAGE:');
  console.log('   npm run add @mui/material     # Will ask for confirmation');
  console.log('   npm run add lodash            # Will warn about alternatives');
  console.log('   npm run add @types/react      # Will proceed (dev dependency)');
  console.log('   npm run test:uiux             # Test that everything works');
}

module.exports = { setupGitHooks };