import ibmdb, { PoolConnection } from 'ibm_db';

const pool = new ibmdb.Pool();

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} environment variable is required to establish a DB2 connection.`);
  }
  return value;
}

const DB2_DSN = getRequiredEnvVar('DB2_DSN');
const DB2_POOL_MAX = process.env.DB2_POOL_MAX;

const poolMax = Number(DB2_POOL_MAX);
if (!Number.isNaN(poolMax) && poolMax > 0) {
  pool.setMaxPoolSize(poolMax);
}

export type Db2Connection = PoolConnection;

/**
 * Obtain a pooled DB2 connection. Caller must invoke `connection.close()`
 * when finished so the connection is returned to the pool.
 */
export async function getDb2Connection(): Promise<Db2Connection> {
  return new Promise<Db2Connection>((resolve, reject) => {
    pool.open(DB2_DSN, (error: Error | null, connection: Db2Connection) => {
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
  return new Promise<void>((resolve, reject) => {
    pool.close((error?: Error | null) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
