import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import chalk from 'chalk';

// Interfaces
interface EnvVars {
  supabaseUrl: string;
  supabaseKey: string;
  claudeKey: string;
}

// Constants
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => 
  new Promise((resolve) => rl.question(query, resolve));

// Helper Functions
async function checkPermissions(directory: string): Promise<boolean> {
  console.log(`\nChecking permissions for: ${directory}`);
  try {
    await access(directory, fs.constants.W_OK);
    console.log(chalk.green('✓ Write permission granted'));
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('No write permission:'), error.message);
    } else {
      console.error(chalk.red('No write permission: Unknown error'));
    }
    console.log('\nTry running with elevated permissions or check folder permissions:');
    console.log(`chmod 755 "${directory}"`);
    return false;
  }
}

async function createDirectories(): Promise<void> {
  console.log('\nSetting up directories...');
  
  const currentDir = process.cwd();
  const hasPermission = await checkPermissions(currentDir);
  if (!hasPermission) {
    throw new Error('Cannot create files in current directory');
  }

  const dirs = ['generated', 'generated/tests', 'generated/results'];
  
  for (const dir of dirs) {
    try {
      if (!fs.existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        console.log(chalk.green(`✓ Created ${dir}`));
        
        const stat = fs.statSync(dir);
        console.log(`- Permissions: ${stat.mode.toString(8)}`);
      } else {
        console.log(`Directory exists: ${dir}`);
        await checkPermissions(dir);
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Error creating directory ${dir}:`), error.message);
      }
      throw error;
    }
  }
}

// Main Functions
async function handleEnvVars(vars: EnvVars): Promise<void> {
  try {
    const envPath = '.env.rls-test';
    let envContent = '# Supabase RLS Tests Generator Configuration\n';

    // Add our variables
    envContent += `SUPABASE_RLS_URL=${vars.supabaseUrl}\n`;
    envContent += `SUPABASE_RLS_KEY=${vars.supabaseKey}\n`;
    envContent += `SUPABASE_RLS_CLAUDE_KEY=${vars.claudeKey}\n`;

    // Write to env file
    await writeFile(envPath, envContent);
    console.log(chalk.green(`✓ Environment variables saved to ${envPath}`));
    
    // Add to .gitignore if not already there
    let gitignore = '';
    const gitignorePath = '.gitignore';
    
    if (fs.existsSync(gitignorePath)) {
      gitignore = fs.readFileSync(gitignorePath, 'utf8');
    }
    
    if (!gitignore.includes('.env.rls-test')) {
      const updatedGitignore = gitignore + (gitignore.endsWith('\n') ? '' : '\n') + '.env.rls-test\n';
      await writeFile(gitignorePath, updatedGitignore);
      console.log(chalk.green('✓ Added .env.rls-test to .gitignore'));
    }

  } catch (error) {
    console.error(chalk.red('Error handling environment variables:'), 
      error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

async function createTestFile(): Promise<void> {
  const testFileContent = `// Load environment variables from .env.rls-test
require('dotenv').config({ path: '.env.rls-test' });

// Import the tester class
const { SupabaseAITester } = require('supabase-ai-rls-tests-generator');

// Create tester instance
const tester = new SupabaseAITester({
  supabaseUrl: process.env.SUPABASE_RLS_URL || '',
  supabaseKey: process.env.SUPABASE_RLS_KEY || '',
  claudeKey: process.env.SUPABASE_RLS_CLAUDE_KEY || '',
  config: {
    verbose: true
  }
});

// Run the tests
async function runTests() {
  try {
    // Change 'your_table_name' to the table you want to test
    const results = await tester.runRLSTests('your_table_name');
    console.log('Test Results:', results);
  } catch (error) {
    console.error('Test Error:', error);
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test Error:', error);
  process.exit(1);
});`;

  try {
    await writeFile('rls-test.js', testFileContent);
    console.log(chalk.green('✓ Created rls-test.js'));

    // Update or create package.json if it exists
    if (fs.existsSync('package.json')) {
      const pkgJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (!pkgJson.scripts) {
        pkgJson.scripts = {};
      }
      
      pkgJson.scripts['rls-test'] = 'node rls-test.js';
      await writeFile('package.json', JSON.stringify(pkgJson, null, 2));
      console.log(chalk.green('✓ Added rls-test script to package.json'));
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('Error creating test file:'), error.message);
    }
    throw error;
  }
}

async function runTests(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue('\nRunning tests automatically...'));
    
    const testProcess = spawn('node', ['rls-test.js'], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    testProcess.on('close', (code: number | null) => {
      if (code === 0) {
        console.log(chalk.green('✓ Tests completed successfully!'));
        resolve();
      } else {
        console.log(chalk.red(`✕ Tests failed with code ${code}`));
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    testProcess.on('error', (error: Error) => {
      console.error(chalk.red('Error running tests:'), error);
      reject(error);
    });
  });
}

// Main Wizard Function
export async function wizard(): Promise<void> {
  console.clear();
  console.log(chalk.blue.bold(`
╔═══════════════════════════════════════════╗
║     Supabase RLS Tests Generator Setup    ║
╚═══════════════════════════════════════════╝
`));

  try {
    console.log('System Check:');
    console.log(`- Platform: ${process.platform}`);
    console.log(`- User: ${process.env.USER || process.env.USERNAME}`);
    console.log(`- Working Directory: ${process.cwd()}`);
    
    // Create directories first
    await createDirectories();

    console.log('\n📝 Setting up environment variables...');
    const envVars: EnvVars = {
      supabaseUrl: await question(chalk.bold('Enter Supabase URL: ')),
      supabaseKey: await question(chalk.bold('Enter Supabase service role key: ')),
      claudeKey: await question(chalk.bold('Enter Claude API key: '))
    };

    // Handle environment variables
    await handleEnvVars(envVars);

    // Create test file
    await createTestFile();

    console.log(chalk.green.bold(`
Setup Complete! 🎉

Created files and directories:
- .env.rls-test (separate environment file for RLS tests)
- rls-test.js
- generated/
  ├── tests/
  └── results/

Next steps:
1. Your environment variables are stored in .env.rls-test
2. Edit rls-test.js to specify your table name
3. Run tests with: node rls-test.js
   Or: npm run rls-test
`));

    // Ask if they want to run tests now
    const runNow = await question(chalk.bold('Would you like to run the tests now? (y/n): '));
    if (runNow.toLowerCase() === 'y') {
      await runTests();
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red('\nSetup failed:'), error.message);
    } else {
      console.error(chalk.red('\nSetup failed with unknown error'));
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run wizard if this file is being executed directly
if (require.main === module) {
  wizard().catch(error => {
    if (error instanceof Error) {
      console.error(chalk.red('Unexpected error:'), error.message);
    } else {
      console.error(chalk.red('Unexpected unknown error'));
    }
    process.exit(1);
  });
}