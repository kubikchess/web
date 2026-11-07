// SPDX-License-Identifier: GPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, CSRF_HEADER, readCookie, request } from './http';

function reply(status: number, body?: unknown, headers: Record<string, string> = {}): Response {
  const text = body === undefined ? null : JSON.stringify(body);
  return new Response(text, { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function stubFetch(response: Response) {
  const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const TOKEN_COOKIE = 'dicechess_csrf=tok';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A browser without the CSRF cookie: /auth/me sets it, other paths answer `answer`. */
function freshBrowser(answer: () => Response) {
  const doc = { cookie: '' };
  vi.stubGlobal('document', doc);
  const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
    if (input === '/auth/me') {
      doc.cookie = 'dicechess_csrf=fresh';
      return Promise.resolve(reply(200, null));
    }
    return Promise.resolve(answer());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('readCookie', () => {
  it('finds a cookie among others', () => {
    expect(readCookie('a=1; dicechess_csrf=abc-DEF_1; b=2', 'dicechess_csrf')).toBe('abc-DEF_1');
  });

  it('does not match a cookie whose name only ends the same', () => {
    expect(readCookie('xdicechess_csrf=evil', 'dicechess_csrf')).toBeUndefined();
  });

  it('decodes the value', () => {
    expect(readCookie('dicechess_csrf=a%3Db', 'dicechess_csrf')).toBe('a=b');
  });
});

describe('request', () => {
  it('sends JSON with the CSRF token from the cookie', async () => {
    vi.stubGlobal('document', { cookie: 'dicechess_csrf=tok123' });
    const fetchMock = stubFetch(reply(200, { ok: true }));

    const result = await request<{ ok: boolean }>('POST', '/auth/login', { email: 'a@b.c' });

    expect(result).toEqual({ ok: true });
    const [path, init] = fetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/auth/login');
    expect(init?.method).toBe('POST');
    expect(init?.credentials).toBe('same-origin');
    expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe('tok123');
    expect(init?.body).toBe('{"email":"a@b.c"}');
  });

  it('returns null for replies without a body', async () => {
    vi.stubGlobal('document', { cookie: TOKEN_COOKIE });
    stubFetch(new Response(null, { status: 202 }));

    await expect(request('POST', '/auth/register', {})).resolves.toBeNull();
  });

  it('turns an error reply into ApiError with code, problem and retry time', async () => {
    vi.stubGlobal('document', { cookie: TOKEN_COOKIE });
    stubFetch(reply(429, { detail: { code: 'login_locked', retry_after: 900 } }, { 'Retry-After': '900' }));

    const error: unknown = await request('POST', '/auth/login', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429, code: 'login_locked', retryAfter: 900 });
  });

  it('keeps the problem of a field error', async () => {
    vi.stubGlobal('document', { cookie: TOKEN_COOKIE });
    stubFetch(reply(422, { detail: { code: 'invalid_nickname', problem: 'too_short' } }));

    await expect(request('POST', '/auth/register', {})).rejects.toMatchObject({
      code: 'invalid_nickname',
      problem: 'too_short',
    });
  });

  it('copes with a validation error list and a non-JSON body', async () => {
    vi.stubGlobal('document', { cookie: TOKEN_COOKIE });
    stubFetch(reply(422, { detail: [{ loc: ['body', 'email'], msg: 'Field required' }] }));
    await expect(request('POST', '/auth/login', {})).rejects.toMatchObject({
      status: 422,
      code: undefined,
    });

    stubFetch(new Response('Bad gateway', { status: 502 }));
    await expect(request('GET', '/auth/me')).rejects.toMatchObject({ status: 502, code: undefined });
  });

  it('sends one request when the CSRF cookie is there', async () => {
    vi.stubGlobal('document', { cookie: TOKEN_COOKIE });
    const fetchMock = stubFetch(reply(200, {}));

    await request('POST', '/auth/login', {});

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gets the CSRF token from /auth/me before a POST without the cookie (api.md)', async () => {
    const fetchMock = freshBrowser(() => new Response(null, { status: 204 }));

    await request('POST', '/auth/verify-email', { token: 't' });

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/auth/me', '/auth/verify-email']);
    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe('fresh');
  });

  it('asks /auth/me once for POSTs sent together', async () => {
    const fetchMock = freshBrowser(() => new Response(null, { status: 204 }));

    await Promise.all([request('POST', '/auth/guest'), request('POST', '/auth/guest')]);

    expect(fetchMock.mock.calls.filter(([path]) => path === '/auth/me')).toHaveLength(1);
  });

  it('does not ask for a token before a GET', async () => {
    const fetchMock = freshBrowser(() => reply(200, null));

    await request('GET', '/games');

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/games']);
  });
});
