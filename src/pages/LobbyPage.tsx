// SPDX-License-Identifier: GPL-3.0-or-later
// Lobby: quick play and the computer for everyone, own games and the list for verified
// players (roles.md, BOT-01).

import type { TFunction } from 'i18next';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authApi, type Participant } from '../authApi';
import { useAuth } from '../auth/context';
import {
  type Command,
  CREATOR_COLORS,
  type CreatorColor,
  INCREMENT_CHOICES,
  type Mode,
  MODES,
  type Offer,
  visibleOffers,
} from '../lobby/protocol';
import { lobbyErrorText } from '../lobby/errors';
import { sessionStillValid } from '../lobby/session';
import { useLobby } from '../lobby/useLobby';
import { GamePage } from './GamePage';

function timeControlText(t: TFunction, mode: Mode, increment: number | null): string {
  const base = t(`lobby.mode.${mode}`);
  return increment === null ? `${base}, ${t('lobby.noIncrement')}` : `${base} + ${increment} ${t('lobby.seconds')}`;
}

function incrementValue(raw: string): number | null {
  return raw === '' ? null : Number(raw);
}

interface TimeControlFieldsProps {
  mode: Mode;
  increment: number | null;
  onMode: (mode: Mode) => void;
  onIncrement: (increment: number | null) => void;
  idPrefix: string;
}

function TimeControlFields({ mode, increment, onMode, onIncrement, idPrefix }: TimeControlFieldsProps) {
  const { t } = useTranslation();
  return (
    <>
      <label htmlFor={`${idPrefix}-mode`}>{t('lobby.modeLabel')}</label>
      <select id={`${idPrefix}-mode`} value={mode} onChange={(e) => onMode(e.target.value as Mode)}>
        {MODES.map((m) => (
          <option key={m} value={m}>
            {t(`lobby.mode.${m}`)}
          </option>
        ))}
      </select>
      <label htmlFor={`${idPrefix}-increment`}>{t('lobby.incrementLabel')}</label>
      <select
        id={`${idPrefix}-increment`}
        value={increment ?? ''}
        onChange={(e) => onIncrement(incrementValue(e.target.value))}
      >
        {INCREMENT_CHOICES.map((value) => (
          <option key={value ?? 'none'} value={value ?? ''}>
            {value === null ? t('lobby.noIncrement') : `${value} ${t('lobby.seconds')}`}
          </option>
        ))}
      </select>
    </>
  );
}

interface ColorFieldProps {
  color: CreatorColor;
  onColor: (color: CreatorColor) => void;
  id: string;
}

function ColorField({ color, onColor, id }: ColorFieldProps) {
  const { t } = useTranslation();
  return (
    <>
      <label htmlFor={id}>{t('lobby.colorLabel')}</label>
      <select id={id} value={color} onChange={(e) => onColor(e.target.value as CreatorColor)}>
        {CREATOR_COLORS.map((c) => (
          <option key={c} value={c}>
            {t(`lobby.creatorColor.${c}`)}
          </option>
        ))}
      </select>
    </>
  );
}

