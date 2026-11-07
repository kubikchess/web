// SPDX-License-Identifier: GPL-3.0-or-later
// Server error codes (docs/api.md) as user-facing text.

import type { TFunction } from 'i18next';

import { ApiError } from './http';

// Codes whose text depends on `problem`: a field rule or a legal document (SEC-13).
const FIELD_CODES = new Set([
  'invalid_email',
  'invalid_nickname',
  'invalid_password',
  'consent_required',
  'document_outdated',
]);
const SECONDS_PER_MINUTE = 60;

export function errorMessage(error: unknown, t: TFunction): string {
  const generic = t('error.generic');
  if (!(error instanceof ApiError)) return generic;
  const { code } = error;
  if (code === 'rate_limited' || code === 'login_locked') {
    const minutes = Math.max(1, Math.ceil((error.retryAfter ?? SECONDS_PER_MINUTE) / SECONDS_PER_MINUTE));
    return t(`authError.${code}`, { count: minutes });
  }
  if (code && FIELD_CODES.has(code)) {
    return t(`authError.${code}.${error.problem ?? 'other'}`, {
      defaultValue: t(`authError.${code}.other`),
    });
  }
  if (code) return t(`authError.${code}`, { defaultValue: generic });
  return error.status === 422 ? t('authError.invalid_input') : generic;
}
