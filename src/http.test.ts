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

  // Two /auth/me without the cookie hand out two tokens; a late reply may replace the cookie
  // while a POST is on its way with the earlier one (seen in the L-025 trace, 2026-11-09).
  it('repeats a POST once when the CSRF cookie changed while it was sent', async () => {
    const doc = { cookie: 'dicechess_csrf=first' };
    vi.stubGlobal('document', doc);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      const header = new Headers(init?.headers).get(CSRF_HEADER);
      if (header === 'first') {
        doc.cookie = 'dicechess_csrf=second'; // the late /auth/me reply lands meanwhile
        return Promise.resolve(reply(403, { detail: { code: 'csrf_failed' } }));
      }
      return Promise.resolve(new Response(null, { status: 202 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('POST', '/auth/register', {})).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retry] = fetchMock.mock.calls[1] ?? [];
    expect(new Headers(retry?.headers).get(CSRF_HEADER)).toBe('second');
  });

  it('does not repeat a refused POST when the token stayed the same', async () => {
    vi.stubGlobal('document', { cookie: TOKEN_COOKIE });
    const fetchMock = stubFetch(reply(403, { detail: { code: 'csrf_failed' } }));

    await expect(request('POST', '/auth/register', {})).rejects.toMatchObject({ status: 403, code: 'csrf_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not repeat a POST refused for another reason', async () => {
    const doc = { cookie: 'dicechess_csrf=first' };
    vi.stubGlobal('document', doc);
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() => {
      doc.cookie = 'dicechess_csrf=second';
      return Promise.resolve(reply(403, { detail: { code: 'account_blocked' } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('POST', '/auth/login', {})).rejects.toMatchObject({ code: 'account_blocked' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares one /auth/me between the page and the token of a POST', async () => {
    const doc = { cookie: '' };
    vi.stubGlobal('document', doc);
    let answerMe: () => void = () => undefined;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation((input) => {
      if (input === '/auth/me') {
        return new Promise<Response>((resolve) => {
          answerMe = () => {
            doc.cookie = 'dicechess_csrf=only';
            resolve(reply(200, { kind: 'guest' }));
          };
        });
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    // The header asks who is there, the e-mail link page posts at the same time; and StrictMode
    // mounts the provider twice in development.
    const pages = [request('GET', '/auth/me'), request('GET', '/auth/me')];
    const post = request('POST', '/auth/verify-email', { token: 't' });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    answerMe();

    await expect(Promise.all(pages)).resolves.toEqual([{ kind: 'guest' }, { kind: 'guest' }]);
    await post;
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/auth/me', '/auth/verify-email']);
    const [, init] = fetchMock.mock.calls[1] ?? [];
    expect(new Headers(init?.headers).get(CSRF_HEADER)).toBe('only');
  });

  it('does not ask for a token before a GET', async () => {
    const fetchMock = freshBrowser(() => reply(200, null));

    await request('GET', '/games');

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual(['/games']);
  });
});
