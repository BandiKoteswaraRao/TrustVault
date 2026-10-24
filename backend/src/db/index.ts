import { Pool, PoolClient } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { config } from '../config/index.js';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
}

let pgPool: Pool | null = null;
let pgliteInstance: PGlite | null = null;

// Determine if we should use PGLite
function shouldUsePGlite(): boolean {
  if (config.USE_PGLITE === 'true' || config.NODE_ENV === 'test') {
    return true;
  }
  if (!config.DATABASE_URL || config.DATABASE_URL.startsWith('memory://')) {
    return true;
  }
  return false;
}

export async function getDb(): Promise<{
  query: <T = any>(sql: string, params?: any[]) => Promise<QueryResult<T>>;
  exec: (sql: string) => Promise<void>;
  transaction: <T>(fn: (client: IDatabaseClient) => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}> {
  if (shouldUsePGlite()) {
    if (!pgliteInstance) {
      const dataDir = config.NODE_ENV === 'test' ? undefined : './.pgdata';
      pgliteInstance = new PGlite(dataDir);
    }
    const instance = pgliteInstance;

    return {
      query: async <T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> => {
        const res = await instance.query<T>(sql, params || []);
        return {
          rows: res.rows,
          rowCount: res.rows.length
        };
      },
      exec: async (sql: string): Promise<void> => {
        await instance.exec(sql);
      },
      transaction: async <T>(fn: (client: IDatabaseClient) => Promise<T>): Promise<T> => {
        return await instance.transaction(async (tx) => {
          const client: IDatabaseClient = {
            query: async <R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> => {
              const res = await tx.query<R>(sql, params || []);
              return {
                rows: res.rows,
                rowCount: res.rows.length
              };
            },
            exec: async (sql: string): Promise<void> => {
              await tx.exec(sql);
            }
          };
          return await fn(client);
        });
      },
      close: async () => {
        if (pgliteInstance) {
          await pgliteInstance.close();
          pgliteInstance = null;
        }
      }
    };
  }

  // PostgreSQL Pool
  if (!pgPool) {
    const isSslRequired = config.DATABASE_URL?.includes('sslmode=require') || config.NODE_ENV === 'production';
    pgPool = new Pool({
      connectionString: config.DATABASE_URL,
      ssl: isSslRequired ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pgPool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }

  const pool = pgPool;

  return {
    query: async <T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> => {
      const res = await pool.query(sql, params || []);
      return {
        rows: res.rows,
        rowCount: res.rowCount ?? res.rows.length
      };
    },
    exec: async (sql: string): Promise<void> => {
      await pool.query(sql);
    },
    transaction: async <T>(fn: (client: IDatabaseClient) => Promise<T>): Promise<T> => {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        const dbClient: IDatabaseClient = {
          query: async <R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> => {
            const res = await client.query(sql, params || []);
            return {
              rows: res.rows,
              rowCount: res.rowCount ?? res.rows.length
            };
          },
          exec: async (sql: string): Promise<void> => {
            await client.query(sql);
          }
        };
        const result = await fn(dbClient);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: async () => {
      if (pgPool) {
        await pgPool.end();
        pgPool = null;
      }
    }
  };
}

// Convenient direct helpers using the active database
export async function query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
  const db = await getDb();
  return db.query<T>(sql, params);
}

export async function transaction<T>(fn: (client: IDatabaseClient) => Promise<T>): Promise<T> {
  const db = await getDb();
  return db.transaction<T>(fn);
}
