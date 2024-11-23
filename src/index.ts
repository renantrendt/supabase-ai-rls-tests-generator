// First, remove all the current content of src/index.ts
// Then replace with this complete implementation:

import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { Database } from './types'

type SupabaseMethod = 'select' | 'insert' | 'update' | 'delete' | 'upsert'

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
  private supabase;
  private claude;
  private config: {
    testTimeout: number;
    retryAttempts: number;
    verbose: boolean;
  };

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
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
    this.claude = new Anthropic({ apiKey: claudeKey });
    this.config = {
      testTimeout: 5000,
      retryAttempts: 3,
      verbose: true,
      ...config
    };
  }

  async runRLSTests(tableName: string): Promise<TestResult[]> {
    try {
      console.log('Starting RLS tests for table:', tableName);
      const policies = await this.getRLSPolicies(tableName);
      const testCases = await this.generateTestCases(policies);
      const results = await this.executeTests(testCases);
      return this.generateReport(results);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`RLS Test failed: ${errorMessage}`);
    }
  }

  private async getRLSPolicies(tableName: string): Promise<RLSPolicy[]> {
    console.log('Fetching policies for table:', tableName);
    
    const { data, error } = await this.supabase
      .rpc('get_policies', { target_table: tableName });

    if (error) {
      throw new Error(`Failed to get RLS policies: ${error.message}`);
    }

    console.log('Received policies:', data);
    return data as RLSPolicy[];
  }

  private async generateTestCases(policies: RLSPolicy[]): Promise<TestCase[]> {
    try {
      console.log('Generating test cases with Claude...');
      
      const message = await this.claude.messages.create({
        model: "claude-3-sonnet-20240229",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `Generate test cases for these Supabase RLS policies:
            ${JSON.stringify(policies, null, 2)}
            
            Return a JSON array where each test case has this exact structure:
            {
              "name": "string",
              "description": "string",
              "method": "select" | "insert" | "update" | "delete",
              "path": "posts",
              "body": { object with test data },
              "expectedStatus": number
            }
            
            Do not include any explanatory text or markdown formatting.
            Return only the JSON array.`
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
      console.log('Parsing AI response...');
      
      // Remove any markdown formatting or extra text
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in response');
      }

      const jsonString = jsonMatch[0];
      console.log('Cleaned JSON string:', jsonString);
      
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      const testCases = parsed.map(test => ({
        method: test.method.toLowerCase() as SupabaseMethod,
        path: test.path,
        description: test.description,
        body: test.body,
        expectedStatus: test.expectedStatus
      }));

      console.log('Parsed test cases:', testCases);
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

  private generateReport(results: TestResult[]): TestResult[] {
    const summary = {
      total: results.length,
      passed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results
    };

    if (this.config.verbose) {
      console.log('Test Report:', JSON.stringify(summary, null, 2));
    }

    return results;
  }
}