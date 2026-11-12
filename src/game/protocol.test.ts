// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import type { PieceName } from '../api';
import type { GameStarted } from '../lobby/protocol';
import type { MoveNotation, RoundRecord } from './record';
import {
  canOfferDraw,
  clockRemaining,
  formatClock,
  fromStart,
  type GameMessage,
  type GameStateMessage,
  type MoveMade,
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

describe('game record (GS-09)', () => {
  const e3: MoveNotation = { piece: 'pawn', origin: '', capture: false, to: 'e3', promotion: null, castling: null };
  const f6: MoveNotation = { ...e3, piece: 'knight', to: 'f6' };

  function step(game: OnlineGame | null, message: GameMessage): OnlineGame {
    const next = reduceGame(game, message, 0);
    if (!next) throw new Error('no game');
    return next;
  }

  const roll = (version: number, color: 'white' | 'black', faces: PieceName[]): RoundRolled => ({
    type: 'round_rolled',
    game_id: 'g1',
    version,
    color,
    faces,
    allowed_moves: [],
    moves_left: 0,
    clocks: clocks(180000, 180000, color),
  });

  const made = (version: number, color: 'white' | 'black', notation: MoveNotation): MoveMade => ({
    type: 'move_made',
    game_id: 'g1',
    version,
    color,
    move: 'x',
    notation,
    fen: AFTER_E3,
    remaining: [],
    allowed_moves: [],
    moves_left: 0,
    clocks: clocks(180000, 180000, null),
  });

  it('a roll opens a round and a move goes into it', () => {
    let game = step(fromStart(started, 0), roll(1, 'white', ['pawn', 'pawn', 'pawn']));
    game = step(game, made(2, 'white', e3));
    expect(game.record).toEqual([{ color: 'white', faces: ['pawn', 'pawn', 'pawn'], moves: [e3], skipped: false }]);
  });

  it("L-088: the skip stays in the record after the bot's round and the next roll", () => {
    let game = step(fromStart(started, 0), roll(1, 'white', ['knight', 'knight', 'knight']));
    game = step(game, made(2, 'white', { ...e3, piece: 'knight', to: 'f3' }));
    game = step(game, roll(3, 'black', ['rook', 'pawn', 'pawn']));
    game = step(game, {
      type: 'turn_skipped',
      game_id: 'g1',
      version: 4,
      color: 'black',
      fen: START_FEN,
      clocks: clocks(180000, 180000, null),
    });
    game = step(game, roll(5, 'white', ['pawn', 'pawn', 'pawn']));
    game = step(game, made(6, 'white', e3));
    game = step(game, roll(7, 'black', ['knight', 'pawn', 'pawn']));

    expect(game.skipped).toBeNull();
    expect(game.record[1]).toEqual({ color: 'black', faces: ['rook', 'pawn', 'pawn'], moves: [], skipped: true });
    expect(game.record.map((r) => r.moves.length)).toEqual([1, 0, 1, 0]);
  });

  it('L-089: a snapshot replaces the record, with the unfinished round', () => {
    const record: RoundRecord[] = [
      { color: 'white', faces: ['pawn', 'pawn', 'pawn'], moves: [e3], skipped: false },
      { color: 'black', faces: ['knight', 'pawn', 'pawn'], moves: [f6], skipped: false },
    ];
    const stale = step(fromStart(started, 0), roll(1, 'white', ['bishop', 'bishop', 'bishop']));
    const snapshot: GameStateMessage = {
      type: 'game_state',
      game_id: 'g1',
      version: 4,
      color: 'black',
      white: { kind: 'guest', id: 'o', display_name: 'Guest-0002' },
      black: { kind: 'user', id: 'me', display_name: 'Alice' },
      mode: 'blitz',
      increment: null,
      fen: AFTER_E3,
      turn: 'black',
      dice: { color: 'black', faces: ['knight', 'pawn', 'pawn'], remaining: ['pawn', 'pawn'] },
      allowed_moves: ['e7e6'],
      moves_left: 2,
      last_move: 'g8f6',
      draw_offers: [],
      clocks: clocks(170000, 175000, 'black'),
      result: null,
      record,
    };

    expect(step(stale, snapshot).record).toEqual(snapshot.record);
  });

  it('a move without notation (older server) keeps the record', () => {
    let game = step(fromStart(started, 0), roll(1, 'white', ['pawn', 'pawn', 'pawn']));
    game = step(game, { ...made(2, 'white', e3), notation: undefined });
    expect(game.record[0]?.moves).toEqual([]);
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
