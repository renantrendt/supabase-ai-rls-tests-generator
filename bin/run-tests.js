#!/usr/bin/env node
// Disable deprecation warnings
process.noDeprecation = true;

const { createClient } = require('@supabase/supabase-js');
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
require('dotenv').config({ path: '.env.rls-test' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function getTables() {
  const supabase = createClient(
    process.env.SUPABASE_RLS_URL || '',
    process.env.SUPABASE_RLS_KEY || ''
  );

  try {
    // Use raw SQL query to get tables
    const { data, error } = await supabase
      .rpc('get_tables');

    // If function doesn't exist, create it
    if (error && error.message.includes('function "get_tables" does not exist')) {
      // First create the function
      const { error: createError } = await supabase
        .rpc('exec_sql', {
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
        // Create exec_sql if it doesn't exist
        await supabase.rpc('create_sql_function', {
          definition: `
            CREATE OR REPLACE FUNCTION exec_sql(sql text) 
            RETURNS void 
            LANGUAGE plpgsql 
            SECURITY DEFINER 
            AS $$
            BEGIN
              EXECUTE sql;
            END;
            $$;
          `
        });

        // Try creating get_tables again
        await supabase.rpc('exec_sql', {
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
      }

      // Now try getting tables again
      const { data: retryData, error: retryError } = await supabase
        .rpc('get_tables');

      if (retryError) throw retryError;
      return retryData ? retryData.map(item => item.table_name) : [];
    }

    if (error) throw error;
    return data ? data.map(item => item.table_name) : [];

  } catch (error) {
    console.error(chalk.red('Error fetching tables:'), error);
    return [];
  }
}

async function getTestConfig() {
  console.log(chalk.blue('\nTest Coverage Options:'));
  console.log('1. Basic (4 tests - SELECT and INSERT)');
  console.log('2. Full CRUD (8 tests - all operations)');
  console.log('3. Edge Cases (12+ tests - CRUD + security + validation)');

  const coverageAnswer = await question(chalk.yellow('\nChoose coverage level (1-3): '));
  
  const coverageMap = {
    '1': 'basic',
    '2': 'full',
    '3': 'edge'
  };

  const coverage = coverageMap[coverageAnswer];

  const customCount = await question(chalk.yellow('\nCustom number of test cases? (Enter number or press Enter for default): '));
  const testCount = customCount ? parseInt(customCount) : undefined;

  if (coverage === 'edge') {
    console.log(chalk.yellow('\nNote: Edge cases testing will use more API calls and take longer.'));
    const confirm = await question('Continue? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      process.exit(0);
    }
  }

  return { coverage, testCount };
}

async function generateTestFile(tableName, config) {
  const testContent = `
require('dotenv').config({ path: '.env.rls-test' });
const { SupabaseAITester } = require('supabase-ai-rls-tests-generator');

const tester = new SupabaseAITester({
  supabaseUrl: process.env.SUPABASE_RLS_URL || '',
  supabaseKey: process.env.SUPABASE_RLS_KEY || '',
  claudeKey: process.env.SUPABASE_RLS_CLAUDE_KEY || '',
  config: { verbose: true }
});

async function runTests() {
  try {
    const results = await tester.runRLSTests('${tableName}', ${JSON.stringify(config)});
    console.log('Test Results:', results);
  } catch (error) {
    console.error('Test Error:', error);
    process.exit(1);
  }
}

runTests();`;

  await fs.promises.writeFile('rls-test.js', testContent);
}

async function runTest(tableName, config) {
  await generateTestFile(tableName, config);
  
  const { spawn } = require('child_process');
  const testProcess = spawn('node', ['--no-deprecation', 'rls-test.js'], {
    stdio: 'inherit'
  });

  return new Promise((resolve, reject) => {
    testProcess.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test failed with code ${code}`));
      }
    });
  });
}

async function main() {
  try {
    console.log(chalk.blue.bold('\n📊 Supabase RLS Test Runner'));
    
    // Verify credentials
    if (!process.env.SUPABASE_RLS_URL || !process.env.SUPABASE_RLS_KEY) {
      console.log(chalk.red('\nMissing Supabase credentials!'));
      console.log(chalk.yellow('Please run setup-tests first to configure your credentials.'));
      process.exit(1);
    }

    // List available tables with RLS Policies
    console.log(chalk.yellow('\nFetching tables...'));
    const tables = await getTables();
    
    if (tables.length === 0) {
      console.log(chalk.red('\nNo tables found! Please check:'));
      console.log(chalk.yellow('1. Your Supabase credentials are correct'));
      console.log(chalk.yellow('2. You have tables in your public schema'));
      console.log(chalk.yellow('3. You have necessary permissions'));
      process.exit(1);
    }

    console.log(chalk.green('\nAvailable tables:'));
    tables.forEach((tableName, index) => {
      console.log(chalk.blue(`${index + 1}. ${tableName}`));
    });

    // Get table selection
    const answer = await question(chalk.yellow('\nEnter the number of the table to test: '));
    const tableIndex = parseInt(answer) - 1;

    if (isNaN(tableIndex) || tableIndex < 0 || tableIndex >= tables.length) {
      console.log(chalk.red('Invalid table number!'));
      process.exit(1);
    }

    const selectedTable = tables[tableIndex];
    console.log(chalk.green(`\nRunning tests for table: ${selectedTable}`));

    // Get test config
    const config = await getTestConfig();

    // Now run the test with both selectedTable and config
    await runTest(selectedTable, config);
    
    console.log(chalk.green('\n✅ Tests completed!'));
    console.log(chalk.blue('Check the generated/ directory for results / Or scroll up here to read logs.'));

  } catch (error) {
    console.error(chalk.red('\nError:'), error.message || error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();