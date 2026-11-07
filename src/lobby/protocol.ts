// SPDX-License-Identifier: GPL-3.0-or-later
// WebSocket /ws lobby messages (docs/api.md) and the client state built from them.

import type { Participant } from '../authApi';
import { fromStart, type GameCommand, type GameMessage, type OnlineGame, reduceGame } from '../game/protocol';

export type Mode = 'blitz' | 'rapid';
export type CreatorColor = 'white' | 'black' | 'random';
export type Status = 'idle' | 'queued' | 'offer' | 'in_game';

/** PAR-06: increments offered by the forms; the server accepts any 5–30. */
export const INCREMENT_CHOICES: readonly (number | null)[] = [null, 5, 10, 15, 20, 25, 30];
export const MODES: readonly Mode[] = ['blitz', 'rapid'];
export const CREATOR_COLORS: readonly CreatorColor[] = ['white', 'black', 'random'];

export interface Member {
  kind: 'user' | 'guest' | 'bot';
  id: string;
  display_name: string;
}

export interface Offer {
  offer_id: string;
  creator: Member;
  mode: Mode;
  increment: number | null;
  color: CreatorColor;
  created_at: string;
  expires_at: string;
}

export interface ParticipantStateMessage {
  type: 'participant_state';
  version: number;
  participant: Participant;
  status: Status;
  queue: { mode: Mode; increment: number | null } | null;
  offer: Offer | null;
  game_id: string | null;
}

export interface GameStarted {
  type: 'game_started';
  game_id: string;
  version: number;
  color: 'white' | 'black';
  opponent: Member;
  mode: Mode;
  increment: number | null;
  clocks: { white: number; black: number };
  fen: string;
}

export interface LobbySnapshot {
  type: 'lobby_snapshot';
  version: number;
  offers: Offer[];
}

export interface LobbyUpdate {
  type: 'lobby_update';
  version: number;
  added?: Offer;
  removed?: string;
}

export interface Ack {
  type: 'ack';
  request_id: string | null;
}

export interface ErrorReply {
  type: 'error';
  request_id: string | null;
  code: string;
  reason?: string;
  status?: Status;
  retry_after?: number;
  current_version?: number;
}

export type ServerMessage =
  | ParticipantStateMessage
  | GameStarted
  | LobbySnapshot
  | LobbyUpdate
  | Ack
  | ErrorReply
  | GameMessage;

export type Command =
  | { type: 'queue_join'; mode: Mode; increment: number | null }
  | { type: 'queue_leave' }
  | { type: 'game_create'; mode: Mode; increment: number | null; color: CreatorColor }
  | { type: 'game_cancel' }
  | { type: 'game_accept'; offer_id: string }
  | { type: 'bot_game_create'; mode: Mode; increment: number | null; color: CreatorColor }
  | GameCommand;

export interface LobbyState {
  me: ParticipantStateMessage | null;
  listVersion: number | null; // null until the first snapshot
  offers: Offer[]; // visible games without the own one (CG-07), oldest first
  game: OnlineGame | null; // the current game, kept after its end until dismissed
  needsResync: boolean; // an update was missed: reconnect for a new snapshot
}

export const initialLobby: LobbyState = {
  me: null,
  listVersion: null,
  offers: [],
  game: null,
  needsResync: false,
};

/** `at` is the local receipt time (performance.now), for the game clocks. */
export function reduceLobby(state: LobbyState, message: ServerMessage, at = 0): LobbyState {
  switch (message.type) {
    case 'participant_state': {
      if (state.me && message.version < state.me.version) return state;
      return { ...state, me: message, game: gameAfterState(state.game, message) };
    }
    case 'game_started':
      return { ...state, game: fromStart(message, at) };
    case 'lobby_snapshot':
      return { ...state, listVersion: message.version, offers: message.offers, needsResync: false };
    case 'lobby_update':
      return applyUpdate(state, message);
    case 'ack':
    case 'error':
      return state;
    default:
      return { ...state, game: reduceGame(state.game, message, at) };
  }
}

/** The participant left a game whose end the page has not seen: ask for its final state. */
function gameAfterState(game: OnlineGame | null, me: ParticipantStateMessage): OnlineGame | null {
  if (!game || game.result) return game;
  if (me.status === 'in_game' && me.game_id === game.gameId) return game;
  return { ...game, needsSync: true };
}

function applyUpdate(state: LobbyState, update: LobbyUpdate): LobbyState {
  if (state.listVersion === null || update.version <= state.listVersion) return state;
  if (update.version !== state.listVersion + 1) return { ...state, needsResync: true };
  let offers = state.offers;
  if (update.added) offers = [...offers, update.added];
  if (update.removed) offers = offers.filter((o) => o.offer_id !== update.removed);
  return { ...state, offers, listVersion: update.version };
}

/** CG-08: the list filter by mode. */
export function visibleOffers(offers: readonly Offer[], mode: Mode | 'all'): Offer[] {
  return offers.filter((o) => mode === 'all' || o.mode === mode);
}
