// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { errorMessage } from './errors';
import { ApiError } from './http';
import i18n from './i18n';

const t = i18n.t.bind(i18n);
const generic = t('error.generic');

// Every code and problem of /auth from docs/api.md.
const FIELD_PROBLEMS: Record<string, string[]> = {
  invalid_email: ['bad_format', 'too_long'],
  invalid_nickname: ['too_short', 'too_long', 'bad_characters', 'reserved_prefix'],
  invalid_password: ['too_short', 'too_long', 'same_as_email', 'same_as_nickname'],
  consent_required: ['terms', 'personal_data'], // L-059
  document_outdated: ['terms', 'personal_data'], // L-060
};
const CODES = ['invalid_token', 'invalid_credentials', 'account_blocked', 'csrf_failed', 'nickname_taken'];

describe('errorMessage', () => {
  it.each(CODES)('has a text for %s', (code) => {
    const text = errorMessage(new ApiError(400, { code }), t);
    expect(text).not.toBe(generic);
    expect(text).not.toContain(code);
  });

  it.each(Object.entries(FIELD_PROBLEMS).flatMap(([code, problems]) => problems.map((p) => [code, p])))(
    'has a text for %s / %s',
    (code, problem) => {
      const text = errorMessage(new ApiError(422, { code, problem }), t);
      expect(text).not.toBe(generic);
      expect(text).not.toContain(problem);
    },
  );

  it('gives a field text for an unknown problem', () => {
    const text = errorMessage(new ApiError(422, { code: 'invalid_nickname', problem: 'new_rule' }), t);
    expect(text).toBe(t('authError.invalid_nickname.other'));
  });

  it('says when to retry, in whole minutes', () => {
    expect(errorMessage(new ApiError(429, { code: 'login_locked', retryAfter: 900 }), t)).toContain('15 минут');
    expect(errorMessage(new ApiError(429, { code: 'rate_limited', retryAfter: 61 }), t)).toContain('2 минуты');
    expect(errorMessage(new ApiError(429, { code: 'rate_limited', retryAfter: 5 }), t)).toContain('1 минуту');
  });

  it('falls back for validation errors, unknown codes and network failures', () => {
    expect(errorMessage(new ApiError(422), t)).toBe(t('authError.invalid_input'));
    expect(errorMessage(new ApiError(500, { code: 'surprise' }), t)).toBe(generic);
    expect(errorMessage(new TypeError('Failed to fetch'), t)).toBe(generic);
  });
});
