#!/usr/bin/env node

const chalk = require('chalk');
const path = require('path');

async function main() {
  try {
    // Check for required dependencies
    try {
      require.resolve('typescript');
      require.resolve('ts-node');
    } catch (e) {
      console.log(chalk.yellow('\nInstalling required dependencies...'));
      
      const { spawn } = require('child_process');
      await new Promise((resolve, reject) => {
        const install = spawn('npm', ['install', '-D', 'typescript', 'ts-node'], {
          stdio: 'inherit'
        });

        install.on('close', (code) => {
          if (code === 0) {
            console.log(chalk.green('✓ Dependencies installed'));
            resolve();
          } else {
            reject(new Error(`Failed to install dependencies (exit code: ${code})`));
          }
        });
      });
    }

    // Register ts-node
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'commonjs'
      }
    });

    // Create required directories
    const fs = require('fs');
    
    const requiredDirs = ['generated', 'generated/tests', 'generated/results'];
    for (const dir of requiredDirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.green(`✓ Created directory: ${dir}`));
      }
    }

    // Try to import wizard from the installed package
    try {
      const wizardPath = require.resolve('supabase-ai-rls-tests-generator/dist/src/wizard');
      const { wizard } = require(wizardPath);
      await wizard();
    } catch (importError) {
      // Fallback to local version for development
      try {
        const { wizard } = require('./wizard');
        await wizard();
      } catch (localError) {
        throw new Error('Could not find wizard module. Please ensure the package is installed correctly.');
      }
    }

  } catch (error) {
    console.error(chalk.red('\nSetup failed:'));
    if (error instanceof Error) {
      console.error(chalk.red(error.message));
      if (error.stack) {
        console.error(chalk.gray(error.stack.split('\n').slice(1).join('\n')));
      }
    } else {
      console.error(chalk.red('An unknown error occurred'));
    }
    process.exit(1);
  }
}

main().catch(error => {
  console.error(chalk.red('\nFatal error:'));
  console.error(error);
  process.exit(1);
});