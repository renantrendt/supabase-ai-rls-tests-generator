import { SupabaseAITester } from '../src'
import { describe, it, expect } from '@jest/globals'
import dotenv from 'dotenv'

dotenv.config()

describe('SupabaseAITester', () => {
    const tester = new SupabaseAITester({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_KEY || '',
        claudeKey: process.env.CLAUDE_KEY || ''
    })

    // Added longer timeout
    it('should test RLS policies', async () => {
        const results = await tester.runRLSTests('posts')
        expect(results).toBeDefined()
        expect(Array.isArray(results)).toBe(true)
    }, 30000)  // Increased timeout to 30 seconds
})