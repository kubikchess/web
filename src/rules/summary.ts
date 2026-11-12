// SPDX-License-Identifier: GPL-3.0-or-later
// Short rules on the game screen (GS-08): one rule per item, so that a hint can highlight
// the item that forbids a move by its stable id (data-rule, GS-12).

/** Item ids in reading order; texts are rules.summary.<id> in ru.json. */
export const RULE_SUMMARY_IDS = [
  'dice',
  'dice-odds',
  'maximum',
  'skip',
  'goal',
  'king-attacked',
  'king-capture',
  'pawn-king',
  'king-king',
  'castling',
  'en-passant',
  'promotion',
  'draw',
] as const;

export type RuleSummaryId = (typeof RULE_SUMMARY_IDS)[number];

/** Wide screens show the list open; the 600 px border matches the rest of the layout. */
export const SUMMARY_WIDE_QUERY = '(min-width: 601px)';

type MatchMedia = (query: string) => { matches: boolean };

/** Open on a wide screen, collapsed on a phone or when the browser cannot tell. */
export function summaryOpenAtStart(matchMedia: MatchMedia | undefined): boolean {
  if (!matchMedia) return false;
  try {
    return matchMedia(SUMMARY_WIDE_QUERY).matches;
  } catch {
    return false;
  }
}
