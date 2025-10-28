import { NextResponse, type NextRequest } from 'next/server';
import { requireCredentials } from '@/lib/api-credentials';
import { Db2ConfigError, getDb2Connection, type Db2Connection } from '@/lib/db2';

export const runtime = 'nodejs';

interface ExecutePayload {
  schema?: unknown;
  name?: unknown;
  parameters?: unknown;
}

export async function POST(request: NextRequest): Promise<Response> {
  const credentialResult = requireCredentials(request);
  if ('response' in credentialResult) {
    return credentialResult.response;
  }
  const { credentials } = credentialResult;

  let connection: Db2Connection | null = null;

  try {
    const body: ExecutePayload = await request.json();
    const schema = sanitizeIdentifier(parseStringField(body.schema, 'schema'));
    const name = sanitizeIdentifier(parseStringField(body.name, 'name'));
    const parameters = parseParameterValues(body.parameters);

    connection = await getDb2Connection(credentials);
    const sql = buildCallStatement(schema, name, parameters.length);
    const rows = await executeProcedure(connection, sql, parameters);
    const columns = deriveColumns(rows);

    return NextResponse.json({ rows, columns });
  } catch (error) {
    if (error instanceof Db2ConfigError) {
      return new Response(error.message, { status: 500 });
    }
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return new Response(error.message, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to execute stored procedure.';
    return new Response(message, { status: 500 });
  } finally {
    if (connection) {
      connection.close(() => {});
      connection = null;
    }
  }
}

function parseStringField(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${field}.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid ${field}.`);
  }
  return trimmed;
}

function parseParameterValues(input: unknown): unknown[] {
  if (input == null) {
    return [];
  }
  if (!Array.isArray(input)) {
    throw new Error('Invalid parameters.');
  }
  return input.map((value) => (value === '' ? null : value));
}

function sanitizeIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/u.test(value)) {
    throw new Error('Invalid identifier.');
  }
  return value;
}

function buildCallStatement(schema: string, name: string, paramCount: number): string {
  const placeholders = paramCount > 0 ? Array.from({ length: paramCount }, () => '?').join(', ') : '';
  return `CALL \"${schema}\".\"${name}\"(${placeholders})`;
}

async function executeProcedure(connection: Db2Connection, sql: string, params: unknown[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    connection.query(sql, params, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data ?? []);
    });
  });
}

function deriveColumns(rows: Array<Record<string, unknown>>): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row ?? {})) {
      columns.add(key);
    }
  }
  return Array.from(columns);
}
