// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { boardFen, lastMoveKeys, promotionChoices, toDests, toUci } from './moves';

describe('toDests', () => {
  it('groups server moves by start square', () => {
    const dests = toDests(['e2e3', 'e2e4', 'g1f3', 'g1h3']);

    expect([...dests.entries()]).toEqual([
      ['e2', ['e3', 'e4']],
      ['g1', ['f3', 'h3']],
    ]);
  });

  it('lists a promotion square once for all promotion pieces', () => {
    const dests = toDests(['b7b8q', 'b7b8r', 'b7b8b', 'b7b8n', 'b7a8q']);

    expect(dests.get('b7')).toEqual(['b8', 'a8']);
  });

  it('is empty without allowed moves', () => {
    expect(toDests([]).size).toBe(0);
  });
});

describe('promotionChoices', () => {
  const allowed = ['b7b8q', 'b7b8r', 'b7b8b', 'b7b8n', 'e1e2'];

  it('returns the pieces the server allows for this path', () => {
    expect(promotionChoices(allowed, 'b7', 'b8')).toEqual(['q', 'r', 'b', 'n']);
  });

  it('is empty for a plain move', () => {
    expect(promotionChoices(allowed, 'e1', 'e2')).toEqual([]);
  });
});

describe('toUci', () => {
  it('builds plain and promotion moves', () => {
    expect(toUci('e2', 'e4')).toBe('e2e4');
    expect(toUci('b7', 'b8', 'n')).toBe('b7b8n');
  });
});

describe('boardFen', () => {
  it('keeps the placement field only', () => {
    expect(boardFen('4k3/8/8/8/8/8/8/R3K3 w Q - 0')).toBe('4k3/8/8/8/8/8/8/R3K3');
  });
});

describe('lastMoveKeys', () => {
  it('splits a move into squares', () => {
    expect(lastMoveKeys('b7b8q')).toEqual(['b7', 'b8']);
    expect(lastMoveKeys(null)).toBeUndefined();
  });
});
