// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import {
  type GameStarted,
  INCREMENT_CHOICES,
  initialLobby,
  type LobbyState,
  type Offer,
  type ParticipantStateMessage,
  reduceLobby,
  visibleOffers,
} from './protocol';

const offer = (id: string, mode: 'blitz' | 'rapid' = 'blitz'): Offer => ({
  offer_id: id,
  creator: { kind: 'user', id: `u-${id}`, display_name: `P${id}` },
  mode,
  increment: 5,
  color: 'random',
  created_at: '2026-11-04T12:00:00Z',
  expires_at: '2026-11-04T12:10:00Z',
});

const state = (version: number, status: ParticipantStateMessage['status']): ParticipantStateMessage => ({
  type: 'participant_state',
  version,
  participant: { kind: 'guest', id: 'g', display_name: 'Guest-0001', role: null, email_verified: false },
  status,
  queue: null,
  offer: null,
  game_id: status === 'in_game' ? 'game-1' : null,
});

const started: GameStarted = {
  type: 'game_started',
  game_id: 'game-1',
  version: 0,
  color: 'white',
  opponent: { kind: 'guest', id: 'g2', display_name: 'Guest-0002' },
  mode: 'blitz',
  increment: 5,
  clocks: { white: 180000, black: 180000 },
  fen: 'start',
};

const withList = (version: number, offers: Offer[]): LobbyState =>
  reduceLobby(initialLobby, { type: 'lobby_snapshot', version, offers });

describe('participant state', () => {
  it('keeps the newest version', () => {
    const newer = reduceLobby(initialLobby, state(3, 'queued'));
    expect(reduceLobby(newer, state(2, 'idle')).me?.status).toBe('queued');
    expect(reduceLobby(newer, state(4, 'idle')).me?.status).toBe('idle');
  });

  it('asks for the final state of a game left without a seen end', () => {
    let lobby = reduceLobby(initialLobby, started);
    lobby = reduceLobby(lobby, state(1, 'in_game'));
    expect(lobby.game?.gameId).toBe('game-1');
    expect(lobby.game?.needsSync).toBe(false);
    expect(reduceLobby(lobby, state(2, 'idle')).game?.needsSync).toBe(true);
  });

  it('keeps a finished game for its result page', () => {
    let lobby = reduceLobby(initialLobby, started);
    const result = { winner: 'white' as const, reason: 'resignation' };
    lobby = { ...lobby, game: lobby.game && { ...lobby.game, result } };
    expect(reduceLobby(lobby, state(2, 'idle')).game?.result).toEqual(result);
  });
});

describe('game list', () => {
  it('takes the snapshot as is', () => {
    const lobby = withList(7, [offer('a')]);
    expect(lobby.listVersion).toBe(7);
    expect(lobby.offers.map((o) => o.offer_id)).toEqual(['a']);
  });

  it('applies the next versions and ignores old ones', () => {
    let lobby = withList(7, [offer('a')]);
    lobby = reduceLobby(lobby, { type: 'lobby_update', version: 7, added: offer('x') }); // in the snapshot
    lobby = reduceLobby(lobby, { type: 'lobby_update', version: 8, added: offer('b') });
    lobby = reduceLobby(lobby, { type: 'lobby_update', version: 9, removed: 'a' });
    lobby = reduceLobby(lobby, { type: 'lobby_update', version: 10 }); // own offer: version only
    expect(lobby.offers.map((o) => o.offer_id)).toEqual(['b']);
    expect(lobby.listVersion).toBe(10);
    expect(lobby.needsResync).toBe(false);
  });

  it('asks for a new snapshot after a gap', () => {
    const lobby = reduceLobby(withList(7, []), { type: 'lobby_update', version: 9, added: offer('b') });
    expect(lobby.needsResync).toBe(true);
    expect(lobby.offers).toEqual([]);
  });

  it('waits for the snapshot before applying updates', () => {
    const lobby = reduceLobby(initialLobby, { type: 'lobby_update', version: 1, added: offer('b') });
    expect(lobby.offers).toEqual([]);
    expect(lobby.needsResync).toBe(false);
  });

  it('filters by mode (CG-08)', () => {
    const offers = [offer('a', 'blitz'), offer('b', 'rapid')];
    expect(visibleOffers(offers, 'all').length).toBe(2);
    expect(visibleOffers(offers, 'rapid').map((o) => o.offer_id)).toEqual(['b']);
  });
});

describe('form choices', () => {
  it('offers the increments of PAR-06', () => {
    expect(INCREMENT_CHOICES).toEqual([null, 5, 10, 15, 20, 25, 30]);
  });
});

describe('game start', () => {
  it('opens the game page with stopped clocks', () => {
    const game = reduceLobby(initialLobby, started, 42).game;
    expect(game?.gameId).toBe('game-1');
    expect(game?.color).toBe('white');
    expect(game?.clocks).toEqual({ white: 180000, black: 180000, running: null });
    expect(game?.clocksAt).toBe(42);
  });

  it('passes game events to the game', () => {
    let lobby = reduceLobby(initialLobby, started);
    lobby = reduceLobby(lobby, { type: 'draw_offered', game_id: 'game-1', version: 1, color: 'black' });
    expect(lobby.game?.drawOffers).toEqual(['black']);
  });
});
