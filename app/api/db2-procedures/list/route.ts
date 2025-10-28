import { NextResponse, type NextRequest } from 'next/server';
import { requireCredentials } from '@/lib/api-credentials';
import { Db2ConfigError, getDb2Connection, runDb2Query, type Db2Connection } from '@/lib/db2';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const credentialResult = requireCredentials(request);
  if ('response' in credentialResult) {
    return credentialResult.response;
  }
  const { credentials } = credentialResult;

  let connection: Db2Connection | null = null;

  try {
    connection = await getDb2Connection(credentials);
    const rows = await runDb2Query(connection, LIST_PROCEDURES_SQL);
    return NextResponse.json({ procedures: rows });
  } catch (error) {
    if (error instanceof Db2ConfigError) {
      return new Response(error.message, { status: 500 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load stored procedures.';
    return new Response(message, { status: 500 });
  } finally {
    if (connection) {
      connection.close(() => {});
      connection = null;
    }
  }
}

const LIST_PROCEDURES_SQL = `
  SELECT
    ROUTINESCHEMA AS "schema",
    ROUTINENAME AS "name",
    SPECIFICNAME AS "specificName",
    COALESCE(REMARKS, '') AS "remarks"
  FROM SYSCAT.ROUTINES
  WHERE ROUTINETYPE = 'P'
  ORDER BY ROUTINESCHEMA, ROUTINENAME
  FETCH FIRST 200 ROWS ONLY
`;
