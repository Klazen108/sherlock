declare module 'ibm_db' {
  import type { Readable } from 'stream';

  export interface PoolConnection {
    query<T = unknown>(sql: string, params?: unknown[], callback?: (err: Error | null, data: T[]) => void): void;
    queryStream(sql: string, params?: unknown[], options?: { fetchSize?: number }): Readable;
    close(callback?: (err?: Error | null) => void): void;
    commit(callback?: (err?: Error | null) => void): void;
    rollback(callback?: (err?: Error | null) => void): void;
  }

  export class Pool {
    open(connectionString: string, callback: (err: Error | null, connection: PoolConnection) => void): void;
    open(connectionString: string): Promise<PoolConnection>;
    close(callback?: (err?: Error | null) => void): void;
    setMaxPoolSize(size: number): void;
  }

  const mod: {
    Pool: typeof Pool;
  };

  export default mod;
}
