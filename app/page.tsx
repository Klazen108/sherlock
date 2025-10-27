'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import Editor from 'react-simple-code-editor';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import sql from 'react-syntax-highlighter/dist/esm/languages/prism/sql';

SyntaxHighlighter.registerLanguage('sql', sql);

const DEFAULT_QUERY = `SELECT *
FROM SYSIBM.SYSTABLES
FETCH FIRST 10 ROWS ONLY;`;

type ResultRow = Record<string, unknown>;

function normalizeRow(input: unknown): ResultRow {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as ResultRow;
  }

  if (Array.isArray(input)) {
    return input.reduce<ResultRow>((acc, value, index) => {
      acc[`col_${index + 1}`] = value;
      return acc;
    }, {});
  }

  return { value: input };
}

export default function Home() {
  const [query, setQuery] = useState<string>(DEFAULT_QUERY);
  const [editorRatio, setEditorRatio] = useState<number>(0.5);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const isDraggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  const highlightQuery = useCallback(
    (code: string) =>
      renderToStaticMarkup(
        <SyntaxHighlighter
          language="sql"
          style={oneDark}
          PreTag="span"
          CodeTag="span"
          wrapLongLines
          customStyle={{
            margin: 0,
            background: 'transparent',
            padding: 0,
            display: 'block',
            whiteSpace: 'pre-wrap',
          }}
          codeTagProps={{
            style: { fontFamily: 'inherit' },
          }}
        >
          {code || ' '}
        </SyntaxHighlighter>
      ),
    []
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!isDraggingRef.current || !containerRef.current) {
        return;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const offset = event.clientY - rect.top;
      const ratio = offset / rect.height;
      const clamped = Math.min(0.8, Math.max(0.2, ratio));
      setEditorRatio(clamped);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }
      isDraggingRef.current = false;
      pointerIdRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    isDraggingRef.current = true;
    pointerIdRef.current = event.pointerId;
  }, []);

  const abortActiveQuery = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  const processRow = useCallback((line: string) => {
    if (!line) {
      return;
    }

    let parsed: unknown = line;

    try {
      parsed = JSON.parse(line);
    } catch {
      // Fallback to the raw line.
    }

    const row = normalizeRow(parsed);
    setRows((previous) => [...previous, row]);
    setColumns((previous) => {
      const next = [...previous];
      for (const key of Object.keys(row)) {
        if (!next.includes(key)) {
          next.push(key);
        }
      }
      return next;
    });
  }, []);

  const runQuery = useCallback(async () => {
    if (!query.trim()) {
      setError('Please enter a SQL statement before running the query.');
      return;
    }

    abortActiveQuery();
    setRows([]);
    setColumns([]);
    setError(null);
    setIsRunning(true);

    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      const response = await fetch('/api/db2-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Query failed.');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming is not supported in this environment.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          processRow(line);
        }
      }

      buffer += decoder.decode();
      const finalLine = buffer.trim();
      if (finalLine) {
        processRow(finalLine);
      }
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        setError('Query cancelled.');
      } else {
        const message = err instanceof Error ? err.message : 'Unexpected error while running query.';
        setError(message);
      }
    } finally {
      controllerRef.current = null;
      setIsRunning(false);
    }
  }, [abortActiveQuery, processRow, query]);

  useEffect(() => {
    return () => {
      abortActiveQuery();
    };
  }, [abortActiveQuery]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 px-6 py-4">
        <h1 className="text-lg font-semibold leading-tight text-slate-100">DB2 Query Console</h1>
        <p className="text-sm text-slate-400">
          Compose SQL, run it against IBM DB2 for z/OS, and stream the results as they arrive.
        </p>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden px-6 py-6">
          <section
            className="flex flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg"
            style={{ flexBasis: `${editorRatio * 100}%`, flexGrow: 0, flexShrink: 0 }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-sm font-medium text-slate-300">SQL Editor</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={runQuery}
                  disabled={isRunning}
                  className="rounded-md bg-sky-500 px-3 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {isRunning ? 'Running…' : 'Run Query'}
                </button>
                <button
                  type="button"
                  onClick={abortActiveQuery}
                  disabled={!isRunning}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 disabled:cursor-not-allowed disabled:border-slate-900 disabled:text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
            <label htmlFor="sql-editor" className="sr-only">
              SQL query editor
            </label>
            <div className="flex-1 overflow-hidden">
              <Editor
                value={query}
                onValueChange={setQuery}
                highlight={highlightQuery}
                padding={16}
                textareaId="sql-editor"
                textareaClassName="focus:outline-none caret-sky-400 selection:bg-sky-500/20"
                className="h-full w-full overflow-auto"
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: '0.875rem',
                  lineHeight: '1.5rem',
                  color: '#e2e8f0',
                  background: 'transparent',
                  minHeight: '100%',
                  whiteSpace: 'pre-wrap',
                }}
              />
            </div>
          </section>

          <div
            role="separator"
            aria-orientation="horizontal"
            onPointerDown={handlePointerDown}
            className="group relative z-10 flex h-4 cursor-row-resize items-center justify-center"
          >
            <div className="h-1 w-full rounded-full bg-slate-800 group-hover:bg-slate-600" />
            <div className="pointer-events-none absolute -bottom-[6px] -top-[6px] w-3 rounded-full bg-transparent group-hover:bg-slate-800/30" />
          </div>

          <section
            className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg"
            style={{ flexBasis: `${(1 - editorRatio) * 100}%` }}
          >
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-sm font-medium text-slate-300">Result Set</span>
              {isRunning && <span className="text-xs font-medium text-sky-400">Streaming…</span>}
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              {error ? (
                <div className="flex flex-1 items-center justify-center px-6 text-sm text-rose-300">
                  {error}
                </div>
              ) : rows.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
                  {isRunning ? 'Waiting for rows…' : 'Run a query to see results.'}
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full table-auto border-collapse font-mono text-xs text-slate-100">
                    <thead className="sticky top-0 z-10 bg-slate-900">
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column}
                            className="border-b border-slate-800 px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-400"
                          >
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`row-${index}`} className="odd:bg-slate-900 even:bg-slate-900/60">
                          {columns.map((column) => {
                            const value = row[column];
                            const text =
                              value === null || value === undefined
                                ? ''
                                : typeof value === 'object'
                                ? JSON.stringify(value)
                                : String(value);
                            return (
                              <td key={`${index}-${column}`} className="border-b border-slate-800 px-3 py-2">
                                <span className="break-words">{text}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
