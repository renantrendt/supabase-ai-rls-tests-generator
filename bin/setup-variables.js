#!/usr/bin/env node

const chalk = require('chalk');
const fs = require('fs').promises;
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function handleEnvVars() {
  try {
    console.log(chalk.cyan('\nConfiguring environment variables...'));
    
    // Get variables from user input
    const supabaseUrl = await question(chalk.yellow('Enter your Supabase URL: '));
    const supabaseKey = await question(chalk.yellow('Enter your Supabase Key: '));
    const claudeKey = await question(chalk.yellow('Enter your Claude API Key: '));

    const envPath = '.env.rls-test';
    let envContent = '# Supabase RLS Tests Generator Configuration\n';

    // Add variables
    envContent += `SUPABASE_RLS_URL=${supabaseUrl}\n`;
    envContent += `SUPABASE_RLS_KEY=${supabaseKey}\n`;
    envContent += `SUPABASE_RLS_CLAUDE_KEY=${claudeKey}\n`;

    // Write to env file
    await fs.writeFile(envPath, envContent);
    console.log(chalk.green(`✓ Environment variables saved to ${envPath}`));
    
    // Add to .gitignore if not already there
    let gitignore = '';
    const gitignorePath = '.gitignore';
    
    try {
      gitignore = await fs.readFile(gitignorePath, 'utf8');
    } catch (error) {
      // .gitignore doesn't exist, that's fine
    }
    
    if (!gitignore.includes('.env.rls-test')) {
      const updatedGitignore = gitignore + (gitignore.endsWith('\n') ? '' : '\n') + '.env.rls-test\n';
      await fs.writeFile(gitignorePath, updatedGitignore);
      console.log(chalk.green('✓ Added .env.rls-test to .gitignore'));
    }

    console.log(chalk.cyan('\nSetup complete! You can now run `npx test-rls` to generate tests.'));

  } catch (error) {
    console.error(chalk.red('Error handling environment variables:'), 
      error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Main function
async function main() {
  try {
    await handleEnvVars();
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

main();
