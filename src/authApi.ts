// SPDX-License-Identifier: GPL-3.0-or-later
// Accounts API client: /auth (docs/api.md, ADR 0008).

import { request } from './http';
import type { ConsentId } from './legalApi';

export interface Participant {
  kind: 'user' | 'guest';
  id: string;
  display_name: string;
  role: 'player' | 'admin' | null;
  email_verified: boolean;
}

interface Session {
  participant: Participant | null;
}

async function session(method: 'GET' | 'POST', path: string, body?: unknown) {
  const reply = await request<Session>(method, path, body);
  return reply?.participant ?? null;
}

async function command(path: string, body: unknown = {}): Promise<void> {
  await request('POST', path, body);
}

export const authApi = {
  /** Current participant; also hands out the CSRF cookie. */
  me: () => session('GET', '/auth/me'),
  /** `consents`: the shown version of each accepted document (SEC-13). */
  register: (email: string, nickname: string, password: string, consents: Partial<Record<ConsentId, string>>) =>
    command('/auth/register', { email, nickname, password, consents }),
  verifyEmail: (token: string) => command('/auth/verify-email', { token }),
  resendVerification: (email: string) => command('/auth/resend-verification', { email }),
  login: (email: string, password: string) => session('POST', '/auth/login', { email, password }),
  guest: () => session('POST', '/auth/guest'),
  logout: () => command('/auth/logout'),
  requestPasswordReset: (email: string) => command('/auth/password-reset/request', { email }),
  resetPassword: (token: string, newPassword: string) =>
    command('/auth/password-reset/confirm', { token, new_password: newPassword }),
};
