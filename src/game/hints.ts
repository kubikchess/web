// SPDX-License-Identifier: GPL-3.0-or-later
// Hints about the rule that forbids a move (GS-12) and about the attacked king (GS-13).
// No rules here: the server names forbidden moves and attacking pieces (ADR 0006); the
// client only knows its dice, so it tells a piece without a die by itself.

import type { Dests, Key } from 'chessground/types';

import type { PieceName } from '../api';
import type { RuleSummaryId } from '../rules/summary';

export type BlockReason = 'maximum' | 'king_capture_attacked' | 'king_takes_king';

/** A forbidden move of the round (docs/api.md, BlockedMove). */
export interface BlockedMove {
  move: string; // path: from and to, no promotion piece
  reason: BlockReason;
  moves: number | null; // maximum: moves the round would have in total with this move
  attackers: string[]; // king_capture_attacked: squares attacking the origin
}

/** A hint line under the board and the short rules item it highlights. */
export interface Hint {
  rule: RuleSummaryId;
  key: string; // under hint.* in ru.json
  values: Record<string, string | number>;
  piece?: PieceName; // translated into the text
  arrows: [Key, Key][]; // from an attacking piece to the square it attacks
}

const RULE_OF: Record<BlockReason, RuleSummaryId> = {
  maximum: 'maximum',
  king_capture_attacked: 'king-capture',
  king_takes_king: 'king-king',
};

const from = (path: string) => path.slice(0, 2) as Key;
const to = (path: string) => path.slice(2, 4) as Key;

export function findBlocked(blocked: readonly BlockedMove[], orig: Key, dest: Key): BlockedMove | undefined {
  return blocked.find((b) => from(b.move) === orig && to(b.move) === dest);
}

/** `done`: moves made in the round; `movesLeft`: still to make (the maximum). */
export function dropHint(blocked: BlockedMove, round: { done: number; movesLeft: number }): Hint {
  const rule = RULE_OF[blocked.reason];
  const origin = from(blocked.move);
  switch (blocked.reason) {
    case 'maximum':
      return {
        rule,
        key: 'hint.maximum',
        values: { count: blocked.moves ?? 0, total: round.done + round.movesLeft },
        arrows: [],
      };
    case 'king_capture_attacked':
      return {
        rule,
        key: 'hint.kingCaptureAttacked',
        values: { square: origin },
        arrows: blocked.attackers.map((square) => [square as Key, origin]),
      };
    case 'king_takes_king':
      return { rule, key: 'hint.kingTakesKing', values: {}, arrows: [] };
  }
}

export function noDieHint(piece: PieceName): Hint {
  return { rule: 'dice', key: 'hint.noDie', values: {}, piece, arrows: [] };
}

export function kingAttackedHint(): Hint {
  return { rule: 'king-attacked', key: 'hint.kingAttacked', values: {}, arrows: [] };
}

type Translate = (key: string, values?: Record<string, unknown>) => string;

export function hintText(hint: Hint, t: Translate): string {
  const piece = hint.piece ? { piece: t(`piece.${hint.piece}`).toLowerCase() } : {};
  return t(hint.key, { ...hint.values, ...piece });
}

/** Moves made in the round from its dice; the round starts when no die is used yet. */
export function roundProgress(dice: { faces: PieceName[]; remaining: PieceName[] } | null): {
  done: number;
  atStart: boolean;
} {
  if (!dice) return { done: 0, atStart: false };
  const done = dice.faces.length - dice.remaining.length;
  return { done, atStart: done === 0 };
}

/**
 * Forbidden squares whose move dot the board hides: for the selected piece, its forbidden
 * squares it may not go to; with nothing selected, squares no piece may go to.
 */
export function hiddenTargets(allowed: Dests, blocked: readonly BlockedMove[], selected: Key | undefined): Key[] {
  const allowedFor = (orig: Key) => allowed.get(orig) ?? [];
  const anyAllowed = new Set([...allowed.values()].flat());
  const hidden = new Set<Key>();
  for (const b of blocked) {
    const dest = to(b.move);
    if (selected !== undefined) {
      if (from(b.move) === selected && !allowedFor(selected).includes(dest)) hidden.add(dest);
    } else if (!anyAllowed.has(dest)) {
      hidden.add(dest);
    }
  }
  return [...hidden];
}

/** What decides the hint shown now; `roundKey` changes with every new round. */
export interface HintInput {
  roundKey: string;
  ownRound: boolean;
  atRoundStart: boolean;
  hasMoves: boolean;
  kingAttackers: readonly string[];
}

/** The hint the player set in a round: a forbidden move, or none after a move. */
export interface HintMemo {
  roundKey: string;
  hint: Hint | null;
}

/**
 * The hint to show: only in the own round. A hint from a forbidden move lasts until the
 * player moves, tries again or the round ends; the attacked king shows at the round start.
 */
export function visibleHint(memo: HintMemo | null, input: HintInput): Hint | null {
  if (!input.ownRound) return null;
  const hint = memo && memo.roundKey === input.roundKey ? memo.hint : startHint(input);
  if (hint?.rule === 'king-attacked' && !input.atRoundStart) return null;
  return hint;
}

function startHint(input: HintInput): Hint | null {
  return input.atRoundStart && input.hasMoves && input.kingAttackers.length > 0 ? kingAttackedHint() : null;
}
