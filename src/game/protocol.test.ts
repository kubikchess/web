// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import type { GameStarted } from '../lobby/protocol';
import {
  canOfferDraw,
  clockRemaining,
  formatClock,
  fromStart,
  type GameStateMessage,
  type OnlineGame,
  reduceGame,
  type RoundRolled,
  turnOf,
} from './protocol';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0';
const AFTER_E3 = 'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR w KQkq - 1';

const started: GameStarted = {
  type: 'game_started',
  game_id: 'g1',
  version: 0,
  color: 'black',
  opponent: { kind: 'guest', id: 'o', display_name: 'Guest-0002' },
  mode: 'blitz',
  increment: null,
  clocks: { white: 180000, black: 180000 },
  fen: START_FEN,
};

const clocks = (white: number, black: number, running: 'white' | 'black' | null) => ({
  white,
  black,
  running,
});

function rolled(game: OnlineGame, at = 1000): OnlineGame {
  const next = reduceGame(
    game,
    {
      type: 'round_rolled',
      game_id: 'g1',
      version: 1,
      color: 'white',
      faces: ['pawn', 'pawn', 'knight'],
      allowed_moves: ['e2e3', 'g1f3'],
      moves_left: 3,
      clocks: clocks(180000, 180000, 'white'),
    },
    at,
  );
  if (!next) throw new Error('no game');
  return next;
}

describe('game start', () => {
  it('waits for the first roll with stopped clocks', () => {
    const game = fromStart(started, 0);
    expect(game.version).toBe(0);
    expect(game.color).toBe('black');
    expect(game.opponent.display_name).toBe('Guest-0002');
    expect(game.allowedMoves).toEqual([]);
    expect(game.clocks.running).toBeNull();
    expect(game.turn).toBe('white');
  });
});

describe('events', () => {
  it('a roll starts the round and the clock', () => {
    const game = rolled(fromStart(started, 0));
    expect(game.version).toBe(1);
    expect(game.dice).toEqual({ color: 'white', faces: ['pawn', 'pawn', 'knight'], remaining: ['pawn', 'pawn', 'knight'] });
    expect(game.allowedMoves).toEqual(['e2e3', 'g1f3']);
    expect(game.clocks.running).toBe('white');
    expect(game.skipped).toBeNull();
  });

  it('a move updates the position, dice and clocks', () => {
    const game = reduceGame(
      rolled(fromStart(started, 0)),
      {
        type: 'move_made',
        game_id: 'g1',
        version: 2,
        color: 'white',
        move: 'e2e3',
        fen: AFTER_E3,
        remaining: ['pawn', 'knight'],
        allowed_moves: ['d2d3'],
        moves_left: 2,
        clocks: clocks(178000, 180000, 'white'),
      },
      3000,
    );
    expect(game?.fen).toBe(AFTER_E3);
    expect(game?.lastMove).toBe('e2e3');
    expect(game?.dice?.remaining).toEqual(['pawn', 'knight']);
    expect(game?.clocks.white).toBe(178000);
    expect(game?.clocksAt).toBe(3000);
  });

  it('a skipped round passes the turn without spending time', () => {
    const game = reduceGame(
      rolled(fromStart(started, 0)),
      {
        type: 'turn_skipped',
        game_id: 'g1',
        version: 2,
        color: 'white',
        fen: START_FEN.replace(' w ', ' b '),
        clocks: clocks(180000, 180000, null),
      },
      2000,
    );
    expect(game?.skipped).toEqual({ color: 'white', faces: ['pawn', 'pawn', 'knight'] });
    expect(game?.turn).toBe('black');
    expect(game?.allowedMoves).toEqual([]);
  });

  it("the skip stays visible during the opponent's round, then goes (T-075)", () => {
    // The server skips and rolls for the opponent in the same instant: the next roll must not
    // hide why the opponent moves first.
    let game = reduceGame(
      fromStart(started, 0),
      {
        type: 'round_rolled',
        game_id: 'g1',
        version: 1,
        color: 'white',
        faces: ['bishop', 'rook', 'bishop'],
        allowed_moves: [],
        moves_left: 0,
        clocks: clocks(180000, 180000, 'white'),
      },
      0,
    );
    game = reduceGame(
      game,
      {
        type: 'turn_skipped',
        game_id: 'g1',
        version: 2,
        color: 'white',
        fen: START_FEN.replace(' w ', ' b '),
        clocks: clocks(180000, 180000, null),
      },
      0,
    );
    const roll = (version: number, color: 'white' | 'black'): RoundRolled => ({
      type: 'round_rolled',
      game_id: 'g1',
      version,
      color,
      faces: ['knight', 'knight', 'bishop'],
      allowed_moves: ['b8c6'],
      moves_left: 3,
      clocks: clocks(180000, 180000, color),
    });
    game = reduceGame(game, roll(3, 'black'), 0);
    expect(game?.skipped).toEqual({ color: 'white', faces: ['bishop', 'rook', 'bishop'] });

    game = reduceGame(game, roll(4, 'white'), 0); // white's next round
    expect(game?.skipped).toBeNull();
  });

  it('draw offers come and lapse', () => {
    let game = reduceGame(rolled(fromStart(started, 0)), { type: 'draw_offered', game_id: 'g1', version: 2, color: 'white' }, 0);
    expect(game?.drawOffers).toEqual(['white']);
    game = reduceGame(game, { type: 'draw_offer_lapsed', game_id: 'g1', version: 3, color: 'white' }, 0);
    expect(game?.drawOffers).toEqual([]);
  });

  it('the finish keeps the result and stops everything', () => {
    const game = reduceGame(
      rolled(fromStart(started, 0)),
      {
        type: 'game_finished',
        game_id: 'g1',
        version: 2,
        result: { winner: 'black', reason: 'resignation' },
        clocks: clocks(170000, 180000, null),
      },
      0,
    );
    expect(game?.result).toEqual({ winner: 'black', reason: 'resignation' });
    expect(game?.allowedMoves).toEqual([]);
    expect(game?.clocks.running).toBeNull();
  });

  it('ignores repeats, old versions and other games', () => {
    const game = rolled(fromStart(started, 0));
    const repeat = { type: 'draw_offered', game_id: 'g1', version: 1, color: 'white' } as const;
    expect(reduceGame(game, repeat, 0)).toBe(game);
    const other = { type: 'draw_offered', game_id: 'g2', version: 2, color: 'white' } as const;
    expect(reduceGame(game, other, 0)).toBe(game);
  });

  it('asks for a snapshot after a gap', () => {
    const game = reduceGame(rolled(fromStart(started, 0)), { type: 'draw_offered', game_id: 'g1', version: 5, color: 'white' }, 0);
    expect(game?.needsSync).toBe(true);
    expect(game?.drawOffers).toEqual([]);
  });
});