function OfferRow({ offer, onAccept, disabled }: { offer: Offer; onAccept: () => void; disabled: boolean }) {
  const { t } = useTranslation();
  const created = new Date(offer.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return (
    <tr data-testid="offer-row">
      <td>{offer.creator.display_name}</td>
      <td>{timeControlText(t, offer.mode, offer.increment)}</td>
      <td>{t(`lobby.creatorColor.${offer.color}`)}</td>
      <td>{created}</td>
      <td>
        <button type="button" onClick={onAccept} disabled={disabled}>
          {t('lobby.accept')}
        </button>
      </td>
    </tr>
  );
}

export function LobbyPage({ participant }: { participant: Participant }) {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const onSessionEnded = useCallback(() => void refresh(), [refresh]);
  const sessionAlive = useCallback(() => sessionStillValid(authApi.me, participant.id), [participant.id]);
  const { state, connected, send, leaveGame } = useLobby(participant.id, onSessionEnded, sessionAlive);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('blitz');
  const [increment, setIncrement] = useState<number | null>(null);
  const [offerMode, setOfferMode] = useState<Mode>('blitz');
  const [offerIncrement, setOfferIncrement] = useState<number | null>(null);
  const [offerColor, setOfferColor] = useState<CreatorColor>('random');
  const [filter, setFilter] = useState<Mode | 'all'>('all');
  const [botMode, setBotMode] = useState<Mode>('blitz');
  const [botIncrement, setBotIncrement] = useState<number | null>(null);
  const [botColor, setBotColor] = useState<CreatorColor>('random');

  const canCreate = participant.kind === 'user' && participant.email_verified;
  const me = state.me;
  const status = me?.status ?? 'idle';

  const run = (command: Command) => {
    setBusy(true);
    setError(null);
    send(command)
      .catch((reason: unknown) => setError(lobbyErrorText(reason, t)))
      .finally(() => setBusy(false));
  };

  if (state.game) return <GamePage game={state.game} connected={connected} send={send} leaveGame={leaveGame} />;
  if (status === 'in_game') return <p className="muted">{t('lobby.gameInProgress')}</p>;

  const offers = visibleOffers(state.offers, filter);
  const idle = connected && status === 'idle' && !busy;

  return (
    <section className="page lobby">
      <h1>{t('home.greeting', { name: participant.display_name })}</h1>
      {!connected && <p className="muted">{t('lobby.connecting')}</p>}
      {error && (
        <p className="error" role="alert" data-testid="lobby-error">
          {error}
        </p>
      )}

      <div className="lobby-block">
        <h2>{t('lobby.quickTitle')}</h2>
        {status === 'queued' && me?.queue ? (
          <div className="actions" data-testid="waiting">
            <span>{t('lobby.waiting', { kind: timeControlText(t, me.queue.mode, me.queue.increment) })}</span>
            <button type="button" className="secondary" onClick={() => run({ type: 'queue_leave' })}>
              {t('lobby.cancel')}
            </button>
          </div>
        ) : (
          <div className="form-row">
            <TimeControlFields
              mode={mode}
              increment={increment}
              onMode={setMode}
              onIncrement={setIncrement}
              idPrefix="quick"
            />
            <button
              type="button"
              data-testid="quick-play"
              disabled={!idle}
              onClick={() => run({ type: 'queue_join', mode, increment })}
            >
              {t('lobby.play')}
            </button>
          </div>
        )}
      </div>

      <div className="lobby-block">
        <h2>{t('lobby.botTitle')}</h2>
        <div className="form-row">
          <TimeControlFields
            mode={botMode}
            increment={botIncrement}
            onMode={setBotMode}
            onIncrement={setBotIncrement}
            idPrefix="bot"
          />
          <ColorField color={botColor} onColor={setBotColor} id="bot-color" />
          <button
            type="button"
            data-testid="bot-game"
            disabled={!idle}
            onClick={() =>
              run({ type: 'bot_game_create', mode: botMode, increment: botIncrement, color: botColor })
            }
          >
            {t('lobby.botPlay')}
          </button>
        </div>
      </div>

      {canCreate && (
        <div className="lobby-block">
          <h2>{t('lobby.createTitle')}</h2>
          {status === 'offer' && me?.offer ? (
            <div className="actions" data-testid="own-offer">
              <span>
                {t('lobby.ownOffer', { kind: timeControlText(t, me.offer.mode, me.offer.increment) })}
              </span>
              <button type="button" className="secondary" onClick={() => run({ type: 'game_cancel' })}>
                {t('lobby.cancel')}
              </button>
            </div>
          ) : (
            <div className="form-row">
              <TimeControlFields
                mode={offerMode}
                increment={offerIncrement}
                onMode={setOfferMode}
                onIncrement={setOfferIncrement}
                idPrefix="offer"
              />
              <ColorField color={offerColor} onColor={setOfferColor} id="offer-color" />
              <button
                type="button"
                data-testid="create-game"
                disabled={!idle}
                onClick={() =>
                  run({ type: 'game_create', mode: offerMode, increment: offerIncrement, color: offerColor })
                }
              >
                {t('lobby.create')}
              </button>
            </div>
          )}
        </div>
      )}

      {canCreate && (
        <div className="lobby-block">
          <h2>{t('lobby.listTitle')}</h2>
          <div className="form-row">
            <label htmlFor="list-filter">{t('lobby.filterLabel')}</label>
            <select id="list-filter" value={filter} onChange={(e) => setFilter(e.target.value as Mode | 'all')}>
              <option value="all">{t('lobby.filterAll')}</option>
              {MODES.map((m) => (
                <option key={m} value={m}>
                  {t(`lobby.mode.${m}`)}
                </option>
              ))}
            </select>
          </div>
          {offers.length === 0 ? (
            <p className="muted" data-testid="no-offers">
              {t('lobby.noOffers')}
            </p>
          ) : (
            <table className="offers">
              <thead>
                <tr>
                  <th>{t('lobby.colCreator')}</th>
                  <th>{t('lobby.colKind')}</th>
                  <th>{t('lobby.colColor')}</th>
                  <th>{t('lobby.colCreated')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <OfferRow
                    key={o.offer_id}
                    offer={o}
                    disabled={!idle}
                    onAccept={() => run({ type: 'game_accept', offer_id: o.offer_id })}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
