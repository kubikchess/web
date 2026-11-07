// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { diceSlots } from './dice';

describe('diceSlots', () => {
  it('marks dice that are no longer remaining as used', () => {
    expect(diceSlots(['pawn', 'knight', 'pawn'], ['pawn'])).toEqual([
      { piece: 'pawn', used: false },
      { piece: 'knight', used: true },
      { piece: 'pawn', used: true },
    ]);
  });

  it('keeps all dice unused at the start of a round', () => {
    expect(diceSlots(['king', 'king', 'rook'], ['king', 'king', 'rook']).every((s) => !s.used)).toBe(
      true,
    );
  });

  it('marks all dice used when nothing remains', () => {
    expect(diceSlots(['bishop', 'bishop', 'bishop'], []).every((s) => s.used)).toBe(true);
  });
});
