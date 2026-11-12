// SPDX-License-Identifier: GPL-3.0-or-later
import type { Key } from 'chessground/types';
import { describe, expect, it } from 'vitest';

import i18n from '../i18n';
import {
  type BlockedMove,
  dropHint,
  findBlocked,
  hiddenTargets,
  type HintInput,
  hintText,
  kingAttackedHint,
  noDieHint,
  roundProgress,
  visibleHint,
} from './hints';

const t = (key: string, values?: Record<string, unknown>) => i18n.t(key, values);

const MAXIMUM: BlockedMove = { move: 'b1d2', reason: 'maximum', moves: 1, attackers: [] };
const ATTACKED: BlockedMove = { move: 'd1e1', reason: 'king_capture_attacked', moves: null, attackers: ['e1', 'h4'] };
const KING: BlockedMove = { move: 'e4e5', reason: 'king_takes_king', moves: null, attackers: [] };

describe('hint for a forbidden move (GS-12)', () => {
  it('L-100: the maximum names how many moves the round would have', () => {
    const hint = dropHint(MAXIMUM, { done: 0, movesLeft: 2 });
    expect(hint.rule).toBe('maximum');
    expect(hintText(hint, t)).toBe('Так получится только 1 ход из 2, а нужно сделать как можно больше ходов');
    expect(hint.arrows).toEqual([]);
  });

  it('the maximum counts moves already made and agrees in number', () => {
    const hint = dropHint({ ...MAXIMUM, moves: 2 }, { done: 1, movesLeft: 2 });
    expect(hintText(hint, t)).toBe('Так получится только 2 хода из 3, а нужно сделать как можно больше ходов');
  });

  it('L-101: a king capture from an attacked square names the square and draws the attacks', () => {
    const hint = dropHint(ATTACKED, { done: 0, movesLeft: 1 });
    expect(hint.rule).toBe('king-capture');
    expect(hintText(hint, t)).toBe('Короля нельзя взять: поле d1 бьёт соперник');
    expect(hint.arrows).toEqual([
      ['e1', 'd1'],
      ['h4', 'd1'],
    ]);
  });

  it('L-102: a king never captures the king', () => {
    const hint = dropHint(KING, { done: 0, movesLeft: 1 });
    expect(hint.rule).toBe('king-king');
    expect(hintText(hint, t)).toBe('Король не может взять короля');
  });

  it('L-103: a piece without a die', () => {
    const hint = noDieHint('knight');
    expect(hint.rule).toBe('dice');
    expect(hintText(hint, t)).toBe('Нет кубика «конь»: ходят только фигуры выпавших типов');
  });

  it('finds only the forbidden path the server sent', () => {
    expect(findBlocked([MAXIMUM, KING], 'b1', 'd2')).toBe(MAXIMUM);
    expect(findBlocked([MAXIMUM, KING], 'b1', 'c3')).toBeUndefined();
    expect(findBlocked([], 'c1', 'c2')).toBeUndefined();
  });

  it('hides the dots of forbidden squares of the selected piece only', () => {
    const knight = new Map<Key, Key[]>([['b1', ['a3', 'c3']]]);
    const bishop = new Map<Key, Key[]>([['f1', ['d2']]]);
    expect(hiddenTargets(knight, [MAXIMUM], 'b1')).toEqual(['d2']);
    // The bishop may go to d2, the selected knight may not.
    expect(hiddenTargets(bishop, [MAXIMUM], 'b1')).toEqual(['d2']);
    // No piece selected: a square stays visible if some piece may go there.
    expect(hiddenTargets(bishop, [MAXIMUM], undefined)).toEqual([]);
    expect(hiddenTargets(knight, [MAXIMUM], undefined)).toEqual(['d2']);
  });
});

describe('king under attack (GS-13)', () => {
  const start: HintInput = { roundKey: 'w-1', ownRound: true, atRoundStart: true, hasMoves: true, kingAttackers: ['a1'] };

  it('L-104: shows at the start of the own round with moves', () => {
    const hint = visibleHint(null, start);
    expect(hint?.rule).toBe('king-attacked');
    expect(hint && hintText(hint, t)).toBe('Ваш король под боем — шаха нет, раунд играется как обычно');
  });

  it('L-104: goes after the first move, and is not shown in the opponent round', () => {
    expect(visibleHint(null, { ...start, atRoundStart: false })).toBeNull();
    expect(visibleHint(null, { ...start, ownRound: false })).toBeNull();
  });

  it('is not shown without an attack or without moves', () => {
    expect(visibleHint(null, { ...start, kingAttackers: [] })).toBeNull();
    expect(visibleHint(null, { ...start, hasMoves: false })).toBeNull();
  });

  it('a forbidden-move hint replaces it and lasts until cleared or the round ends', () => {
    const forbidden = dropHint(KING, { done: 0, movesLeft: 1 });
    expect(visibleHint({ roundKey: 'w-1', hint: forbidden }, start)).toBe(forbidden);
    expect(visibleHint({ roundKey: 'w-1', hint: forbidden }, { ...start, atRoundStart: false })).toBe(forbidden);
    expect(visibleHint({ roundKey: 'w-1', hint: null }, start)).toBeNull();
    expect(visibleHint({ roundKey: 'w-1', hint: forbidden }, { ...start, roundKey: 'w-3', kingAttackers: [] })).toBeNull();
    expect(visibleHint({ roundKey: 'w-1', hint: forbidden }, { ...start, ownRound: false })).toBeNull();
  });

  it('the attack hint returns at the start of the next own round', () => {
    expect(visibleHint({ roundKey: 'w-1', hint: null }, { ...start, roundKey: 'w-3' })).toEqual(kingAttackedHint());
  });
});

describe('round progress', () => {
  it('counts the moves made from the dice', () => {
    expect(roundProgress({ faces: ['pawn', 'pawn', 'rook'], remaining: ['rook'] })).toEqual({ done: 2, atStart: false });
    expect(roundProgress({ faces: ['pawn', 'pawn', 'rook'], remaining: ['pawn', 'pawn', 'rook'] })).toEqual({
      done: 0,
      atStart: true,
    });
    expect(roundProgress(null)).toEqual({ done: 0, atStart: false });
  });
});
