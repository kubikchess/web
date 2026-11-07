// SPDX-License-Identifier: GPL-3.0-or-later
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Dests, Key } from 'chessground/types';
import { useEffect, useRef } from 'react';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';

import type { ColorName } from './api';

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
}: BoardProps) {
  const element = useRef<HTMLDivElement>(null);
  const board = useRef<Api | null>(null);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (!element.current) return;
    const api = Chessground(element.current, {
      coordinates: true,
      premovable: { enabled: false },
      drawable: { enabled: false },
      highlight: { lastMove: true, check: false },
      movable: {
        free: false,
        showDests: true,
        events: { after: (from, to) => onMoveRef.current(from, to) },
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

  useEffect(() => {
    board.current?.set({
      turnColor: turn,
      movable: { color: interactive ? turn : undefined, dests: interactive ? dests : new Map() },
    });
  }, [turn, dests, interactive]);

  return <div className="board" ref={element} data-testid="board" />;
}
