export class SQLHelper {
  static getSQLSuggestion(error: string, tableName: string): string | null {
    // Basic SQL suggestion logic
    if (error.includes('permission denied')) {
      return `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`;
    }
    return null;
  }
} 