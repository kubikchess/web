// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import i18n from '../i18n';
import {
  addMove,
  addRound,
  formatFaces,
  formatMove,
  formatMoves,
  markSkipped,
  type MoveNotation,
  recordRows,
  type RoundRecord,
} from './record';

const t = (key: string) => i18n.t(key);

function move(fields: Partial<MoveNotation> & Pick<MoveNotation, 'piece' | 'to'>): MoveNotation {
  return { origin: '', capture: false, promotion: null, castling: null, ...fields };
}

const round = (color: 'white' | 'black', moves: MoveNotation[] = []): RoundRecord => ({
  color,
  faces: ['pawn', 'pawn', 'pawn'],
  moves,
  skipped: false,
});

describe('move notation (GS-10)', () => {
  it.each([
    [move({ piece: 'knight', to: 'f3' }), 'Кf3'],
    [move({ piece: 'queen', to: 'e1', capture: true }), 'Ф:e1'],
    [move({ piece: 'king', to: 'e2' }), 'Крe2'],
    [move({ piece: 'pawn', to: 'd5', origin: 'e', capture: true }), 'e:d5'],
    [move({ piece: 'pawn', to: 'd6', origin: 'e', capture: true }), 'e:d6'],
    [move({ piece: 'pawn', to: 'd1', origin: 'c', capture: true, promotion: 'queen' }), 'c:d1Ф'],
    [move({ piece: 'pawn', to: 'c8', promotion: 'knight' }), 'c8К'],
    [move({ piece: 'king', to: 'g1', castling: 'short' }), '0-0'],
    [move({ piece: 'king', to: 'c1', castling: 'long' }), '0-0-0'],
    [move({ piece: 'rook', to: 'd1', origin: 'a' }), 'Лad1'],
    [move({ piece: 'knight', to: 'e3', origin: '5' }), 'К5e3'],
  ])('L-092: writes %j as %s', (notation, expected) => {
    expect(formatMove(notation, t)).toBe(expected);
  });
});

describe('game record (GS-09)', () => {
  it('L-087: one row holds the dice and moves of white and black', () => {
    let record: RoundRecord[] = [];
    record = addRound(record, 'white', ['queen', 'knight', 'pawn']);
    for (const m of [move({ piece: 'queen', to: 'd1' }), move({ piece: 'knight', to: 'c6' }), move({ piece: 'pawn', to: 'e6' })])
      record = addMove(record, m);
    record = addRound(record, 'black', ['bishop', 'pawn', 'pawn']);
    record = addMove(record, move({ piece: 'pawn', to: 'c5' }));
    record = addMove(record, move({ piece: 'bishop', to: 'b4' }));

    const rows = recordRows(record);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('no row');
    expect(row.number).toBe(1);
    expect(row.white && formatFaces(row.white.faces, t)).toBe('Ф К П');
    expect(row.white && formatMoves(row.white, t)).toBe('Фd1 Кc6 e6');
    expect(row.black && formatFaces(row.black.faces, t)).toBe('С П П');
    expect(row.black && formatMoves(row.black, t)).toBe('c5 Сb4');
  });

  it('L-088: a skipped round shows its dice and a dash', () => {
    const [skipped] = markSkipped(addRound([], 'white', ['rook', 'pawn', 'pawn']));
    if (!skipped) throw new Error('no round');

    expect(formatFaces(skipped.faces, t)).toBe('Л П П');
    expect(formatMoves(skipped, t)).toBe('—');
  });

  it('numbers rows by pairs of rounds', () => {
    const rows = recordRows([round('white'), round('black'), round('white')]);

    expect(rows.map((r) => [r.number, r.white?.color ?? null, r.black?.color ?? null])).toEqual([
      [1, 'white', 'black'],
      [2, 'white', null],
    ]);
  });

  it('leaves the white half empty when the record starts with black', () => {
    const rows = recordRows([round('black'), round('white')]);

    expect(rows.map((r) => [r.number, r.white?.color ?? null, r.black?.color ?? null])).toEqual([
      [1, null, 'black'],
      [2, 'white', null],
    ]);
  });

  it('a move or a skip without a round changes nothing', () => {
    expect(addMove([], move({ piece: 'pawn', to: 'e4' }))).toEqual([]);
    expect(markSkipped([])).toEqual([]);
  });
});
