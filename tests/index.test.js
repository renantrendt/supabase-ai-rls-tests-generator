"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const src_1 = require("../src");
const globals_1 = require("@jest/globals");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
(0, globals_1.describe)('SupabaseAITester', () => {
    const tester = new src_1.SupabaseAITester({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_KEY || '',
        claudeKey: process.env.CLAUDE_KEY || ''
    });
    // Added longer timeout
    (0, globals_1.it)('should test RLS policies', async () => {
        const results = await tester.runRLSTests('posts');
        (0, globals_1.expect)(results).toBeDefined();
        (0, globals_1.expect)(Array.isArray(results)).toBe(true);
    }, 30000); // Increased timeout to 30 seconds
});
