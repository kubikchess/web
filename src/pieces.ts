// SPDX-License-Identifier: GPL-3.0-or-later
import type { ColorName, PieceName } from './api';
import type { Promotion } from './moves';

const GLYPHS: Record<ColorName, Record<PieceName, string>> = {
  white: { pawn: '♙', knight: '♘', bishop: '♗', rook: '♖', queen: '♕', king: '♔' },
  black: { pawn: '♟', knight: '♞', bishop: '♝', rook: '♜', queen: '♛', king: '♚' },
};

export const glyph = (color: ColorName, piece: PieceName) => GLYPHS[color][piece];

export const PROMOTION_PIECES: Record<Promotion, PieceName> = {
  q: 'queen',
  r: 'rook',
  b: 'bishop',
  n: 'knight',
};
