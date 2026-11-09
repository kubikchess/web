// SPDX-License-Identifier: GPL-3.0-or-later
// Legal documents (docs/api.md, "HTTP API: юридические документы", SEC-12, SEC-13).

import { ApiError, request } from './http';

export type LegalDocumentId = 'terms' | 'personal_data' | 'privacy_policy';
/** Documents the registration form asks to accept; the privacy policy has no checkbox. */
export type ConsentId = Extract<LegalDocumentId, 'terms' | 'personal_data'>;
export const CONSENT_IDS: readonly ConsentId[] = ['terms', 'personal_data'];

export interface LegalBlock {
  kind: 'heading' | 'paragraph';
  text: string;
}

export interface LegalDocument {
  document: LegalDocumentId;
  version: string;
  title: string;
  blocks: LegalBlock[];
}

/** Site pages of the documents. */
export const LEGAL_PAGES: Record<LegalDocumentId, string> = {
  terms: '/terms',
  personal_data: '/personal-data',
  privacy_policy: '/privacy',
};

/** The About page: frontend license and its source (NFR-17). */
export const ABOUT_PAGE = '/about';
/** The rules page (rules-help, NFR-18). */
export const RULES_PAGE = '/rules';
/** Public repository with the frontend source of every release (GPL-3.0-or-later, NFR-17). */
export const SOURCE_REPOSITORY_URL = 'https://github.com/kubikchess/web';

export function legalPath(document: LegalDocumentId): string {
  return `/legal/${document}`;
}

export async function fetchLegal(document: LegalDocumentId): Promise<LegalDocument> {
  const reply = await request<LegalDocument>('GET', legalPath(document));
  if (reply === null) throw new ApiError(502);
  return reply;
}

/** The `consents` field of POST /auth/register: the shown version of each ticked box. */
export function consentsBody(
  versions: Partial<Record<ConsentId, string>>,
  ticked: Record<ConsentId, boolean>,
): Partial<Record<ConsentId, string>> {
  const body: Partial<Record<ConsentId, string>> = {};
  for (const id of CONSENT_IDS) {
    const version = versions[id];
    if (ticked[id] && version !== undefined) body[id] = version;
  }
  return body;
}
