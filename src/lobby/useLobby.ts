// SPDX-License-Identifier: GPL-3.0-or-later
// The lobby WebSocket: state from server messages, commands answered by ack or error.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import {
  type Command,
  type ErrorReply,
  initialLobby,
  type LobbyState,
  reduceLobby,
  type ServerMessage,
} from './protocol';

export const CLOSE_SESSION_ENDED = 4401;
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 10000;

export class LobbyError extends Error {
  readonly code: string;
  readonly reason: string | undefined;
  readonly status: string | undefined;
  readonly retryAfter: number | undefined;

  constructor(reply: Pick<ErrorReply, 'code' | 'reason' | 'status' | 'retry_after'>) {
    super(`Lobby error ${reply.code}`);
    this.code = reply.code;
    this.reason = reply.reason;
    this.status = reply.status;
    this.retryAfter = reply.retry_after;
  }
}

interface Pending {
  resolve: () => void;
  reject: (error: LobbyError) => void;
}

type Action =
  | { type: 'message'; message: ServerMessage; at: number }
  | { type: 'reset' }
  | { type: 'game_gone' };

function reducer(state: LobbyState, action: Action): LobbyState {
  switch (action.type) {
    case 'reset': // a new connection sends a fresh snapshot; the own state is kept by version
      return { ...initialLobby, me: state.me, game: state.game };
    case 'game_gone': // left after its end, or dropped on the server
      return { ...state, game: null };
    case 'message':
      return reduceLobby(state, action.message, action.at);
  }
}

function socketUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws`;
}

export interface Lobby {
  state: LobbyState;
  connected: boolean;
  /** Resolves on ack, rejects with LobbyError on an error reply or a lost connection. */
  send: (command: Command) => Promise<void>;
  /** Back to the lobby from a finished game. */
  leaveGame: () => void;
}

/**
 * Keeps one connection while `participantId` is set; reconnects after drops.
 * `onSessionEnded` runs when the server closes with 4401 (logged out or blocked).
 */
export function useLobby(participantId: string | null, onSessionEnded: () => void): Lobby {
  const [state, dispatch] = useReducer(reducer, initialLobby);
  const [connected, setConnected] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const pending = useRef(new Map<string, Pending>());
  const nextId = useRef(0);
  const sessionEnded = useRef(onSessionEnded);

  useEffect(() => {
    sessionEnded.current = onSessionEnded;
  }, [onSessionEnded]);

  useEffect(() => {
    if (!participantId) return;
    let stopped = false;
    let delay = RECONNECT_MIN_MS;
    let timer: number | undefined;

    const failPending = () => {
      for (const request of pending.current.values()) {
        request.reject(new LobbyError({ code: 'disconnected' }));
      }
      pending.current.clear();
    };

    const open = () => {
      const ws = new WebSocket(socketUrl());
      socket.current = ws;
      ws.onopen = () => {
        delay = RECONNECT_MIN_MS;
        dispatch({ type: 'reset' });
        setConnected(true);
      };
      ws.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as ServerMessage;
        if (message.type === 'ack' || message.type === 'error') {
          const id = message.request_id;
          const request = id ? pending.current.get(id) : undefined;
          if (id && request) {
            pending.current.delete(id);
            if (message.type === 'ack') request.resolve();
            else request.reject(new LobbyError(message));
          }
          return;
        }
        dispatch({ type: 'message', message, at: performance.now() });
      };
      ws.onclose = (event) => {
        if (socket.current !== ws) return; // a replaced socket must not touch the live one
        socket.current = null;
        setConnected(false);
        failPending();
        if (stopped) return;
        if (event.code === CLOSE_SESSION_ENDED) {
          sessionEnded.current();
          return;
        }
        timer = window.setTimeout(open, delay);
        delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      };
    };

    open();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      const ws = socket.current;
      socket.current = null;
      if (ws) {
        // Detach first: in StrictMode the next effect opens a new socket before this one closes.
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.close();
      }
      setConnected(false);
      failPending();
    };
  }, [participantId]);

  // A missed list update: reconnect for a new snapshot (docs/api.md, lobby_update).
  useEffect(() => {
    if (state.needsResync) socket.current?.close();
  }, [state.needsResync]);

  const send = useCallback((command: Command) => {
    const ws = socket.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new LobbyError({ code: 'disconnected' }));
    }
    nextId.current += 1;
    const request_id = String(nextId.current);
    return new Promise<void>((resolve, reject) => {
      pending.current.set(request_id, { resolve, reject });
      ws.send(JSON.stringify({ ...command, request_id }));
    });
  }, []);

  // A missed game version, or a game left without a seen end: ask for its state.
  const syncGame = state.game?.needsSync ? state.game.gameId : null;
  useEffect(() => {
    if (!syncGame || !connected) return;
    send({ type: 'game_sync', game_id: syncGame }).catch((error: unknown) => {
      if (error instanceof LobbyError && error.code === 'game_not_found') dispatch({ type: 'game_gone' });
    });
  }, [syncGame, connected, send]);

  const leaveGame = useCallback(() => dispatch({ type: 'game_gone' }), []);

  return { state, connected, send, leaveGame };
}
