#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const chalk = require('chalk');

async function main() {
  try {
    // Check for test file (try both .js and .ts)
    const testFile = fs.existsSync('rls-test.js') ? 'rls-test.js' : 'rls-test.ts';
    
    if (!fs.existsSync(testFile)) {
      console.error(chalk.red('Error: No test file found. Please run setup-tests first.'));
      process.exit(1);
    }

    // If it's a .ts file, check for typescript
    if (testFile.endsWith('.ts')) {
      try {
        require.resolve('typescript');
        require.resolve('ts-node');
      } catch (e) {
        console.error(chalk.red('Error: TypeScript files require typescript and ts-node to be installed.'));
        console.log(chalk.yellow('Try running: npm install -D typescript ts-node'));
        process.exit(1);
      }
    }

    // Run the appropriate command based on file type
    const command = testFile.endsWith('.ts') ? 
      ['ts-node', '-T', testFile] : 
      ['node', testFile];

    const testProcess = spawn('npx', command, {
      stdio: 'inherit',
      env: { ...process.env }
    });

    testProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(chalk.red('Tests failed'));
        process.exit(code || 1);
      }
    });

    testProcess.on('error', (error) => {
      console.error(chalk.red('Error running tests:'), error);
      process.exit(1);
    });

  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

main();