// Import required dependencies
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Database } from './types'

// Define valid Supabase database operations
// These are the methods we can use to interact with Supabase tables:
// - select: Fetch data from a table
// - insert: Add new records
// - update: Modify existing records
// - delete: Remove records
// - upsert: Update if exists, insert if doesn't exist
type SupabaseMethod = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

// Define what an RLS policy looks like
interface RLSPolicy {
 table_name: string;        // Name of the table this policy applies to
 policy_name: string;       // Name of the RLS policy
 definition: string;        // The actual policy definition (SQL)
 command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';  // Type of operation
 permissive: 'PERMISSIVE' | 'RESTRICTIVE';           // Policy mode
}

// Define what a test case should look like
interface TestCase {
 method: SupabaseMethod;                      // Supabase method
 path: string;                                // Table name
 body?: any;                                  // Request body (optional)
 queryParams?: Record<string, string>;        // Query parameters (optional)
 headers?: Record<string, string>;            // Request headers (optional)
 expectedStatus: number;                      // Expected HTTP status code
 description: string;                         // Test description
}

// Define the structure of a test result
interface TestResult {
 test: TestCase;           // The original test case
 success: boolean;         // Whether the test passed
 actual: number;           // Actual status code
 expected: number;         // Expected status code
 error?: string;          // Error message if test failed
}

interface RLSPolicy {
 table_name: string;
 policy_name: string;
 definition: string;
 command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
 permissive: 'PERMISSIVE' | 'RESTRICTIVE';
}

interface TestCase {
 method: SupabaseMethod;
 path: string;
 body?: any;
 queryParams?: Record<string, string>;
 headers?: Record<string, string>;
 expectedStatus: number;
 description: string;
}

interface TestResult {
 test: TestCase;
 success: boolean;
 actual: number;
 expected: number;
 error?: string;
}

export class SupabaseAITester {
 private supabase
 private claude

 private config = {
   testTimeout: 5000,
   retryAttempts: 3,
   verbose: true
 }

 constructor({
   supabaseUrl,
   supabaseKey,
   claudeKey,
   config = {}
 }: {
   supabaseUrl: string
   supabaseKey: string
   claudeKey: string
   config?: Partial<{
     testTimeout: number
     retryAttempts: number
     verbose: boolean
   }>
 }) {
   this.supabase = createClient<Database>(supabaseUrl, supabaseKey)
   this.claude = new Anthropic({ apiKey: claudeKey })
   this.config = { ...this.config, ...config }
 }

 async runRLSTests(tableName: string): Promise<TestResult[]> {
   try {
     const policies = await this.getRLSPolicies(tableName)
     const testCases = await this.generateTestCases(policies)
     const results = await this.executeTests(testCases)
     return this.generateReport(results)
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : 'Unknown error'
     throw new Error(`RLS Test failed: ${errorMessage}`)
   }
 }

 private async getRLSPolicies(tableName: string): Promise<RLSPolicy[]> {
    console.log('Fetching policies for table:', tableName);
    const { data, error } = await this.supabase
        .rpc('get_policies', { target_table: tableName })

   if (error) {
    console.log('Error fetching policies:', error);
     throw new Error(`Failed to get RLS policies: ${error.message}`)
   }
   console.log('Received policies:', data);
   return data as RLSPolicy[]
 }

 private async generateTestCases(policies: RLSPolicy[]): Promise<TestCase[]> {
   try {
    console.log('Generating test cases with Claude...');
     const message = await this.claude.messages.create({
       model: "claude-3-sonnet-20240229",
       max_tokens: 1000,
       messages: [{
         role: "user",
         content: `Generate test cases for these RLS policies:
           ${JSON.stringify(policies, null, 2)}
           Include tests for:
           1. Basic CRUD operations
           2. Edge cases
           3. Security vulnerabilities
           4. Format response as JSON array of test cases`
       }]
     })
     console.log('Claude response:', message.content[0].text);
     const content = message.content[0].text
     if (!content) {
       throw new Error('Claude response was empty')
     }

     return this.parseAIResponse(content)
   } catch (error) {
    console.error('Error generating test cases:', error);
     throw new Error(`AI test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
   }
 }

 // Parse and validate AI response
 private parseAIResponse(content: string): TestCase[] {
   try {
     // Parse JSON response
     const parsed = JSON.parse(content)
     
     // Validate array structure
     if (!Array.isArray(parsed)) {
       throw new Error('AI response must be an array of test cases')
     }

     // Validate each test case
     return parsed.map(test => {
       if (!test.method || !test.path || !test.expectedStatus) {
         throw new Error('Invalid test case structure')
       }
       return test as TestCase
     })
   } catch (error) {
     throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`)
   }
 }

 // Add timeout wrapper for promises
 private withTimeout<T>(
   promise: () => Promise<T>,
   timeoutMs: number
 ): Promise<T> {
   return Promise.race([
     promise(),
     new Promise<T>((_, reject) =>
       setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
     )
   ])
 }

 // Execute all tests with retry logic
 private async executeTests(testCases: TestCase[]): Promise<TestResult[]> {
   const results = []

   // Run each test case
   for (const test of testCases) {
     let attempts = 0
     let success = false
     let error = null

     // Retry logic
     while (attempts < this.config.retryAttempts && !success) {
       try {
         const result = await this.runSingleTest(test)
         success = true
         results.push(result)
       } catch (e) {
         error = e
         attempts++
       }
     }

     // Record failed test after all retries
     if (!success) {
       results.push({
         test,
         success: false,
         actual: 500,
         expected: test.expectedStatus,
         error: error instanceof Error ? error.message : 'Unknown error'
       })
     }
   }

   return results
 }

 // Run a single test with timeout
 private async runSingleTest(test: TestCase): Promise<TestResult> {
   return this.withTimeout(async () => {
     const { method, path, body, queryParams, headers } = test

     // Build query with parameters
     let query = this.supabase.from(path)

     // Add query parameters if they exist
     let queryBuilder = query
     if (queryParams) {
       Object.entries(queryParams).forEach(([key, value]) => {
         if (method === 'select') {
           queryBuilder = (queryBuilder as any).eq(key, value)
         }
       })
     }

     // Handle different methods properly
     let response;
     switch (method) {
       case 'select':
         response = await queryBuilder.select();
         break;
       case 'insert':
         response = await query.insert(body);
         break;
       case 'update':
         response = await query.update(body);
         break;
       case 'delete':
         response = await query.delete();
         break;
       case 'upsert':
         response = await query.upsert(body);
         break;
       default:
         throw new Error(`Unsupported method: ${method}`);
     }

     const { data, error, status } = response;

     if (error) {
       return {
         test,
         success: false,
         actual: status || 500,
         expected: test.expectedStatus,
         error: error.message
       }
     }

     return {
       test,
       success: status === test.expectedStatus,
       actual: status,
       expected: test.expectedStatus
     }
   }, this.config.testTimeout)
 }

 // Generate detailed test report
 private generateReport(results: TestResult[]): TestResult[] {
   // Create summary
   const summary = {
     total: results.length,
     passed: results.filter(r => r.success).length,
     failed: results.filter(r => !r.success).length,
     details: results
   }

   // Log if verbose mode is enabled
   if (this.config.verbose) {
     console.log('Test Report:', JSON.stringify(summary, null, 2))
   }

   return results
 }
}
// Example usage:
/*
const tester = new SupabaseAITester({
  supabaseUrl: 'your-project-url',
  supabaseKey: 'your-service-role-key',
  ClaudeKey: 'your-claude-key',
  config: {
    verbose: true
  }
})

// Run tests
const results = await tester.runRLSTests('your_table_name')
*/