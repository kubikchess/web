// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import i18n from '../i18n';
import { rulesTextValues } from './profile';
import { RULE_SUMMARY_IDS, SUMMARY_WIDE_QUERY, summaryOpenAtStart } from './summary';

describe('short rules on the game screen (GS-08)', () => {
  it('keeps stable item ids in reading order', () => {
    expect(RULE_SUMMARY_IDS).toEqual([
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
    ]);
  });

  it('has a filled-in text for every item', () => {
    for (const id of RULE_SUMMARY_IDS) {
      const text = i18n.t(`rules.summary.${id}`, rulesTextValues());
      expect(text, id).not.toBe(`rules.summary.${id}`);
      expect(text, id).not.toContain('{{');
    }
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
