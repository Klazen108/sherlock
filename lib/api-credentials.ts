import { NextResponse, type NextRequest } from 'next/server';
import type { Db2Credentials } from './db2';
import { SESSION_COOKIE_NAME, getSessionCredentials } from './session-store';

const isProduction = process.env.NODE_ENV === 'production';

export function createUnauthorizedResponse(message: string, clearCookie: boolean): NextResponse {
  const response = new NextResponse(message, { status: 401 });
  if (clearCookie) {
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
      secure: isProduction,
    });
  }
  return response;
}

export function requireCredentials(
  request: NextRequest
): { credentials: Db2Credentials } | { response: NextResponse } {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  if (!token) {
    return {
      response: createUnauthorizedResponse('Credentials are required. Please sign in again.', false),
    };
  }

  const credentials = getSessionCredentials(token);
  if (!credentials) {
    return {
      response: createUnauthorizedResponse('Credentials have expired. Please sign in again.', true),
    };
  }

  return { credentials };
}
