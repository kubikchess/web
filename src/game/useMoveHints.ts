// SPDX-License-Identifier: GPL-3.0-or-later
import type { Key, Piece } from 'chessground/types';
import { useCallback, useMemo, useState } from 'react';

import type { ColorName, PieceName } from '../api';
import {
  type BlockedMove,
  dropHint,
  findBlocked,
  type Hint,
  type HintInput,
  type HintMemo,
  noDieHint,
  roundProgress,
  visibleHint,
} from './hints';

/** The hint of the game screen and of hot-seat (GS-12, GS-13): set on a try, cleared by a move. */
export function useMoveHints(input: HintInput): {
  hint: Hint | null;
  show: (hint: Hint) => void;
  clear: () => void;
} {
  const [memo, setMemo] = useState<HintMemo | null>(null);
  const { roundKey } = input;
  const show = useCallback((hint: Hint) => setMemo({ roundKey, hint }), [roundKey]);
  const clear = useCallback(() => setMemo({ roundKey, hint: null }), [roundKey]);
  return { hint: visibleHint(memo, input), show, clear };
}

export interface BoardHintsInput {
  roundKey: string; // changes with every new round
  ownRound: boolean; // the side on this screen moves now
  color: ColorName; // that side
  dice: { faces: PieceName[]; remaining: PieceName[] } | null;
  movesLeft: number;
  hasMoves: boolean;
  blocked: readonly BlockedMove[];
  kingAttackers: readonly string[];
}

const NONE: readonly BlockedMove[] = [];
const NO_ARROWS: readonly [Key, Key][] = [];

/** Hints wired to the board: a drop on a forbidden square, a piece without a die. */
export function useBoardHints(input: BoardHintsInput) {
  const { roundKey, ownRound, color, dice, movesLeft, hasMoves, kingAttackers } = input;
  const progress = roundProgress(dice);
  const { hint, show, clear } = useMoveHints({
    roundKey,
    ownRound,
    atRoundStart: progress.atStart,
    hasMoves,
    kingAttackers,
  });
  const blocked = ownRound ? input.blocked : NONE;

  /** True when the drop is a forbidden move: the hint is shown and nothing is sent. */
  const tryForbidden = useCallback(
    (from: Key, to: Key): boolean => {
      const forbidden = findBlocked(blocked, from, to);
      if (!forbidden) return false;
      show(dropHint(forbidden, { done: progress.done, movesLeft }));
      return true;
    },
    [blocked, show, progress.done, movesLeft],
  );

  const onSelect = useCallback(
    (_square: Key, piece: Piece | undefined) => {
      if (!ownRound || !dice || !piece || piece.color !== color) return;
      const role = piece.role as PieceName;
      if (!dice.remaining.includes(role)) show(noDieHint(role));
    },
    [ownRound, dice, color, show],
  );

  const arrows = useMemo(() => hint?.arrows ?? NO_ARROWS, [hint]);
  return { hint, blocked, arrows, tryForbidden, onSelect, clear };
}
