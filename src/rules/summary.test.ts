// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { RULE_SUMMARY_IDS, SUMMARY_WIDE_QUERY, summaryOpenAtStart } from './summary';

describe('short rules on the game screen (GS-08)', () => {
  it('keeps stable item ids in reading order', () => {
    expect(RULE_SUMMARY_IDS).toEqual(['dice', 'maximum', 'goal', 'king-capture', 'special', 'promotion', 'draw']);
  });

  it('is open on a wide screen', () => {
    const asked: string[] = [];
    const matchMedia = (query: string) => {
      asked.push(query);
      return { matches: true };
    };
    expect(summaryOpenAtStart(matchMedia)).toBe(true);
    expect(asked).toEqual([SUMMARY_WIDE_QUERY]);
  });

  it('is collapsed on a phone', () => {
    expect(summaryOpenAtStart(() => ({ matches: false }))).toBe(false);
  });

  it('is collapsed without matchMedia or when it throws', () => {
    expect(summaryOpenAtStart(undefined)).toBe(false);
    expect(
      summaryOpenAtStart(() => {
        throw new Error('unsupported');
      }),
    ).toBe(false);
  });
});
