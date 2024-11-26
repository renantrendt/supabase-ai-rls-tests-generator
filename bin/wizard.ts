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
    const envPath = '.env';
    const tempPath = '.env.temp';
    let finalContent = '';
    
    // Read existing .env if it exists
    if (fs.existsSync(envPath)) {
      const currentEnv = fs.readFileSync(envPath, 'utf8');
      
      // Split into lines and filter out any existing RLS variables
      const lines = currentEnv.split('\n').filter(line => 
        !line.startsWith('SUPABASE_RLS_URL=') &&
        !line.startsWith('SUPABASE_RLS_KEY=') &&
        !line.startsWith('SUPABASE_RLS_CLAUDE_KEY=')
      );
      
      // Ensure there's a newline at the end if we have content
      finalContent = lines.length > 0 ? lines.join('\n') + '\n' : '';
    }

    // Add our new variables
    const newVars = `
# Supabase RLS Tests Generator Configuration
SUPABASE_RLS_URL=${vars.supabaseUrl}
SUPABASE_RLS_KEY=${vars.supabaseKey}
SUPABASE_RLS_CLAUDE_KEY=${vars.claudeKey}
`;

    finalContent += newVars;

    // Write to temp file first
    await writeFile(tempPath, finalContent);

    // Verify temp file was written correctly
    if (fs.existsSync(tempPath)) {
      // Backup existing .env if it exists
      if (fs.existsSync(envPath)) {
        const backupPath = '.env.backup';
        fs.copyFileSync(envPath, backupPath);
        console.log(chalk.yellow('✓ Created backup of existing .env at .env.backup'));
      }

      // Replace .env with our temp file
      fs.renameSync(tempPath, envPath);
      console.log(chalk.green('✓ Successfully updated .env with RLS variables'));
    } else {
      throw new Error('Failed to create temporary env file');
    }

  } catch (error) {
    console.error(chalk.red('Error handling environment variables:'), 
      error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}

async function createTestFile(): Promise<void> {
  const testFileContent = `require('dotenv').config();
const { SupabaseAITester } = require('supabase-ai-rls-tests-generator');

const tester = new SupabaseAITester({
  supabaseUrl: process.env.SUPABASE_RLS_URL,
  supabaseKey: process.env.SUPABASE_RLS_KEY,
  claudeKey: process.env.SUPABASE_RLS_CLAUDE_KEY,
  config: {
    verbose: true
  }
});

async function runTests() {
  try {
    // Change 'your_table_name' to the table you want to test
    const results = await tester.runRLSTests('your_table_name');
    console.log('Test Results:', results);
  } catch (error) {
    console.error('Test Error:', error);
  }
}

runTests();`;

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
    
    const testProcess = spawn('npx', ['node', 'rls-test.js'], {
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
- Updated .env with RLS test variables (backup created as .env.backup)
- rls-test.js
- generated/
  ├── tests/
  └── results/

Next steps:
1. Edit rls-test.js to specify your table name
2. Run tests with: npm run rls-test
   Or: npx test-rls
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