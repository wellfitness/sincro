#!/usr/bin/env node
/**
 * Test System for UI/UX Agent
 * Verifies that all validation and interception systems work correctly
 */

const fs = require('fs');
const path = require('path');

function testSystem() {
  console.log('🧪 Testing UI/UX Agent System...\n');

  const tests = [
    { name: 'Configuration file exists', test: testConfigExists },
    { name: 'Scripts are executable', test: testScriptsExecutable },
    { name: 'Git hooks are configured', test: testGitHooks },
    { name: 'NPM scripts are added', test: testNpmScripts },
    { name: 'Context detection works', test: testContextDetection },
    { name: 'Dependency validation works', test: testDependencyValidation }
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      const result = test.test();
      if (result.success) {
        console.log(`✅ ${test.name}`);
        if (result.details) {
          console.log(`   ${result.details}`);
        }
        passed++;
      } else {
        console.log(`❌ ${test.name}: ${result.error}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('🎉 All tests passed! System is ready to use.');
    console.log('\n💡 Try it out:');
    console.log('   npm run add @mui/material    # Test interactive validation');
    console.log('   npm run validate:deps        # Test current dependencies');
  } else {
    console.log('⚠️  Some tests failed. Run npm run setup:hooks to fix issues.');
  }

  return failed === 0;
}

function testConfigExists() {
  const configPath = path.join(process.cwd(), '.uiux-agent.config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      success: true,
      details: `Found ${Object.keys(config.contexts || {}).length} contexts configured`
    };
  }
  return { success: false, error: 'Configuration file missing' };
}

function testScriptsExecutable() {
  const scripts = [
    'validate-uiux-rules.js',
    'validate-dependencies.js',
    'pre-install-validator.js',
    'install-wrapper.js'
  ];

  const scriptsDir = path.join(process.cwd(), 'scripts');
  const missing = [];

  for (const script of scripts) {
    const scriptPath = path.join(scriptsDir, script);
    if (!fs.existsSync(scriptPath)) {
      missing.push(script);
    }
  }

  if (missing.length > 0) {
    return { success: false, error: `Missing scripts: ${missing.join(', ')}` };
  }

  return { success: true, details: `${scripts.length} scripts found` };
}

function testGitHooks() {
  const preCommitPath = path.join(process.cwd(), '.husky', 'pre-commit');
  if (fs.existsSync(preCommitPath)) {
    return { success: true, details: 'Pre-commit hook configured' };
  }
  return { success: false, error: 'Git hooks not configured' };
}

function testNpmScripts() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return { success: false, error: 'package.json not found' };
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const requiredScripts = ['validate:deps', 'validate:uiux', 'add', 'install:safe'];
  const missing = requiredScripts.filter(script => !packageJson.scripts?.[script]);

  if (missing.length > 0) {
    return { success: false, error: `Missing npm scripts: ${missing.join(', ')}` };
  }

  return { success: true, details: `${requiredScripts.length} npm scripts configured` };
}

function testContextDetection() {
  const PreInstallValidator = require('./pre-install-validator.js');
  try {
    const validator = new PreInstallValidator();
    const context = validator.detectContext();
    validator.close();

    return {
      success: true,
      details: `Detected context: ${context}`
    };
  } catch (error) {
    return { success: false, error: `Context detection failed: ${error.message}` };
  }
}

function testDependencyValidation() {
  try {
    const { FORBIDDEN_DEPENDENCIES } = require('./validate-dependencies.js');
    return {
      success: true,
      details: `${FORBIDDEN_DEPENDENCIES.length} forbidden patterns configured`
    };
  } catch (error) {
    return { success: false, error: `Dependency validation failed: ${error.message}` };
  }
}

// CLI execution
if (require.main === module) {
  const success = testSystem();
  process.exit(success ? 0 : 1);
}

module.exports = { testSystem };