// SPDX-License-Identifier: GPL-3.0-or-later
// Online game messages of /ws (docs/api.md) and the game state built from them.
// No rules here: the server sends the dice, allowed moves and clocks (ADR 0006).

import type { ColorName, PieceName } from '../api';
import type { GameStarted, Member, Mode } from '../lobby/protocol';

export interface Clocks {
  white: number; // ms left at the moment of the message
  black: number;
  running: ColorName | null;
}

export interface GameResult {
  winner: ColorName | null; // null: a draw
  reason: string;
}

export interface OnlineDice {
  color: ColorName;
  faces: PieceName[];
  remaining: PieceName[];
}

interface Event {
  game_id: string;
  version: number;
}

export interface RoundRolled extends Event {
  type: 'round_rolled';
  color: ColorName;
  faces: PieceName[];
  allowed_moves: string[];
  moves_left: number;
  clocks: Clocks;
}

export interface MoveMade extends Event {
  type: 'move_made';
  color: ColorName;
  move: string;
  fen: string;
  remaining: PieceName[];
  allowed_moves: string[];
  moves_left: number;
  clocks: Clocks;
}

export interface TurnSkipped extends Event {
  type: 'turn_skipped';
  color: ColorName;
  fen: string;
  clocks: Clocks;
}

export interface DrawNotice extends Event {
  type: 'draw_offered' | 'draw_offer_lapsed';
  color: ColorName;
}

export interface GameFinished extends Event {
  type: 'game_finished';
  result: GameResult;
  clocks: Clocks;
}

export interface GameStateMessage extends Event {
  type: 'game_state';
  color: ColorName;
  white: Member;
  black: Member;
  mode: Mode;
  increment: number | null;
  fen: string;
  turn: ColorName;
  dice: OnlineDice | null;
  allowed_moves: string[];
  moves_left: number;
  last_move: string | null;
  draw_offers: ColorName[];
  clocks: Clocks;
  result: GameResult | null;
}

/** A round the server skipped: no move was possible with these dice (T-075). */
export interface SkippedRound {
  color: ColorName;
  faces: PieceName[];
}

export type GameEvent = RoundRolled | MoveMade | TurnSkipped | DrawNotice | GameFinished;
export type GameMessage = GameEvent | GameStateMessage;

export type GameCommand =
  | { type: 'move'; game_id: string; version: number; move: string }
  | { type: 'resign'; game_id: string }
  | { type: 'draw_offer'; game_id: string; version: number }
  | { type: 'draw_accept'; game_id: string }
  | { type: 'game_sync'; game_id: string };

export const GAME_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  'round_rolled',
  'move_made',
  'turn_skipped',
  'draw_offered',
  'draw_offer_lapsed',
  'game_finished',
  'game_state',
]);

export interface OnlineGame {
  gameId: string;
  version: number;
  color: ColorName; // own color
  opponent: Member;
  mode: Mode;
  increment: number | null;
  fen: string;
  turn: ColorName;
  dice: OnlineDice | null;
  allowedMoves: string[];
  movesLeft: number;
  lastMove: string | null;
  drawOffers: ColorName[];
  clocks: Clocks;
  clocksAt: number; // local time (performance.now) when the clocks arrived
  result: GameResult | null;
  skipped: SkippedRound | null; // shown until the skipped side rolls again
  needsSync: boolean; // a version was missed: ask for game_state
}

export function turnOf(fen: string): ColorName {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function fromStart(started: GameStarted, at: number): OnlineGame {
  return {
    gameId: started.game_id,
    version: started.version,
    color: started.color,
    opponent: started.opponent,
    mode: started.mode,
    increment: started.increment,
    fen: started.fen,
    turn: turnOf(started.fen),
    dice: null,
    allowedMoves: [],
    movesLeft: 0,
    lastMove: null,
    drawOffers: [],
    clocks: { ...started.clocks, running: null },
    clocksAt: at,
    result: null,
    skipped: null,
    needsSync: false,
  };
}

function fromSnapshot(message: GameStateMessage, at: number): OnlineGame {
  return {
    gameId: message.game_id,
    version: message.version,
    color: message.color,
    opponent: message.color === 'white' ? message.black : message.white,
    mode: message.mode,
    increment: message.increment,
    fen: message.fen,
    turn: message.turn,
    dice: message.dice,
    allowedMoves: message.allowed_moves,
    movesLeft: message.moves_left,
    lastMove: message.last_move,
    drawOffers: message.draw_offers,
    clocks: message.clocks,
    clocksAt: at,
    result: message.result,
    skipped: null,
    needsSync: false,
  };
}

/** The game after one message; `at` is the local receipt time for the clocks (T-077). */
export function reduceGame(game: OnlineGame | null, message: GameMessage, at: number): OnlineGame | null {
  if (message.type === 'game_state') {
    if (game && game.gameId === message.game_id && message.version < game.version) return game;
    return fromSnapshot(message, at);
  }
  if (!game || game.gameId !== message.game_id || message.version <= game.version) return game;
  if (message.version !== game.version + 1) return { ...game, needsSync: true };
  const next = { ...game, version: message.version };
  switch (message.type) {
    case 'round_rolled':
      return {
        ...next,
        turn: message.color,
        dice: { color: message.color, faces: message.faces, remaining: message.faces },
        allowedMoves: message.allowed_moves,
        movesLeft: message.moves_left,
        clocks: message.clocks,
        clocksAt: at,
        // The opponent's roll comes in the same instant as the skip: keep showing why.
        skipped: next.skipped?.color === message.color ? null : next.skipped,
      };
    case 'move_made':
      return {
        ...next,
        fen: message.fen,
        turn: turnOf(message.fen),
        dice: next.dice ? { ...next.dice, remaining: message.remaining } : null,
        allowedMoves: message.allowed_moves,
        movesLeft: message.moves_left,
        lastMove: message.move,
        clocks: message.clocks,
        clocksAt: at,
      };
    case 'turn_skipped':
      return {
        ...next,
        fen: message.fen,
        turn: turnOf(message.fen),
        allowedMoves: [],
        movesLeft: 0,
        clocks: message.clocks,
        clocksAt: at,
        skipped: { color: message.color, faces: next.dice?.faces ?? [] },
      };
    case 'draw_offered':
      return { ...next, drawOffers: [...next.drawOffers.filter((c) => c !== message.color), message.color] };
    case 'draw_offer_lapsed':
      return { ...next, drawOffers: next.drawOffers.filter((c) => c !== message.color) };
    case 'game_finished':
      return {
        ...next,
        result: message.result,
        allowedMoves: [],
        movesLeft: 0,
        drawOffers: [],
        clocks: message.clocks,
        clocksAt: at,
      };
  }
}

/** Time left on a clock now; the running one counts down from its message (no rules). */
export function clockRemaining(game: OnlineGame, color: ColorName, now: number): number {
  const stored = game.clocks[color];
  if (game.clocks.running !== color) return stored;
  return Math.max(0, stored - Math.max(0, now - game.clocksAt));
}

export function formatClock(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function isOwnRound(game: OnlineGame): boolean {
  return game.result === null && game.turn === game.color && game.allowedMoves.length > 0;
}

/** T-081, T-082: in the own round, and not again while the own offer stands. */
export function canOfferDraw(game: OnlineGame): boolean {
  return isOwnRound(game) && !game.drawOffers.includes(game.color);
}

export function canAcceptDraw(game: OnlineGame): boolean {
  const opponent: ColorName = game.color === 'white' ? 'black' : 'white';
  return game.result === null && game.drawOffers.includes(opponent);
}
