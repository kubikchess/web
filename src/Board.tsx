// SPDX-License-Identifier: GPL-3.0-or-later
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Dests, Key, Piece } from 'chessground/types';
import { useEffect, useMemo, useRef } from 'react';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

import type { ColorName } from './api';
import { type BlockedMove, hiddenTargets } from './game/hints';
import { toDests } from './moves';

interface BoardProps {
  fen: string; // placement field only
  turn: ColorName;
  dests: Dests; // allowed moves from the server
  lastMove: [Key, Key] | undefined;
  interactive: boolean;
  onMove: (from: Key, to: Key) => void;
  orientation?: ColorName; // the side at the bottom; white by default
  /** Bump to put the server position back, e.g. after a rejected or cancelled move. */
  resync?: number;
  /** Forbidden moves (GS-11): a piece may be dropped there for a hint, without a move dot. */
  blocked?: readonly BlockedMove[];
  /** A square was picked, with the piece on it, if any (a piece without a die, GS-12). */
  onSelect?: (square: Key, piece: Piece | undefined) => void;
  /** Arrows from attacking pieces (GS-12). */
  arrows?: readonly [Key, Key][];
}

const NO_BLOCKED: readonly BlockedMove[] = [];
const NO_ARROWS: readonly [Key, Key][] = [];
/** The class that hides the move dot of a forbidden square (styles.css). */
const HIDDEN_DEST = 'blocked-dest';

function hiddenMap(squares: Key[]): Map<Key, string> {
  return new Map(squares.map((square) => [square, HIDDEN_DEST]));
}

/**
 * chessground board showing the server position. A dropped piece stays on its new square while
 * the move is on its way: only a new server position, or `resync`, moves the pieces.
 */
export function Board({
  fen,
  turn,
  dests,
  lastMove,
  interactive,
  onMove,
  orientation = 'white',
  resync = 0,
  blocked = NO_BLOCKED,
  onSelect,
  arrows = NO_ARROWS,
}: BoardProps) {
  const element = useRef<HTMLDivElement>(null);
  const board = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);
  const onSelectRef = useRef(onSelect);
  const allowedRef = useRef(dests);
  const blockedRef = useRef(blocked);

  useEffect(() => {
    onMoveRef.current = onMove;
    onSelectRef.current = onSelect;
    allowedRef.current = dests;
    blockedRef.current = blocked;
  }, [onMove, onSelect, dests, blocked]);

  useEffect(() => {
    if (!element.current) return;
    const api = Chessground(element.current, {
      coordinates: true,
      premovable: { enabled: false },
      // Arrows of the hints only; the player does not draw.
      drawable: { enabled: false, visible: true },
      highlight: { lastMove: true, check: false },
      movable: {
        free: false,
        showDests: true,
        events: { after: (from, to) => onMoveRef.current(from, to) },
      },
      events: {
        select: (square) => {
          // Dots of the selected piece: its forbidden squares stay without one.
          const selected = api.state.selected;
          api.set({ highlight: { custom: hiddenMap(hiddenTargets(allowedRef.current, blockedRef.current, selected)) } });
          onSelectRef.current?.(square, api.state.pieces.get(square));
        },
      },
    });
    board.current = api;
    return () => {
      api.destroy();
      board.current = null;
    };
  }, []);

  // Position: not on interactivity changes, or the dropped piece would jump back until the reply.
  useEffect(() => {
    board.current?.set({ fen, orientation, lastMove });
  }, [fen, lastMove, orientation, resync]);

  // Forbidden squares take drops too, so that the page can tell why the move is not allowed.
  const movable = useMemo(() => {
    const all: Dests = new Map([...dests].map(([from, targets]) => [from, [...targets]]));
    for (const [from, targets] of toDests(blocked.map((b) => b.move))) {
      all.set(from, [...new Set([...(all.get(from) ?? []), ...targets])]);
    }
    return all;
  }, [dests, blocked]);

  // Also on resync: after a drop chessground passes the turn and drops the dests itself.
  useEffect(() => {
    board.current?.set({
      turnColor: turn,
      movable: { color: interactive ? turn : undefined, dests: interactive ? movable : new Map() },
      highlight: { custom: hiddenMap(interactive ? hiddenTargets(dests, blocked, undefined) : []) },
    });
  }, [turn, movable, dests, blocked, interactive, resync]);

  useEffect(() => {
    board.current?.setAutoShapes(arrows.map(([orig, dest]) => ({ orig, dest, brush: 'red' })));
  }, [arrows]);

  return <div className="board" ref={element} data-testid="board" />;
}
