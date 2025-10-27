import type { NextRequest } from 'next/server';
import { getDb2Connection, type Db2Connection } from '@/lib/db2';

type QueryPayload = {
  query?: unknown;
  params?: unknown;
  fetchSize?: unknown;
};

function normalizeParams(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (value == null) {
    return [];
  }

  throw new Error('`params` must be an array when provided.');
}

function normalizeFetchSize(value: unknown): number | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  throw new Error('`fetchSize` must be a positive integer when provided.');
}

export async function POST(request: NextRequest): Promise<Response> {
  let connection: Db2Connection | null = null;
  let abortHandler: (() => void) | null = null;

  try {
    const body: QueryPayload = await request.json();
    if (typeof body.query !== 'string' || body.query.trim().length === 0) {
      return new Response('`query` must be a non-empty string.', { status: 400 });
    }

    const params = normalizeParams(body.params);
    const fetchSize = normalizeFetchSize(body.fetchSize);

    connection = await getDb2Connection();

    const nodeStream = fetchSize
      ? connection.queryStream(body.query, params, { fetchSize })
      : connection.queryStream(body.query, params);

    const encoder = new TextEncoder();
    let connectionClosed = false;

    const releaseConnection = () => {
      if (!connection || connectionClosed) {
        return;
      }
      connectionClosed = true;
      if (abortHandler) {
        request.signal.removeEventListener('abort', abortHandler);
        abortHandler = null;
      }
      connection.close(() => {
        // Suppress close errors to avoid interrupting the response stream.
      });
      connection = null;
    };

    abortHandler = () => {
      nodeStream.destroy(new Error('Request aborted by the client.'));
      releaseConnection();
    };

    request.signal.addEventListener('abort', abortHandler);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        nodeStream.on('data', (row: unknown) => {
          try {
            const chunk = typeof row === 'string' ? row : JSON.stringify(row);
            controller.enqueue(encoder.encode(`${chunk}\n`));
          } catch (serializationError) {
            nodeStream.destroy(
              serializationError instanceof Error
                ? serializationError
                : new Error('Failed to serialize database row.')
            );
          }
        });

        nodeStream.on('error', (error: unknown) => {
          releaseConnection();
          controller.error(error);
        });

        nodeStream.on('end', () => {
          releaseConnection();
          controller.close();
        });

        nodeStream.on('close', releaseConnection);
      },
      cancel(reason) {
        nodeStream.destroy(
          reason instanceof Error ? reason : new Error('Response stream cancelled by consumer.')
        );
        releaseConnection();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (abortHandler) {
      request.signal.removeEventListener('abort', abortHandler);
      abortHandler = null;
    }
    if (connection) {
      connection.close(() => {
        // Connection released due to error.
      });
      connection = null;
    }
    const message = error instanceof Error ? error.message : 'Unexpected error while executing query.';
    const status = error instanceof Error && error.message.includes('must be') ? 400 : 500;
    return new Response(message, { status });
  }
}
