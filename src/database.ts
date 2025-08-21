import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

class DatabaseManager {
  private pool: Pool;
  private static instance: DatabaseManager;

  private constructor() {
    this.pool = new Pool({
      host: process.env.PGHOST,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      port: parseInt(process.env.PGPORT || '5432'),
      database: process.env.PGDATABASE,
      ssl: {
        rejectUnauthorized: false
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async getClient(): Promise<PoolClient> {
    return await this.pool.connect();
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getClient();
    try {
      const result = await client.query(text, params);
      return result;
    } finally {
      client.release();
    }
  }

  public async getSchemaInfo(): Promise<any> {
    const query = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;
    
    return await this.query(query);
  }

  public async getTableNames(): Promise<string[]> {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE';
    `;
    
    const result = await this.query(query);
    return result.rows.map((row: any) => row.table_name);
  }

  public async getColumnInfo(tableName: string): Promise<any[]> {
    const query = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `;
    
    const result = await this.query(query, [tableName]);
    return result.rows;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export default DatabaseManager; 