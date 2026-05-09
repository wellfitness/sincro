#!/usr/bin/env node
/**
 * NPM Install Wrapper for UI/UX Agent
 * Intercepts npm install commands and validates dependencies
 */

const { spawn } = require('child_process');
const path = require('path');

async function runInstallation() {
  const args = process.argv.slice(2);

  // If no packages specified, just run npm install normally
  if (args.length === 0 || args.every(arg => arg.startsWith('-'))) {
    return runNpmInstall(args);
  }

  console.log('🔍 UI/UX Agent intercepting installation...\n');

  try {
    // Run pre-install validation
    const validatorPath = path.join(__dirname, 'pre-install-validator.js');
    const validationResult = await runCommand('node', [validatorPath, ...args]);

    if (validationResult.code === 0) {
      // Validation passed, proceed with installation
      return runNpmInstall(args);
    } else {
      // Validation failed or user cancelled
      console.log('\n❌ Installation cancelled due to validation failure');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Validation error:', error.message);

    // Ask user if they want to proceed anyway
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('⚠️  Validation failed. Proceed anyway? (y/N): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'y') {
          console.log('⚠️  Proceeding without validation...');
          resolve(runNpmInstall(args));
        } else {
          console.log('❌ Installation cancelled');
          process.exit(1);
        }
      });
    });
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve({ code });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

function runNpmInstall(args) {
  console.log('📦 Running npm install...\n');

  return runCommand('npm', ['install', ...args])
    .then((result) => {
      if (result.code === 0) {
        console.log('\n✅ Installation completed successfully!');

        // Run post-install validation
        const postValidatorPath = path.join(__dirname, 'validate-dependencies.js');
        console.log('\n🔍 Running post-install validation...');
        return runCommand('node', [postValidatorPath]);
      } else {
        console.log('\n❌ Installation failed');
        process.exit(result.code);
      }
    })
    .catch((error) => {
      console.error('❌ Installation error:', error.message);
      process.exit(1);
    });
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n❌ Installation cancelled by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n\n❌ Installation terminated');
  process.exit(1);
});

if (require.main === module) {
  runInstallation();
}

module.exports = { runInstallation };