import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  createSession,
  deleteSession,
  getSessionCredentials,
  getSessionMaxAgeSeconds,
  setSessionCredentials,
} from '@/lib/session-store';

export const runtime = 'nodejs';

interface CredentialsPayload {
  username?: unknown;
  password?: unknown;
}

function parseStringField(input: unknown, label: string): string {
  if (typeof input !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  if (trimmed.includes(';')) {
    throw new Error(`${label} must not contain semicolons.`);
  }
  return trimmed;
}

function getToken(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function GET(request: NextRequest): Promise<Response> {
  const token = getToken(request);
  if (!token) {
    return NextResponse.json({ hasCredentials: false });
  }

  const credentials = getSessionCredentials(token);
  if (!credentials) {
    const response = NextResponse.json({ hasCredentials: false });
    clearSessionCookie(response);
    return response;
  }

  return NextResponse.json({ hasCredentials: true });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body: CredentialsPayload = await request.json();
    const username = parseStringField(body.username, 'Username');
    const password = parseStringField(body.password, 'Password');

    const existingToken = getToken(request);
    let token = existingToken;

    if (token && getSessionCredentials(token)) {
      setSessionCredentials(token, { username, password });
    } else {
      token = createSession({ username, password });
    }

    const response = new NextResponse(null, { status: 204 });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token!,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: getSessionMaxAgeSeconds(),
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid credentials payload.';
    return new NextResponse(message, { status: 400 });
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const token = getToken(request);
  if (token) {
    deleteSession(token);
  }
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookie(response);
  return response;
}
