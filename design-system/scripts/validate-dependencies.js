#!/usr/bin/env node
/**
 * Dependency Validator for UI/UX Agent Rules
 * Validates package.json against forbidden UI libraries
 */

const fs = require('fs');
const path = require('path');

// Forbidden UI libraries (from UI-UX-DESIGNER-AGENT.md)
const FORBIDDEN_DEPENDENCIES = [
  'radix-ui', '@radix-ui',
  'headless-ui', '@headlessui',
  'chakra-ui', '@chakra-ui',
  'material-ui', '@mui',
  'antd',
  'react-bootstrap',
  'semantic-ui',
  'grommet',
  'mantine', '@mantine',
  'evergreen-ui',
  'rebass',
  'theme-ui',
  'styled-system',
  'reakit', '@reakit',
  'styled-components',
  'emotion', '@emotion'
];

// Heavy dependencies that should be avoided
const HEAVY_DEPENDENCIES = [
  'lodash',
  'moment',
  'jquery',
  'underscore',
  'ramda'
];

function validateDependencies() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    console.log('⚠️  package.json not found');
    return true;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const allDeps = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {},
      ...packageJson.peerDependencies || {}
    };

    let hasErrors = false;
    let hasWarnings = false;

    console.log('🔍 Validating dependencies against UI/UX Agent rules...\n');

    // Check for forbidden dependencies
    for (const dep of Object.keys(allDeps)) {
      for (const forbidden of FORBIDDEN_DEPENDENCIES) {
        if (dep.includes(forbidden)) {
          console.log(`❌ FORBIDDEN: ${dep} (${allDeps[dep]})`);
          console.log(`   Reason: External UI library violates zero-dependency rule`);
          console.log(`   Solution: Use native HTML/CSS or React components\n`);
          hasErrors = true;
        }
      }
    }

    // Check for heavy dependencies
    for (const dep of Object.keys(allDeps)) {
      for (const heavy of HEAVY_DEPENDENCIES) {
        if (dep.includes(heavy)) {
          console.log(`⚠️  HEAVY: ${dep} (${allDeps[dep]})`);
          console.log(`   Reason: Heavy dependency, consider native alternatives`);
          console.log(`   Native alternatives available\n`);
          hasWarnings = true;
        }
      }
    }

    // Provide suggestions for common needs
    if (hasErrors) {
      console.log('💡 APPROVED ALTERNATIVES:\n');
      console.log('   ✅ HTML semantic elements: <details>, <dialog>, <progress>');
      console.log('   ✅ CSS-only components: tooltips, dropdowns, accordions');
      console.log('   ✅ Vanilla JavaScript classes for complex interactions');
      console.log('   ✅ React components (only for this Next.js project)');
      console.log('   ✅ Tailwind CSS for styling (already in project)\n');

      console.log('📖 Full guidelines: UI-UX-DESIGNER-AGENT.md\n');
      return false;
    }

    if (hasWarnings) {
      console.log('⚠️  Warnings found but not blocking commit');
    } else {
      console.log('✅ All dependencies comply with UI/UX Agent rules');
    }

    return true;

  } catch (error) {
    console.error('❌ Error reading package.json:', error.message);
    return false;
  }
}

// CLI execution
if (require.main === module) {
  const isValid = validateDependencies();
  process.exit(isValid ? 0 : 1);
}

module.exports = { validateDependencies, FORBIDDEN_DEPENDENCIES, HEAVY_DEPENDENCIES };