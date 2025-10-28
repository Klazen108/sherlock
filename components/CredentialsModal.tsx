'use client';

import { type FormEvent } from 'react';

interface CredentialsModalProps {
  open: boolean;
  initializing: boolean;
  hasCredentials: boolean;
  username: string;
  password: string;
  error: string | null;
  submitting: boolean;
  onUsernameChange(value: string): void;
  onPasswordChange(value: string): void;
  onSubmit(): Promise<boolean>;
  onCancel(): void;
  onClear(): void;
}

export function CredentialsModal({
  open,
  initializing,
  hasCredentials,
  username,
  password,
  error,
  submitting,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
  onCancel,
  onClear,
}: CredentialsModalProps) {
  const shouldRender = open || initializing;

  if (!shouldRender) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {initializing ? (
          <div className="space-y-3 text-slate-200">
            <h2 className="text-lg font-semibold">Preparing session…</h2>
            <p className="text-sm text-slate-400">
              Checking for existing DB2 credentials. You can close this window once the check finishes.
            </p>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Enter DB2 Credentials</h2>
              <p className="text-sm text-slate-400">
                Credentials are stored securely on the server for this session and are not sent with each request.
              </p>
            </div>
            {error && (
              <div className="rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="db2-username" className="text-sm font-medium text-slate-200">
                Username
              </label>
              <input
                id="db2-username"
                type="text"
                autoComplete="username"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={username}
                onChange={(event) => onUsernameChange(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="db2-password" className="text-sm font-medium text-slate-200">
                Password
              </label>
              <input
                id="db2-password"
                type="password"
                autoComplete="current-password"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              {hasCredentials && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="order-2 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100 sm:order-1"
                >
                  Cancel
                </button>
              )}
              <div className="order-1 flex flex-1 justify-end gap-2 sm:order-2">
                {hasCredentials && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="rounded-md border border-rose-600/70 px-3 py-1.5 text-sm font-medium text-rose-300 transition hover:border-rose-500 hover:text-rose-200"
                    disabled={submitting}
                  >
                    Clear Credentials
                  </button>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-sky-500 px-4 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {submitting ? 'Saving…' : 'Save Credentials'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
