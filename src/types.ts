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