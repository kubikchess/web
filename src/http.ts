// SPDX-License-Identifier: GPL-3.0-or-later
// JSON over HTTP with the CSRF token (docs/api.md, ADR 0008).

export const CSRF_COOKIE = 'dicechess_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly problem: string | undefined;
  readonly retryAfter: number | undefined; // seconds

  constructor(status: number, detail: ErrorDetail = {}) {
    super(`API error ${status}${detail.code ? ` (${detail.code})` : ''}`);
    this.status = status;
    this.code = detail.code;
    this.problem = detail.problem;
    this.retryAfter = detail.retryAfter;
  }
}

interface ErrorDetail {
  code?: string;
  problem?: string;
  retryAfter?: number;
}

export function readCookie(cookies: string, name: string): string | undefined {
  for (const part of cookies.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

const CSRF_SOURCE = '/auth/me'; // hands out the CSRF cookie (docs/api.md)

function csrfToken(): string | undefined {
  return readCookie(globalThis.document?.cookie ?? '', CSRF_COOKIE);
}

let pendingToken: Promise<void> | null = null;

/**
 * The CSRF token for a changing request. Without the cookie, ask /auth/me first: a POST
 * may leave before the page's own /auth/me has answered, e.g. on the e-mail link page.
 * POSTs sent together share one /auth/me.
 */
async function tokenForPost(): Promise<string | undefined> {
  if (csrfToken()) return csrfToken();
  pendingToken ??= fetch(CSRF_SOURCE, { credentials: 'same-origin' })
    .then(() => undefined, () => undefined) // no token: the server answers csrf_failed
    .finally(() => {
      pendingToken = null;
    });
  await pendingToken;
  return csrfToken();
}

/** Send a request; resolves to the JSON body, or null when the reply has none. */
export async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T | null> {
  const headers = new Headers();
  const token = method === 'POST' ? await tokenForPost() : csrfToken();
  if (token) headers.set(CSRF_HEADER, token);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload: unknown = text ? parseJson(text) : null;
  if (!response.ok) throw new ApiError(response.status, errorDetail(payload));
  return payload as T | null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function errorDetail(payload: unknown): ErrorDetail {
  if (typeof payload !== 'object' || payload === null || !('detail' in payload)) return {};
  const { detail } = payload;
  if (typeof detail !== 'object' || detail === null || Array.isArray(detail)) return {};
  const field = (name: string): unknown => (name in detail ? (detail as Record<string, unknown>)[name] : undefined);
  const code = field('code');
  const problem = field('problem');
  const retryAfter = field('retry_after');
  return {
    code: typeof code === 'string' ? code : undefined,
    problem: typeof problem === 'string' ? problem : undefined,
    retryAfter: typeof retryAfter === 'number' ? retryAfter : undefined,
  };
}
