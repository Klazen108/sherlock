import { Pool, PoolConnection } from 'ibm_db';

const DB2_POOL_MAX = process.env.DB2_POOL_MAX;
const pools = new Map<string, Pool>();
const poolMax = Number(DB2_POOL_MAX);

export type Db2Connection = PoolConnection;

export interface Db2Credentials {
  username: string;
  password: string;
}

export class Db2ConfigError extends Error {
  constructor(message = 'DB2 configuration is invalid. DB2_DSN must be set.') {
    super(message);
    this.name = 'Db2ConfigError';
  }
}

function ensurePool(connectionString: string): Pool {
  let pool = pools.get(connectionString);
  if (!pool) {
    pool = new Pool();
    if (!Number.isNaN(poolMax) && poolMax > 0) {
      pool.setMaxPoolSize(poolMax);
    }
    pools.set(connectionString, pool);
  }
  return pool;
}

function validateCredentialValue(label: string, value: string): void {
  if (value.includes(';')) {
    throw new Error(`${label} must not contain semicolons.`);
  }
}

function resolveBaseDsn(): string {
  const baseDsn = process.env.DB2_DSN;
  if (!baseDsn) {
    throw new Db2ConfigError('DB2_DSN environment variable is required to establish a DB2 connection.');
  }
  return baseDsn;
}

export function buildConnectionString(credentials: Db2Credentials): string {
  validateCredentialValue('Username', credentials.username);
  validateCredentialValue('Password', credentials.password);

  const baseDsn = resolveBaseDsn();
  const separator = baseDsn.trim().endsWith(';') ? '' : ';';
  return `${baseDsn}${separator}UID=${credentials.username};PWD=${credentials.password}`;
}

export function runDb2Query<T = Record<string, unknown>>(
  connection: Db2Connection,
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  return new Promise<T[]>((resolve, reject) => {
    connection.query<T>(sql, params, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data ?? []);
    });
  });
}

/**
 * Obtain a pooled DB2 connection. Caller must invoke `connection.close()`
 * when finished so the connection is returned to the pool.
 */
export async function getDb2Connection(credentials: Db2Credentials): Promise<Db2Connection> {
  const connectionString = buildConnectionString(credentials);
  const pool = ensurePool(connectionString);

  return new Promise<Db2Connection>((resolve, reject) => {
    pool.open(connectionString, (error: Error | null, connection: Db2Connection) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(connection);
    });
  });
}

/**
 * Ensure the pool is gracefully drained — useful during server shutdown.
 */
export async function closeDb2Pool(): Promise<void> {
  await Promise.all(
    Array.from(pools.values()).map(
      (pool) =>
        new Promise<void>((resolve, reject) => {
          pool.close((error?: Error | null) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        })
    )
  );
  pools.clear();
}
