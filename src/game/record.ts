// SPDX-License-Identifier: GPL-3.0-or-later
// The game record (GS-09, GS-10): rounds from the server, rows and short notation for the screen.
// No rules here: the server sends each move's notation fields (ADR 0006); letters come from i18n.

import type { ColorName, PieceName } from '../api';

/** One move as the server writes it (docs/api.md, MoveNotation). */
export interface MoveNotation {
  piece: PieceName;
  origin: string; // disambiguation: '', a file, a rank or a square
  capture: boolean;
  to: string;
  promotion: PieceName | null;
  castling: 'short' | 'long' | null;
}

/** One round of the record (docs/api.md, RoundRecord). */
export interface RoundRecord {
  color: ColorName;
  faces: PieceName[];
  moves: MoveNotation[];
  skipped: boolean;
}

/** A line on the screen: the round of white and the following round of black. */
export interface RecordRow {
  number: number;
  white: RoundRecord | null;
  black: RoundRecord | null;
}

export function addRound(record: RoundRecord[], color: ColorName, faces: PieceName[]): RoundRecord[] {
  return [...record, { color, faces, moves: [], skipped: false }];
}

function changeLast(record: RoundRecord[], change: (round: RoundRecord) => RoundRecord): RoundRecord[] {
  const last = record.at(-1);
  return last ? [...record.slice(0, -1), change(last)] : record;
}

export function addMove(record: RoundRecord[], move: MoveNotation): RoundRecord[] {
  return changeLast(record, (round) => ({ ...round, moves: [...round.moves, move] }));
}

export function markSkipped(record: RoundRecord[]): RoundRecord[] {
  return changeLast(record, (round) => ({ ...round, skipped: true }));
}

/** A new row starts with a round of white; a record that starts with black leaves white empty. */
export function recordRows(record: RoundRecord[]): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const round of record) {
    const last = rows.at(-1);
    if (round.color === 'black' && last && last.black === null) {
      last.black = round;
    } else if (round.color === 'black') {
      rows.push({ number: rows.length + 1, white: null, black: round });
    } else {
      rows.push({ number: rows.length + 1, white: round, black: null });
    }
  }
  return rows;
}

type Translate = (key: string) => string;

/** Short algebraic notation with the letters of the locale: Фd1, e:d5, c8Ф, 0-0. */
export function formatMove(move: MoveNotation, t: Translate): string {
  if (move.castling) return t(`record.castling.${move.castling}`);
  const capture = move.capture ? t('record.capture') : '';
  const promotion = move.promotion ? t(`record.piece.${move.promotion}`) : '';
  return `${t(`record.piece.${move.piece}`)}${move.origin}${capture}${move.to}${promotion}`;
}

/** Dice of a round: letters in the order they were rolled, the pawn has its own letter. */
export function formatFaces(faces: PieceName[], t: Translate): string {
  return faces.map((face) => t(`record.die.${face}`)).join(' ');
}

/** Moves of a round, or the dash of a skipped round (L-088). */
export function formatMoves(round: RoundRecord, t: Translate): string {
  if (round.skipped) return t('record.skipped');
  return round.moves.map((move) => formatMove(move, t)).join(' ');
}
