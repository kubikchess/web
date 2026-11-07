// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { consentsBody, legalPath, LEGAL_PAGES } from './legalApi';

describe('legal documents', () => {
  it('asks the server for each document by its id', () => {
    expect(legalPath('terms')).toBe('/legal/terms');
    expect(legalPath('personal_data')).toBe('/legal/personal_data');
    expect(legalPath('privacy_policy')).toBe('/legal/privacy_policy');
  });

  it('gives every document its own page', () => {
    expect(LEGAL_PAGES).toEqual({
      terms: '/terms',
      personal_data: '/personal-data',
      privacy_policy: '/privacy',
    });
  });
});

describe('consents of the registration form', () => {
  const versions = { terms: '2026-11-06', personal_data: '2026-11-06-2' };

  it('sends the shown version of every ticked box', () => {
    expect(consentsBody(versions, { terms: true, personal_data: true })).toEqual(versions);
  });

  it('sends no key for an unticked box', () => {
    expect(consentsBody(versions, { terms: true, personal_data: false })).toEqual({ terms: '2026-11-06' });
  });

  it('sends no key while the version is not loaded', () => {
    expect(consentsBody({ terms: '2026-11-06' }, { terms: true, personal_data: true })).toEqual({
      terms: '2026-11-06',
    });
  });
});
