import { NextResponse, type NextRequest } from 'next/server';
import { requireCredentials } from '@/lib/api-credentials';
import { Db2ConfigError, getDb2Connection, runDb2Query, type Db2Connection } from '@/lib/db2';

export const runtime = 'nodejs';

interface ParameterPayload {
  schema?: unknown;
  specificName?: unknown;
}

export async function POST(request: NextRequest): Promise<Response> {
  const credentialResult = requireCredentials(request);
  if ('response' in credentialResult) {
    return credentialResult.response;
  }
  const { credentials } = credentialResult;

  let connection: Db2Connection | null = null;

  try {
    const body: ParameterPayload = await request.json();
    const schema = parseStringField(body.schema, 'schema');
    const specificName = parseStringField(body.specificName, 'specificName');

    connection = await getDb2Connection(credentials);
    const rows = await runDb2Query(connection, PARAMETERS_SQL, [specificName, schema]);
    return NextResponse.json({ parameters: rows });
  } catch (error) {
    if (error instanceof Db2ConfigError) {
      return new Response(error.message, { status: 500 });
    }
    if (error instanceof Error && error.message.startsWith('Invalid')) {
      return new Response(error.message, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to load procedure parameters.';
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

const PARAMETERS_SQL = `
  SELECT
    ORDINAL AS \"position\",
    COALESCE(NAME, 'param_' || CAST(ORDINAL AS VARCHAR(10))) AS \"name\",
    ARGUMENT_MODE AS \"mode\",
    TYPESCHEMA AS \"typeSchema\",
    TYPENAME AS \"typeName\",
    LENGTH AS \"length\",
    SCALE AS \"scale\",
    COALESCE(DEFAULT, '') AS \"defaultValue\"
  FROM SYSCAT.ARGUMENTS
  WHERE SPECIFICNAME = ?
    AND ROUTINESCHEMA = ?
  ORDER BY ORDINAL
`;

