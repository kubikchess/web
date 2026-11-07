// SPDX-License-Identifier: GPL-3.0-or-later
import type { Key } from 'chessground/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, type GameState } from '../api';
import { ApiError } from '../http';
import { Board } from '../Board';
import { DicePanel } from '../DicePanel';
import { boardFen, lastMoveKeys, type Promotion, promotionChoices, toDests, toUci } from '../moves';
import { PromotionDialog } from '../PromotionDialog';

// The game id lives in the URL: a reload keeps the game, and a game created through
// the API (for example from a FEN) can be opened at /?game=<id>.
const GAME_PARAM = 'game';

function rememberGame(gameId: string) {
  const url = new URL(window.location.href);
  if (url.searchParams.get(GAME_PARAM) === gameId) return;
  url.searchParams.set(GAME_PARAM, gameId);
  window.history.replaceState(null, '', url);
}

interface PendingPromotion {
  from: Key;
  to: Key;
  choices: Promotion[];
}

export function HotSeatPage() {
  const { t } = useTranslation();
  const [game, setGame] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true); // until the first state arrives
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);
  const [resync, setResync] = useState(0); // puts the server position back on the board
  const started = useRef(false);

  const run = useCallback(
    async (command: () => Promise<GameState>, gameId?: string) => {
      setBusy(true);
      setError(null);
      try {
        const state = await command();
        setGame(state);
        rememberGame(state.game_id);
      } catch (caught) {
        setResync((n) => n + 1); // a rejected move goes back
        if (caught instanceof ApiError && caught.code === 'version_conflict' && gameId) {
          setError(t('error.stale'));
          setGame(await api.get(gameId).catch(() => null));
        } else if (caught instanceof ApiError && caught.code === 'illegal_move') {
          setError(t('error.illegal'));
        } else {
          setError(t('error.generic'));
        }
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const newGame = useCallback(() => {
    setPromotion(null);
    void run(api.create);
  }, [run]);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice in development
    started.current = true;
    const saved = new URLSearchParams(window.location.search).get(GAME_PARAM);
    // A saved game is gone after a server restart: start a new one then.
    const first = saved ? api.get(saved).catch(() => api.create()) : api.create();
    first
      .then((state) => {
        setGame(state);
        rememberGame(state.game_id);
      })
      .catch(() => setError(t('error.generic')))
      .finally(() => setBusy(false));
  }, [t]);

  const dests = useMemo(() => toDests(game?.allowed_moves ?? []), [game?.allowed_moves]);
  const lastMove = useMemo(() => lastMoveKeys(game?.last_move ?? null), [game?.last_move]);

  const sendMove = useCallback(
    (from: Key, to: Key, piece?: Promotion) => {
      if (!game) return;
      void run(() => api.move(game.game_id, game.version, toUci(from, to, piece)), game.game_id);
    },
    [game, run],
  );

  const onMove = useCallback(
    (from: Key, to: Key) => {
      if (!game) return;
      const choices = promotionChoices(game.allowed_moves, from, to);
      if (choices.length > 0) setPromotion({ from, to, choices });
      else sendMove(from, to);
    },
    [game, sendMove],
  );

  const roll = () => {
    if (game) void run(() => api.roll(game.game_id, game.version), game.game_id);
  };

  return (
    <>
      <h1>{t('title')}</h1>
      <div className="layout">
        <div className="board-area">
          {game && (
            <Board
              fen={boardFen(game.fen)}
              turn={game.turn}
              dests={dests}
              lastMove={lastMove}
              interactive={game.phase === 'move' && !busy && !promotion}
              onMove={onMove}
              resync={resync}
            />
          )}
          {game && promotion && (
            <PromotionDialog
              color={game.turn}
              choices={promotion.choices}
              onChoose={(piece) => {
                setPromotion(null);
                sendMove(promotion.from, promotion.to, piece);
              }}
              onCancel={() => {
                setPromotion(null);
                setResync((n) => n + 1); // put the pawn back from the server position
              }}
            />
          )}
        </div>
        <aside className="panel">
          {game && <Status game={game} />}
          <DicePanel dice={game?.dice ?? null} />
          <div className="actions">
            <button
              type="button"
              onClick={roll}
              disabled={busy || game?.phase !== 'roll'}
              data-testid="roll"
            >
              {t('action.roll')}
            </button>
            <button type="button" className="secondary" onClick={newGame} disabled={busy}>
              {t('action.newGame')}
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}

function Status({ game }: { game: GameState }) {
  const { t } = useTranslation();
  const side = t(`side.${game.turn}`);
  let headline: string;
  if (game.result) {
    const reason = t(`reason.${game.result.reason}`, { defaultValue: game.result.reason });
    headline = game.result.winner
      ? t('status.won', { side: t(`side.${game.result.winner}`), reason })
      : t('status.draw', { reason });
  } else if (game.phase === 'move') {
    headline = t('status.move', { side, count: game.moves_left });
  } else {
    headline = t('status.roll', { side });
  }
  return (
    <section className="status" aria-live="polite">
      <p className="headline" data-testid="status">
        {headline}
      </p>
      {game.dice?.skipped && (
        <p data-testid="skipped">{t('status.skipped', { side: t(`side.${game.dice.color}`) })}</p>
      )}
      <p className="counters">
        {t('status.noCapture', { count: game.no_capture_moves })}
        {game.skipped_rounds > 0 && ` · ${t('status.skippedRounds', { count: game.skipped_rounds })}`}
      </p>
    </section>
  );
}
