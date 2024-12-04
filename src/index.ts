import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { 
  Database, 
  TestConfig, 
  RLSPolicy, 
  TestCase, 
  TestResult, 
  TestSummary, 
  SupabaseMethod 
} from './types';

// Load environment variables from .env.rls-test
config({ path: resolve(process.cwd(), '.env.rls-test') });

export class SupabaseAITester {
  private supabase;
  private claude;
  private config: {
    testTimeout: number;
    retryAttempts: number;
    verbose: boolean;
  };
  private startTime: number = 0;

  constructor({
    supabaseUrl,
    supabaseKey,
    claudeKey,
    config = {}
  }: {
    supabaseUrl: string;
    supabaseKey: string;
    claudeKey: string;
    config?: Partial<{
      testTimeout: number;
      retryAttempts: number;
      verbose: boolean;
    }>;
  }) {
    if (!supabaseUrl || !supabaseKey || !claudeKey) {
      throw new Error('Missing required parameters. Please ensure supabaseUrl, supabaseKey, and claudeKey are provided.');
    }

    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
    this.claude = new Anthropic({ apiKey: claudeKey });
    this.config = {
      testTimeout: 5000,
      retryAttempts: 3,
      verbose: true,
      ...config
    };

    this.initializeDirectories();
  }

  private initializeDirectories(): void {
    const dirs = ['generated', 'generated/tests', 'generated/results'];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async runRLSTests(tableName: string, testConfig?: TestConfig): Promise<TestResult[]> {
    this.startTime = Date.now();
    try {
      if (this.config.verbose) {
        console.log('Starting RLS tests for table:', tableName);
      }

      const policies = await this.getRLSPolicies(tableName);

      const config: TestConfig = testConfig || {
        coverage: 'basic',
        testCount: 4
      };
      const testCases = await this.generateTestCases(policies, config);
      
      await this.saveTestCases(testCases);
      const results = await this.executeTests(testCases);
      await this.saveResults(results);
      
      return this.generateReport(results, tableName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`RLS Test failed: ${errorMessage}`);
    }
  }

  private formatTestCounts({ total, passed, failed }: { total: number, passed: number, failed: number }) {
    return failed > 0 
      ? `${chalk.red(`${failed} failed`)}, ${chalk.green(`${passed} passed`)} of ${total} total`
      : chalk.green(`All ${total} tests passed`);
  }

  private calculateStats(results: TestResult[]) {
    return {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      coverage: (results.filter(r => r.success).length / results.length) * 100,
      time: Date.now() - this.startTime,
      timestamp: new Date().toISOString().replace(/[:.]/g, '-')
    };
  }

  private formatTime(ms: number): string {
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private formatCoverage(coverage: number): string {
    return `${coverage.toFixed(1)}%`;
  }

  private async getAISQLSuggestion(error: string, tableName: string): Promise<string | null> {
    try {
      const message = await this.claude.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Given this Supabase error for table "${tableName}":
          "${error}"
          
          Provide ONLY the SQL command needed to fix this issue.
          Return ONLY the SQL, no explanations or markdown.`
        }]
      });
  
      return message.content[0].text || null;
    } catch (error) {
      console.error('Error getting AI SQL suggestion:', error);
      return null;
    }
  }
  
  private async printFailedTests(results: TestResult[], tableName: string): Promise<void> {
    for (const result of results.filter(r => !r.success)) {
      console.log(chalk.red(`\n  • ${result.test.description}`));
      console.log(`    Expected: ${result.expected}, Got: ${result.actual}`);
      
      if (result.error) {
        console.log(chalk.gray(`    Error: ${result.error}`));
        
        // Get AI suggestion
        const sqlSuggestion = await this.getAISQLSuggestion(result.error, tableName);
        if (sqlSuggestion) {
          console.log(chalk.yellow('\n    To fix this, run this SQL in Supabase:'));
          console.log(chalk.gray(`    ${sqlSuggestion.replace(/\n/g, '\n    ')}`));
        }
      }
    }
  }

  private async getRLSPolicies(tableName: string): Promise<RLSPolicy[]> {
    if (this.config.verbose) {
      console.log('Fetching policies for table:', tableName);
    }
    
    try {
      const { data, error } = await this.supabase
        .rpc('get_policies', { target_table: tableName });

      if (error) {
        if (error.message.includes('Could not find the function')) {
          throw new Error(
            'The get_policies function is not installed in your Supabase database. ' +
            'Please check the documentation for installation instructions or run the SQL setup script ' +
            'in your Supabase SQL editor.'
          );
        }
        throw new Error(`Failed to get RLS policies: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.warn('No RLS policies found for table:', tableName);
      }

      if (this.config.verbose) {
        console.log('Received policies:', data);
      }
      return data as RLSPolicy[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get RLS policies: ${error.message}`);
      }
      throw new Error('Unknown error while fetching RLS policies');
    }
  }

  private async generateTestCases(policies: RLSPolicy[], config: TestConfig): Promise<TestCase[]> {
    try {
      const tableName = policies[0]?.table_name.split('.')[1] || 'unknown';
    // Calculate max_tokens based on test count
    const tokensPerTest = 250; // Average tokens needed per test case
    const baseTokens = 1000;   // Base tokens for prompt and overhead
    const maxTokens = Math.max(
      2000,
      baseTokens + (config.testCount || 4) * tokensPerTest
    );

    let promptContent = '';
   
      switch(config.coverage) {
        case 'basic':
          promptContent = `Generate ${config.testCount || 4} test cases focusing on:
          - Successful and failed SELECT operations
          - Successful and failed INSERT operations
          For each case, test both authorized and unauthorized scenarios.`;
          break;
        case 'full':
          promptContent = `Generate ${config.testCount || 8} test cases covering complete CRUD:
          - CREATE: Insert with valid/invalid data
          - READ: Select with proper/improper permissions
          - UPDATE: Modify own/others' records
          - DELETE: Remove with/without authorization
          Include equal distribution of operations and both success/failure cases.`;
          break;
        case 'edge':
          promptContent = `Generate ${config.testCount || 12} comprehensive test cases including:
          - All CRUD operations (success/failure)
          - Edge cases:
            * Empty/null values
            * Boundary conditions
            * Invalid data types
          - Security scenarios:
            * Permission escalation attempts
            * Cross-user access attempts
            * SQL injection prevention
          - Data validation edge cases
          Include thorough coverage of security implications.`;
          break;
      }
   
      const message = await this.claude.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: maxTokens, // Increased for larger test sets
        messages: [{
          role: "user",
          content: `Based on these RLS policies:
            ${JSON.stringify(policies, null, 2)}
            
            ${promptContent}
            
            Format each test case EXACTLY as:
            {
              "method": "select" | "insert" | "update" | "delete",
              "path": "${tableName}",
              "description": "clear description of test purpose and expected behavior",
              "body": {
                "user_id": "uuid-format-string",
                // additional fields based on operation
              },
              "expectedStatus": number (200 for success, 4xx for failures)
            }
   
            Return ONLY a JSON array containing these test cases.
            Number of test cases MUST match: ${config.testCount || 'default for coverage level'}
            DO NOT include any explanation or markdown - only the JSON array.`
        }]
      });
           
      const content = message.content[0].text;
      if (!content) {
        throw new Error('Claude response was empty');
      }
     
      return this.parseAIResponse(content);
    } catch (error) {
      console.error('Error generating test cases:', error);
      throw new Error(`AI test generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
   }

  private parseAIResponse(content: string): TestCase[] {
    try {
      //if (this.config.verbose) {
        //console.log('Parsing AI response...');
      //}

      const fullArrayMatch = content.match(/\[\s*{[\s\S]*}\s*\]/);
      if (!fullArrayMatch) {
        const jsonObjects = content.match(/{[^{}]*}/g);
        if (!jsonObjects) {
          throw new Error('No valid JSON content found');
        }

        content = `[${jsonObjects.join(',')}]`;
      } else {
        content = fullArrayMatch[0];
      }

      //if (this.config.verbose) {
       // console.log('Cleaned JSON:', content);
      //}

      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        throw new Error('Parsed content is not an array');
      }

      const testCases = parsed.map((test: any) => ({
        method: (test.method || 'select').toLowerCase() as SupabaseMethod,
        path: test.path,
        description: test.description || 'No description provided',
        body: test.body || null,
        expectedStatus: test.expectedStatus || 200
      }));

      return testCases;
    } catch (error) {
      console.error('Parse error:', error);
      throw new Error(`Failed to parse AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async withTimeout<T>(
    promise: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
      )
    ]);
  }

  private async saveTestCases(testCases: TestCase[]) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join('generated', 'tests', `test-cases-${timestamp}.json`);
    
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(testCases, null, 2)
    );
    
    if (this.config.verbose) {
      console.log(`Test cases saved to: ${filePath}`);
    }
  }
   
  private async saveResults(results: TestResult[]) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join('generated', 'results', `test-results-${timestamp}.json`);
    
    const stats = this.calculateStats(results);
    const summary: TestSummary = {
      timestamp,
      total: stats.total,
      passed: stats.passed,
      failed: stats.failed,
      coverage: stats.coverage,
      timeInMs: stats.time,
      failedTests: results
        .filter(r => !r.success)
        .map(r => ({
          description: r.test.description,
          expected: r.expected,
          actual: r.actual,
          error: r.error,
          sqlSuggestion: r.error ? 
            (r.error.includes('permission denied') ? 
              `ALTER TABLE ${r.test.path} ENABLE ROW LEVEL SECURITY;` : 
              undefined
            ) : undefined
        })),
      details: results // Just pass the results directly
     };
  
    await fs.promises.writeFile(
      filePath,
      JSON.stringify(summary, null, 2)
    );
    
    if (this.config.verbose) {
      console.log(chalk.blue(`\n📁 Results saved to: ${filePath}`));
    }
  }
  private generateReport(results: TestResult[], tableName: string): TestResult[] {
    console.log(chalk.bold('\n📊 Test Summary'));
    console.log('━'.repeat(50));
    
    const stats = this.calculateStats(results);
    console.log(`${chalk.bold('Results')}: ${this.formatTestCounts(stats)}`);
    console.log(`${chalk.bold('Time')}: ${this.formatTime(stats.time)}`);
    console.log(`${chalk.bold('Coverage')}: ${this.formatCoverage(stats.coverage)}`);
    
    if (stats.failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      this.printFailedTests(results, tableName);
      
      // Show complete RLS template if most tests failed
      //if (stats.failed > stats.total / 2) {
       // console.log(chalk.yellow('\n💡 Need a complete RLS setup? Here\'s a template:'));
       // console.log(chalk.gray(SQLHelper.getPolicyTemplate(tableName)));
     // }
    } else {
      console.log(chalk.green('\n✅ All tests passed!'));
    }

    return results;
  }
  private async executeTests(testCases: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const test of testCases) {
      let attempts = 0;
      let success = false;
      let error: unknown = null;

      while (attempts < this.config.retryAttempts && !success) {
        try {
          const result = await this.runSingleTest(test);
          success = true;
          results.push(result);
        } catch (e) {
          error = e;
          attempts++;
        }
      }

      if (!success) {
        results.push({
          test,
          success: false,
          actual: 500,
          expected: test.expectedStatus,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async runSingleTest(test: TestCase): Promise<TestResult> {
    return this.withTimeout(async () => {
      const { method, path, body, queryParams, headers } = test;

      let query = this.supabase.from(path);

      if (queryParams) {
        Object.entries(queryParams).forEach(([key, value]) => {
          query = (query as any).eq(key, value);
        });
      }

      let response;
      switch (method) {
        case 'select':
          response = await query.select();
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
        };
      }

      return {
        test,
        success: status === test.expectedStatus,
        actual: status,
        expected: test.expectedStatus
      };
    }, this.config.testTimeout);
  }
}