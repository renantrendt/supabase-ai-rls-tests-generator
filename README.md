# Supabase AI Test Generator

AI-powered RLS (Row Level Security) testing tool for Supabase projects.

## Features
- 🤖 Automatic RLS policy detection
- 🧪 AI-generated test cases
- 🔒 Comprehensive security testing
- 📊 Detailed test reporting
- ⚡ Timeout and retry mechanisms

## Installation
npm install supabase-ai-tester

## Usage
import { SupabaseAITester } from 'supabase-ai-tester'

const tester = new SupabaseAITester({
 supabaseUrl: process.env.SUPABASE_URL,
 supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
 claudeKey: process.env.OPENAI_KEY
})

## Run tests for specific table
const results = await tester.runRLSTests('your_table_name')

## Configuration
const tester = new SupabaseAITester({
 supabaseUrl: 'your-project-url',
 supabaseKey: 'your-service-role-key',
 openaiKey: 'your-openai-key',
 config: {
   testTimeout: 5000,      // Maximum time (ms) for each test
   retryAttempts: 3,       // Number of retries for failed tests
   verbose: true           // Show detailed logs
 }
})

## Requirements
- Supabase project with RLS enabled
- Service role key (not anon key)
- OpenAI API key
- Node.js 16+

## Sample Output
const results = await tester.runRLSTests('users')
// Returns:
{
 total: 10,
 passed: 8,
 failed: 2,
 details: [
   {
     test: {
       method: 'select',
       path: 'users',
       description: 'User can read own data'
     },
     success: true,
     actual: 200,
     expected: 200
   },
   // ... more test results
 ]
}

## License
MIT - See LICENSE file

## Author
Renan Serrano