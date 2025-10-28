import { randomUUID } from 'crypto';
import type { Db2Credentials } from './db2';

interface SessionRecord {
  credentials: Db2Credentials;
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours
const SESSION_STORE = new Map<string, SessionRecord>();

export const SESSION_COOKIE_NAME = 'db2-session';

function getTtlMs(): number {
  const value = process.env.DB2_SESSION_TTL_MS;
  if (!value) {
    return DEFAULT_SESSION_TTL_MS;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SESSION_TTL_MS;
}

export function getSessionMaxAgeSeconds(): number {
  return Math.floor(getTtlMs() / 1000);
}

function createRecord(credentials: Db2Credentials): SessionRecord {
  return {
    credentials,
    expiresAt: Date.now() + getTtlMs(),
  };
}

function refreshRecord(record: SessionRecord): SessionRecord {
  return {
    credentials: record.credentials,
    expiresAt: Date.now() + getTtlMs(),
  };
}

export function createSession(credentials: Db2Credentials): string {
  const token = randomUUID();
  SESSION_STORE.set(token, createRecord(credentials));
  return token;
}

export function setSessionCredentials(token: string, credentials: Db2Credentials): void {
  SESSION_STORE.set(token, createRecord(credentials));
}

export function getSessionCredentials(token: string): Db2Credentials | null {
  const record = SESSION_STORE.get(token);
  if (!record) {
    return null;
  }
  if (record.expiresAt <= Date.now()) {
    SESSION_STORE.delete(token);
    return null;
  }
  const refreshed = refreshRecord(record);
  SESSION_STORE.set(token, refreshed);
  return refreshed.credentials;
}

export function deleteSession(token: string): void {
  SESSION_STORE.delete(token);
}
