// SPDX-License-Identifier: GPL-3.0-or-later
// Development hot-seat API client (docs/api.md, "Служебный API: hot-seat").

import type { RoundRecord } from './game/record';
import { ApiError, request } from './http';

export type ColorName = 'white' | 'black';
export type PieceName = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

export interface DiceState {
  color: ColorName;
  faces: PieceName[];
  remaining: PieceName[];
  skipped: boolean;
}

export interface ResultState {
  winner: ColorName | null;
  reason: string;
}

export interface GameState {
  game_id: string;
  version: number;
  fen: string;
  turn: ColorName;
  phase: 'roll' | 'move' | 'finished';
  dice: DiceState | null;
  allowed_moves: string[];
  moves_left: number;
  last_move: string | null;
  no_capture_moves: number;
  skipped_rounds: number;
  result: ResultState | null;
  record: RoundRecord[]; // the game record (GS-09)
}

const GAMES = '/dev/hot-seat/games';

async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<GameState> {
  const state = await request<GameState>(method, path, body);
  if (state === null) throw new ApiError(502);
  return state;
}

export const api = {
  create: () => call('POST', GAMES, {}),
  get: (gameId: string) => call('GET', `${GAMES}/${encodeURIComponent(gameId)}`),
  roll: (gameId: string, version: number) =>
    call('POST', `${GAMES}/${encodeURIComponent(gameId)}/roll`, { version }),
  move: (gameId: string, version: number, move: string) =>
    call('POST', `${GAMES}/${encodeURIComponent(gameId)}/moves`, { version, move }),
};
