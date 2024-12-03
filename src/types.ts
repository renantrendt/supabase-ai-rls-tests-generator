export type Database = {
  public: {
    Tables: {
      [tableName: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
    }
  }
}

export interface TestConfig {
  coverage: 'basic' | 'full' | 'edge';
  testCount?: number;
}

export interface RLSPolicy {
  table_name: string;
  policy_name: string;
  definition: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  permissive: 'PERMISSIVE' | 'RESTRICTIVE';
}

export interface TestCase {
  method: SupabaseMethod;
  path: string;
  body?: any;
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
  expectedStatus: number;
  description: string;
}

export interface TestResult {
  test: TestCase;
  success: boolean;
  actual: number;
  expected: number;
  error?: string;
}

export interface TestSummary {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  coverage: number;
  timeInMs: number;
  failedTests: {
    description: string;
    expected: number;
    actual: number;
    error?: string;
  }[];
  details: TestResult[];
}

export type SupabaseMethod = 'select' | 'insert' | 'update' | 'delete' | 'upsert';