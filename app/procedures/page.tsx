'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppNav } from '@/components/AppNav';
import { CredentialsModal } from '@/components/CredentialsModal';
import { useDb2Credentials } from '../hooks/useDb2Credentials';

type ProcedureSummary = {
  schema: string;
  name: string;
  specificName: string;
  remarks: string;
};

type ProcedureParameter = {
  position: number;
  name: string;
  mode: string;
  typeSchema: string;
  typeName: string;
  length: number | null;
  scale: number | null;
  defaultValue: string;
};

type ResultRow = Record<string, unknown>;

export default function StoredProceduresPage() {
  const {
    hasCredentials,
    credentialsModalOpen,
    initializingCredentials,
    credentialsSubmitting,
    credentialsError,
    usernameInput,
    passwordInput,
    openCredentialsModal,
    closeCredentialsModal,
    setUsernameInput,
    setPasswordInput,
    submitCredentials,
    clearCredentials,
  } = useDb2Credentials();

  const [procedures, setProcedures] = useState<ProcedureSummary[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureSummary | null>(null);
  const [parameters, setParameters] = useState<ProcedureParameter[]>([]);
  const [parameterValues, setParameterValues] = useState<Record<number, string>>({});
  const [procedureSearch, setProcedureSearch] = useState<string>('');
  const [isLoadingProcedures, setIsLoadingProcedures] = useState<boolean>(false);
  const [isLoadingParameters, setIsLoadingParameters] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const filteredProcedures = useMemo(() => {
    if (!procedureSearch.trim()) {
      return procedures;
    }
    const needle = procedureSearch.trim().toLowerCase();
    return procedures.filter((proc) => {
      const combined = `${proc.schema}.${proc.name}`.toLowerCase();
      return combined.includes(needle) || proc.remarks?.toLowerCase().includes(needle);
    });
  }, [procedureSearch, procedures]);

  const handleOpenCredentialsModal = useCallback(() => {
    openCredentialsModal();
  }, [openCredentialsModal]);

  const handleCredentialsCancel = useCallback(() => {
    if (hasCredentials) {
      closeCredentialsModal();
    }
  }, [closeCredentialsModal, hasCredentials]);

  const resetProcedureState = useCallback(() => {
    setSelectedProcedure(null);
    setParameters([]);
    setParameterValues({});
    setRows([]);
    setColumns([]);
    setInfoMessage(null);
    setError(null);
  }, []);

  const handleClearCredentials = useCallback(async () => {
    await clearCredentials();
    resetProcedureState();
    setProcedures([]);
  }, [clearCredentials, resetProcedureState]);

  const fetchProcedures = useCallback(async () => {
    if (!hasCredentials) {
      return;
    }

    setIsLoadingProcedures(true);
    setError(null);
    setInfoMessage(null);

    try {
      const response = await fetch('/api/db2-procedures/list', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 401) {
        const message = await response.text();
        await clearCredentials();
        openCredentialsModal(message || 'Credentials are required to view stored procedures.');
        resetProcedureState();
        setProcedures([]);
        return;
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to load stored procedures.');
      }

      const payload: { procedures?: ProcedureSummary[] } = await response.json();
      const items = payload.procedures ?? [];
      setProcedures(items);
      if (items.length > 0) {
        setSelectedProcedure((current) => current ?? items[0]);
      } else {
        resetProcedureState();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load stored procedures.';
      setError(message);
    } finally {
      setIsLoadingProcedures(false);
    }
  }, [clearCredentials, hasCredentials, openCredentialsModal, resetProcedureState]);

  const fetchParameters = useCallback(
    async (procedure: ProcedureSummary) => {
      setIsLoadingParameters(true);
      setError(null);
      setInfoMessage(null);

      try {
        const response = await fetch('/api/db2-procedures/parameters', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            schema: procedure.schema,
            specificName: procedure.specificName,
          }),
        });

        if (response.status === 401) {
          const message = await response.text();
          await clearCredentials();
          openCredentialsModal(message || 'Credentials are required to view parameters.');
          resetProcedureState();
          setProcedures([]);
          return;
        }

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || 'Failed to load procedure parameters.');
        }

        const payload: { parameters?: ProcedureParameter[] } = await response.json();
        const items = (payload.parameters ?? []).sort((a, b) => a.position - b.position);
        setParameters(items);
        setParameterValues(
          items.reduce<Record<number, string>>((acc, param) => {
            acc[param.position] = param.defaultValue ?? '';
            return acc;
          }, {})
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load procedure parameters.';
        setError(message);
      } finally {
        setIsLoadingParameters(false);
      }
    },
    [clearCredentials, openCredentialsModal, resetProcedureState]
  );

  const executeProcedure = useCallback(async () => {
    if (!selectedProcedure) {
      setError('Please select a stored procedure to execute.');
      return;
    }

    if (!hasCredentials) {
      openCredentialsModal('Please enter your DB2 credentials before running a stored procedure.');
      setError('Please enter your DB2 credentials before running a stored procedure.');
      return;
    }

    setIsExecuting(true);
    setError(null);
    setInfoMessage(null);

    const orderedParameters = [...parameters].sort((a, b) => a.position - b.position);
    const values = orderedParameters.map((param) => parameterValues[param.position] ?? '');

    try {
      const response = await fetch('/api/db2-procedures/execute', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schema: selectedProcedure.schema,
          name: selectedProcedure.name,
          parameters: values,
        }),
      });

      if (response.status === 401) {
        const message = await response.text();
        await clearCredentials();
        openCredentialsModal(message || 'Credentials are required to run stored procedures.');
        resetProcedureState();
        setProcedures([]);
        return;
      }

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to execute stored procedure.');
      }

      const payload: { rows?: ResultRow[]; columns?: string[] } = await response.json();
      const resultRows = (payload.rows ?? []).map(normalizeRow);
      const resultColumns = payload.columns && payload.columns.length > 0 ? payload.columns : deriveColumns(resultRows);

      setRows(resultRows);
      setColumns(resultColumns);
      setInfoMessage(resultRows.length === 0 ? 'Procedure executed successfully. No rows returned.' : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to execute stored procedure.';
      setError(message);
    } finally {
      setIsExecuting(false);
    }
  }, [
    clearCredentials,
    hasCredentials,
    openCredentialsModal,
    parameterValues,
    parameters,
    resetProcedureState,
    selectedProcedure,
    setProcedures,
  ]);

  useEffect(() => {
    if (!initializingCredentials && hasCredentials) {
      void fetchProcedures();
    }
  }, [fetchProcedures, hasCredentials, initializingCredentials]);

  useEffect(() => {
    if (selectedProcedure) {
      void fetchParameters(selectedProcedure);
    } else {
      setParameters([]);
      setParameterValues({});
    }
  }, [fetchParameters, selectedProcedure]);

  const handleSelectProcedure = useCallback((procedure: ProcedureSummary) => {
    setSelectedProcedure(procedure);
  }, []);

  const handleParameterChange = useCallback((position: number, value: string) => {
    setParameterValues((prev) => ({ ...prev, [position]: value }));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 px-6 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold leading-tight text-slate-100">DB2 Stored Procedures</h1>
            <p className="text-sm text-slate-400">
              Discover stored procedures, inspect parameters, and execute them with custom arguments.
            </p>
          </div>
          <AppNav />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCredentialsModal}
            className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            {hasCredentials ? 'Update Credentials' : 'Enter Credentials'}
          </button>
          {hasCredentials && (
            <button
              type="button"
              onClick={handleClearCredentials}
              className="rounded-md border border-rose-600/70 px-3 py-1.5 text-sm font-medium text-rose-300 transition hover:border-rose-500 hover:text-rose-200"
              disabled={isLoadingProcedures || isExecuting}
            >
              Clear Credentials
            </button>
          )}
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
          <aside className="flex w-full flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg lg:max-w-xs">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <span className="text-sm font-medium text-slate-300">Procedures</span>
              <button
                type="button"
                onClick={fetchProcedures}
                disabled={isLoadingProcedures || !hasCredentials}
                className="text-xs font-medium text-sky-400 transition hover:text-sky-300 disabled:text-slate-600"
              >
                Refresh
              </button>
            </div>
            <div className="border-b border-slate-800 px-4 py-3">
              <input
                type="text"
                placeholder="Filter procedures…"
                value={procedureSearch}
                onChange={(event) => setProcedureSearch(event.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
              />
            </div>
            <div className="flex-1 overflow-auto">
              {isLoadingProcedures ? (
                <div className="flex h-full items-center justify-center px-4 text-sm text-slate-500">
                  Loading procedures…
                </div>
              ) : filteredProcedures.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-sm text-slate-500">
                  {procedureSearch ? 'No procedures match your search.' : 'No procedures found.'}
                </div>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {filteredProcedures.map((procedure) => {
                    const isActive =
                      selectedProcedure?.schema === procedure.schema &&
                      selectedProcedure?.name === procedure.name &&
                      selectedProcedure?.specificName === procedure.specificName;
                    return (
                      <li key={`${procedure.schema}.${procedure.specificName}`}>
                        <button
                          type="button"
                          onClick={() => handleSelectProcedure(procedure)}
                          className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition ${
                            isActive ? 'bg-slate-800/80 text-slate-100' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <span className="text-sm font-semibold text-slate-100">
                            {procedure.schema}.{procedure.name}
                          </span>
                          {procedure.remarks && (
                            <span className="text-xs text-slate-400">{procedure.remarks}</span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <section className="flex flex-1 flex-col gap-6">
            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
              <div className="border-b border-slate-800 px-4 py-3">
                <span className="text-sm font-medium text-slate-300">Parameters</span>
              </div>
              <div className="flex flex-col gap-4 px-4 py-4">
                {isLoadingParameters ? (
                  <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                    Loading parameters…
                  </div>
                ) : !selectedProcedure ? (
                  <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                    Select a stored procedure to view its parameters.
                  </div>
                ) : parameters.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-sm text-slate-500">
                    This procedure does not define any parameters.
                  </div>
                ) : (
                  <form
                    className="grid gap-4 md:grid-cols-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void executeProcedure();
                    }}
                  >
                    {parameters.map((parameter) => (
                      <div key={parameter.position} className="flex flex-col gap-2">
                        <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {parameter.name}{' '}
                          <span className="font-medium text-slate-500">
                            ({parameter.mode || 'IN'} {parameter.typeSchema}.{parameter.typeName}
                            {typeof parameter.length === 'number' && parameter.length > 0
                              ? `(${parameter.length}${
                                  typeof parameter.scale === 'number' && parameter.scale > 0
                                    ? `, ${parameter.scale}`
                                    : ''
                                })`
                              : ''}
                            )
                          </span>
                        </label>
                        <input
                          type="text"
                          value={parameterValues[parameter.position] ?? ''}
                          onChange={(event) => handleParameterChange(parameter.position, event.target.value)}
                          className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                          placeholder={parameter.defaultValue ? `Default: ${parameter.defaultValue}` : undefined}
                        />
                      </div>
                    ))}
                    <div className="md:col-span-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={isExecuting}
                        className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                      >
                        {isExecuting ? 'Executing…' : 'Execute Procedure'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                <span className="text-sm font-medium text-slate-300">Result Set</span>
                {isExecuting && <span className="text-xs font-medium text-sky-400">Executing…</span>}
              </div>
              <div className="flex flex-1 flex-col overflow-hidden">
                {error ? (
                  <div className="flex flex-1 items-center justify-center px-6 text-sm text-rose-300">{error}</div>
                ) : infoMessage ? (
                  <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
                    {infoMessage}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
                    {selectedProcedure
                      ? 'Execute the procedure to see results.'
                      : 'Select a procedure to view results.'}
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
                        {rows.map((row, rowIndex) => (
                          <tr key={`row-${rowIndex}`} className="odd:bg-slate-900 even:bg-slate-900/60">
                            {columns.map((column) => {
                              const value = row[column];
                              const text =
                                value === null || value === undefined
                                  ? ''
                                  : typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value);
                              return (
                                <td key={`${rowIndex}-${column}`} className="border-b border-slate-800 px-3 py-2">
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
            </div>
          </section>
        </div>
      </main>

      <CredentialsModal
        open={credentialsModalOpen}
        initializing={initializingCredentials}
        hasCredentials={hasCredentials}
        username={usernameInput}
        password={passwordInput}
        error={credentialsError}
        submitting={credentialsSubmitting}
        onUsernameChange={setUsernameInput}
        onPasswordChange={setPasswordInput}
        onSubmit={submitCredentials}
        onCancel={handleCredentialsCancel}
        onClear={handleClearCredentials}
      />
    </div>
  );
}

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

function deriveColumns(rows: ResultRow[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }
  return Array.from(columns);
}

