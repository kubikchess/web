// SPDX-License-Identifier: GPL-3.0-or-later
// Online game: board, dice, clocks, resignation and draw offers (docs/api.md, ADR 0010).
// The server sends the dice, allowed moves and clocks; the page only shows them (ADR 0006).

import type { Key } from 'chessground/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColorName } from '../api';
import { Board } from '../Board';
import { DicePanel } from '../DicePanel';
import { gameErrorText } from '../game/errors';
import { GameRecord } from '../game/GameRecord';
import { MoveHint } from '../game/MoveHint';
import {
  canAcceptDraw,
  canOfferDraw,
  clockRemaining,
  formatClock,
  isOwnRound,
  type OnlineGame,
} from '../game/protocol';
import { useBoardHints } from '../game/useMoveHints';
import type { Command } from '../lobby/protocol';
import { boardFen, lastMoveKeys, type Promotion, promotionChoices, toDests, toUci } from '../moves';
import { opponentName } from '../names';
import { PromotionDialog } from '../PromotionDialog';
import { RulesSummary } from '../rules/RulesSummary';

const TICK_MS = 200;
const LOW_TIME_MS = 20_000;

interface PendingPromotion {
  from: Key;
  to: Key;
  choices: Promotion[];
}

/** Local time, renewed every tick while a clock runs; stopped clocks do not read it. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(performance.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [running]);
  return now;
}

function Clock({ game, color, name, now }: { game: OnlineGame; color: ColorName; name: string; now: number }) {
  const { t } = useTranslation();
  const left = clockRemaining(game, color, now);
  const running = game.clocks.running === color;
  const classes = ['clock', running ? 'running' : '', left < LOW_TIME_MS ? 'low' : ''].join(' ').trim();
  return (
    <div className={classes} data-testid={`clock-${color}`} data-running={running}>
      <span className="clock-name">
        {name} <span className="muted">({t(`side.${color}`)})</span>
      </span>
      <span className="clock-time">{formatClock(left)}</span>
    </div>
  );
}

function statusText(game: OnlineGame, t: ReturnType<typeof useTranslation>['t']): string {
  if (game.result) {
    const reason = t(`reason.${game.result.reason}`, { defaultValue: game.result.reason });
    if (game.result.winner === null) return t('game.draw', { reason });
    return t(game.result.winner === game.color ? 'game.won' : 'game.lost', { reason });
  }
  if (game.version === 0) return t('game.waitingRoll');
  if (isOwnRound(game)) return t('game.yourMove', { count: game.movesLeft });
  return t('game.opponentMove');
}

interface GamePageProps {
  game: OnlineGame;
  connected: boolean;
  send: (command: Command) => Promise<void>;
  leaveGame: () => void;
}

export function GamePage({ game, connected, send, leaveGame }: GamePageProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<PendingPromotion | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [resync, setResync] = useState(0); // puts the server position back on the board
  const now = useNow(game.clocks.running !== null && game.result === null);
  const opponent: ColorName = game.color === 'white' ? 'black' : 'white';

  const run = useCallback(
    (command: Command) => {
      setBusy(true);
      setError(null);
      send(command)
        .catch((reason: unknown) => {
          setError(gameErrorText(reason, t));
          setResync((n) => n + 1); // a rejected move goes back
        })
        .finally(() => setBusy(false));
    },
    [send, t],
  );

  const own = isOwnRound(game);
  const dests = useMemo(() => toDests(own ? game.allowedMoves : []), [own, game.allowedMoves]);
  const lastMove = useMemo(() => lastMoveKeys(game.lastMove), [game.lastMove]);
  const hints = useBoardHints({
    roundKey: `${game.turn}-${game.record.length}`,
    ownRound: own,
    color: game.color,
    dice: game.dice,
    movesLeft: game.movesLeft,
    hasMoves: game.allowedMoves.length > 0,
    blocked: game.blockedMoves,
    kingAttackers: game.kingAttackers,
  });
  const { tryForbidden, clear: clearHint } = hints;

  const sendMove = useCallback(
    (from: Key, to: Key, piece?: Promotion) =>
      run({ type: 'move', game_id: game.gameId, version: game.version, move: toUci(from, to, piece) }),
    [game.gameId, game.version, run],
  );

  const onMove = useCallback(
    (from: Key, to: Key) => {
      if (tryForbidden(from, to)) {
        setResync((n) => n + 1); // a forbidden move goes back with a hint (GS-12)
        return;
      }
      clearHint();
      const choices = promotionChoices(game.allowedMoves, from, to);
      if (choices.length > 0) setPromotion({ from, to, choices });
      else sendMove(from, to);
    },
    [game.allowedMoves, sendMove, tryForbidden, clearHint],
  );

  const interactive = own && connected && !busy && !promotion;
  const finished = game.result !== null;

  return (
    <section className="page game" data-testid="game-started">
      <p>
        {t('lobby.gameColor', { color: t(`side.${game.color}Instr`) })}{' '}
        <strong data-testid="opponent-name">{opponentName(game.opponent, t)}</strong>
      </p>
      <div className="layout">
        <div className="board-area">
          <Board
            fen={boardFen(game.fen)}
            turn={game.turn}
            dests={dests}
            lastMove={lastMove}
            interactive={interactive}
            onMove={onMove}
            orientation={game.color}
            resync={resync}
            blocked={hints.blocked}
            onSelect={interactive ? hints.onSelect : undefined}
            arrows={hints.arrows}
          />
          <MoveHint hint={hints.hint} />
          {promotion && (
            <PromotionDialog
              color={game.color}
              choices={promotion.choices}
              onChoose={(piece) => {
                setPromotion(null);
                sendMove(promotion.from, promotion.to, piece);
              }}
              onCancel={() => {
                setPromotion(null);
                setResync((n) => n + 1); // put the pawn back
              }}
            />
          )}
        </div>
        <aside className="panel">
          <Clock game={game} color={opponent} name={opponentName(game.opponent, t)} now={now} />
          <section className="status" aria-live="polite">
            <p className="headline" data-testid="game-status">
              {statusText(game, t)}
            </p>
            {game.skipped && !finished && (
              <p data-testid="skipped">
                {t('game.skipped', {
                  side: t(`side.${game.skipped.color}`),
                  faces: game.skipped.faces.map((p) => t(`piece.${p}`).toLowerCase()).join(', '),
                })}
              </p>
            )}
            {!connected && <p className="muted">{t('lobby.connecting')}</p>}
          </section>
          <DicePanel dice={game.dice} />
          <Clock game={game} color={game.color} name={t('game.you')} now={now} />

          {finished ? (
            <div className="actions" data-testid="game-result">
              <button type="button" onClick={leaveGame} data-testid="leave-game">
                {t('game.toLobby')}
              </button>
            </div>
          ) : (
            <>
              {canAcceptDraw(game) && (
                <div className="draw-offer" data-testid="draw-offer">
                  <span>{t('game.drawOffered')}</span>
                  <button
                    type="button"
                    data-testid="accept-draw"
                    disabled={busy || !connected}
                    onClick={() => run({ type: 'draw_accept', game_id: game.gameId })}
                  >
                    {t('game.acceptDraw')}
                  </button>
                </div>
              )}
              {game.drawOffers.includes(game.color) && (
                <p className="muted" data-testid="own-draw-offer">
                  {t('game.ownDrawOffer')}
                </p>
              )}
              <div className="actions">
                {!canAcceptDraw(game) && (
                  <button
                    type="button"
                    className="secondary"
                    data-testid="offer-draw"
                    disabled={busy || !connected || !canOfferDraw(game)}
                    onClick={() => run({ type: 'draw_offer', game_id: game.gameId, version: game.version })}
                  >
                    {t('game.offerDraw')}
                  </button>
                )}
                {confirmResign ? (
                  <>
                    <button
                      type="button"
                      data-testid="resign-confirm"
                      disabled={busy || !connected}
                      onClick={() => {
                        setConfirmResign(false);
                        run({ type: 'resign', game_id: game.gameId });
                      }}
                    >
                      {t('game.resignConfirm')}
                    </button>
                    <button type="button" className="secondary" onClick={() => setConfirmResign(false)}>
                      {t('lobby.cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="secondary"
                    data-testid="resign"
                    disabled={busy || !connected}
                    onClick={() => setConfirmResign(true)}
                  >
                    {t('game.resign')}
                  </button>
                )}
              </div>
            </>
          )}
          {error && (
            <p className="error" role="alert" data-testid="game-error">
              {error}
            </p>
          )}
          <GameRecord record={game.record} />
        </aside>
        {/* Left of the board on wide screens, below the panel on narrow ones (styles.css). */}
        <RulesSummary highlight={hints.hint?.rule} />
      </div>
    </section>
  );
}