describe('snapshot', () => {
  const snapshot: GameStateMessage = {
    type: 'game_state',
    game_id: 'g1',
    version: 7,
    color: 'white',
    white: { kind: 'user', id: 'me', display_name: 'Alice' },
    black: { kind: 'guest', id: 'o', display_name: 'Guest-0002' },
    mode: 'rapid',
    increment: 5,
    fen: AFTER_E3,
    turn: 'white',
    dice: { color: 'white', faces: ['pawn', 'pawn', 'pawn'], remaining: ['pawn'] },
    allowed_moves: ['d2d3'],
    moves_left: 1,
    last_move: 'e2e3',
    draw_offers: ['black'],
    clocks: clocks(100000, 200000, 'white'),
    result: null,
  };

  it('replaces the state and ends a resync', () => {
    const waiting = { ...rolled(fromStart(started, 0)), needsSync: true };
    const game = reduceGame(waiting, snapshot, 500);
    expect(game?.version).toBe(7);
    expect(game?.color).toBe('white');
    expect(game?.opponent.display_name).toBe('Guest-0002');
    expect(game?.drawOffers).toEqual(['black']);
    expect(game?.needsSync).toBe(false);
    expect(game?.clocksAt).toBe(500);
  });

  it('starts a game the page did not know (reconnection, GS-03)', () => {
    expect(reduceGame(null, snapshot, 0)?.gameId).toBe('g1');
  });

  it('an older snapshot of the same game is ignored', () => {
    const newer = reduceGame(null, { ...snapshot, version: 9 }, 0);
    expect(reduceGame(newer, snapshot, 0)?.version).toBe(9);
  });
});

describe('helpers', () => {
  it('the running clock counts down locally and never goes below zero', () => {
    const game = rolled(fromStart(started, 0), 1000);
    expect(clockRemaining(game, 'white', 4500)).toBe(176500);
    expect(clockRemaining(game, 'black', 4500)).toBe(180000);
    expect(clockRemaining(game, 'white', 999999)).toBe(0);
  });

  it('formats minutes and seconds, rounding up', () => {
    expect(formatClock(180000)).toBe('3:00');
    expect(formatClock(59001)).toBe('1:00');
    expect(formatClock(9500)).toBe('0:10');
    expect(formatClock(0)).toBe('0:00');
  });

  it('reads the side to move from the FEN', () => {
    expect(turnOf(START_FEN)).toBe('white');
    expect(turnOf(START_FEN.replace(' w ', ' b '))).toBe('black');
  });

  it('a draw is offered only in the own round and once (T-081, T-082)', () => {
    const game = rolled({ ...fromStart(started, 0), color: 'white' });
    expect(canOfferDraw(game)).toBe(true);
    expect(canOfferDraw({ ...game, drawOffers: ['white'] })).toBe(false);
    expect(canOfferDraw({ ...game, color: 'black' })).toBe(false);
    expect(canOfferDraw({ ...game, result: { winner: null, reason: 'draw_agreed' } })).toBe(false);
  });
});
