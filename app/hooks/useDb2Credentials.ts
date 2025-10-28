'use client';

import { useCallback, useEffect, useState } from 'react';

export interface UseDb2CredentialsResult {
  hasCredentials: boolean;
  credentialsModalOpen: boolean;
  initializingCredentials: boolean;
  credentialsSubmitting: boolean;
  credentialsError: string | null;
  usernameInput: string;
  passwordInput: string;
  openCredentialsModal(message?: string): void;
  closeCredentialsModal(): void;
  setUsernameInput(value: string): void;
  setPasswordInput(value: string): void;
  submitCredentials(): Promise<boolean>;
  clearCredentials(): Promise<void>;
  setCredentialsError(message: string | null): void;
}

export function useDb2Credentials(): UseDb2CredentialsResult {
  const [hasCredentials, setHasCredentials] = useState<boolean>(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState<boolean>(false);
  const [initializingCredentials, setInitializingCredentials] = useState<boolean>(true);
  const [credentialsSubmitting, setCredentialsSubmitting] = useState<boolean>(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');

  useEffect(() => {
    let active = true;

    const verifyCredentials = async () => {
      try {
        const response = await fetch('/api/db2-credentials', {
          method: 'GET',
          credentials: 'include',
        });

        if (!active) {
          return;
        }

        if (response.ok) {
          const payload: { hasCredentials?: boolean } = await response.json();
          const available = Boolean(payload.hasCredentials);
          setHasCredentials(available);
          setCredentialsModalOpen(!available);
          if (available) {
            setCredentialsError(null);
          }
        } else {
          setHasCredentials(false);
          setCredentialsModalOpen(true);
          setCredentialsError('Unable to verify stored credentials. Please sign in again.');
        }
      } catch {
        if (active) {
          setHasCredentials(false);
          setCredentialsModalOpen(true);
          setCredentialsError('Unable to reach the credentials service. Please sign in again.');
        }
      } finally {
        if (active) {
          setInitializingCredentials(false);
        }
      }
    };

    void verifyCredentials();

    return () => {
      active = false;
    };
  }, []);

  const openCredentialsModal = useCallback((message?: string) => {
    setCredentialsModalOpen(true);
    setCredentialsError(message ?? null);
    setUsernameInput('');
    setPasswordInput('');
  }, []);

  const closeCredentialsModal = useCallback(() => {
    setCredentialsModalOpen(false);
    setCredentialsError(null);
    setUsernameInput('');
    setPasswordInput('');
  }, []);

  const submitCredentials = useCallback(async (): Promise<boolean> => {
    const username = usernameInput.trim();
    const password = passwordInput;

    if (!username || !password) {
      setCredentialsError('Username and password are required.');
      return false;
    }

    setCredentialsSubmitting(true);
    setCredentialsError(null);

    try {
      const response = await fetch('/api/db2-credentials', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to save credentials.');
      }

      setHasCredentials(true);
      closeCredentialsModal();
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save credentials.';
      setCredentialsError(message);
      return false;
    } finally {
      setCredentialsSubmitting(false);
    }
  }, [closeCredentialsModal, passwordInput, usernameInput]);

  const clearCredentials = useCallback(async () => {
    try {
      await fetch('/api/db2-credentials', {
        method: 'DELETE',
        credentials: 'include',
      });
    } catch {
      // Ignore network errors; user can retry.
    } finally {
      setHasCredentials(false);
      openCredentialsModal();
    }
  }, [openCredentialsModal]);

  return {
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
    setCredentialsError,
  };
}
