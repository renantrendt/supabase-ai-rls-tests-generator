import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';

// Interfaces
interface EnvVars {
  supabaseUrl: string;
  supabaseKey: string;
  claudeKey: string;
}

interface TableItem {
  table_name: string;
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

async function getTables(supabase: any) {
  try {
    const { data, error } = await supabase.rpc('get_tables');

    if (error && error.message.includes('function "get_tables" does not exist')) {
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE OR REPLACE FUNCTION get_tables()
          RETURNS TABLE (table_name text) 
          LANGUAGE plpgsql
          SECURITY DEFINER 
          AS $$
          BEGIN
              RETURN QUERY 
              SELECT tablename::text
              FROM pg_catalog.pg_tables
              WHERE schemaname = 'public'
              AND tablename NOT LIKE 'pg_%';
          END;
          $$;
        `
      });

      if (createError) {
        throw new Error(`Failed to create get_tables function: ${createError.message}`);
      }

      const { data: retryData, error: retryError } = await supabase.rpc('get_tables');
      if (retryError) throw retryError;
      return retryData ? retryData.map((item: TableItem) => item.table_name) : [];
    }

    if (error) throw error;
    return data ? data.map((item: TableItem) => item.table_name) : [];
  } catch (error) {
    console.error(chalk.red('Error fetching tables:'), error);
    return [];
  }
}

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

async function runTests(tableName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(chalk.blue('\nRunning RLS Tests Runner...'));
    
    const testProcess = spawn('node', ['--no-deprecation', 'rls-test.js', tableName], {
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
    
    await createDirectories();

    console.log('\n📝 Setting up environment variables...');
    const envVars: EnvVars = {
      supabaseUrl: await question(chalk.bold('Enter Supabase URL: ')),
      supabaseKey: await question(chalk.bold('Enter Supabase service role key: ')),
      claudeKey: await question(chalk.bold('Enter Claude API key: '))
    };

    await handleEnvVars(envVars);

    // Criar cliente Supabase para buscar tabelas
    const supabase = createClient(envVars.supabaseUrl, envVars.supabaseKey);

    // Buscar e mostrar tabelas disponíveis
    console.log(chalk.yellow('\nFetching available tables...'));
    const tables = await getTables(supabase);
    
    if (tables.length === 0) {
      console.log(chalk.red('\nNo tables found! Please check:'));
      console.log(chalk.yellow('1. Your Supabase credentials are correct'));
      console.log(chalk.yellow('2. You have tables in your public schema'));
      console.log(chalk.yellow('3. You have necessary permissions'));
      throw new Error('No tables available for testing');
    }

    console.log(chalk.green('\nAvailable tables:'));
    tables.forEach((tableName: string, index: number) => {
      console.log(chalk.blue(`${index + 1}. ${tableName}`));
    });

    const tableAnswer = await question(chalk.bold('\nSelect a table to test (enter number): '));
    const selectedIndex = parseInt(tableAnswer) - 1;

    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= tables.length) {
      throw new Error('Invalid table selection');
    }

    const selectedTable = tables[selectedIndex];

    console.log(chalk.green.bold(`
Setup Complete! 🎉

Created files and directories:
- .env.rls-test (environment file for RLS tests)
- generated/
  ├── tests/
  └── results/

Selected table: ${selectedTable}

Next steps:
1. Your environment variables are stored in .env.rls-test
2. Generated directories will store test cases and results
3. Use 'npx test-rls' to run tests for specific tables
`));

    const runNow = await question(chalk.bold('Would you like to run the tests now? (y/n): '));
    if (runNow.toLowerCase() === 'y') {
      await runTests(selectedTable);
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