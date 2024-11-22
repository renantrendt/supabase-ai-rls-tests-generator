import dotenv from 'dotenv';
dotenv.config();
//console.log('SUPABASE_URL:', process.env.SUPABASE_URL);

import { SupabaseAITester } from '../src'

describe('SupabaseAITester', () => {
  let tester: SupabaseAITester

  beforeEach(() => {
    tester = new SupabaseAITester({
      supabaseUrl: process.env.SUPABASE_URL!,
      supabaseKey: process.env.SUPABASE_KEY!,
      claudeKey: process.env.CLAUDE_API_KEY!
    })
  })

  it('should test RLS policies', async () => {
    const results = await tester.runRLSTests('users')
    expect(results).toBeDefined()
    expect(Array.isArray(results)).toBe(true)
  })
})