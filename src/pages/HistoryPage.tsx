// SPDX-License-Identifier: GPL-3.0-or-later
// Finished games of a registered player, newest first (GS-04, ACC-02).

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../auth/context';
import { fetchHistory, type HistoryEntry } from '../gamesApi';
import { opponentName } from '../names';

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  const { t } = useTranslation();
  const date = new Date(entry.finished_at).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const kind = t(`lobby.mode.${entry.mode}`);
  const increment = entry.increment === null ? '' : ` + ${entry.increment} ${t('lobby.seconds')}`;
  const reason = t(`reason.${entry.reason}`, { defaultValue: entry.reason });
  return (
    <tr data-testid="history-row">
      <td>{date}</td>
      <td>{opponentName(entry.opponent, t, { markGuest: true })}</td>
      <td>{t(`side.${entry.color}`)}</td>
      <td>
        {kind}
        {increment}
      </td>
      <td data-testid="history-outcome">
        {t(`history.outcome.${entry.outcome}`)}, {reason}
      </td>
    </tr>
  );
}

export function HistoryPage() {
  const { t } = useTranslation();
  const { participant, loading } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const isUser = participant?.kind === 'user';

  useEffect(() => {
    if (!isUser) return;
    let current = true;
    fetchHistory()
      .then((page) => {
        if (!current) return;
        setEntries(page.games);
        setNext(page.next);
      })
      .catch(() => current && setError(true))
      .finally(() => current && setBusy(false));
    return () => {
      current = false;
    };
  }, [isUser]);

  const more = () => {
    if (next === null) return;
    setBusy(true);
    fetchHistory(next)
      .then((page) => {
        setEntries((known) => [...known, ...page.games]);
        setNext(page.next);
      })
      .catch(() => setError(true))
      .finally(() => setBusy(false));
  };

  if (loading) return null;
  if (!isUser) {
    return (
      <section className="page">
        <h1>{t('history.title')}</h1>
        <p className="muted">{t('history.loginNeeded')}</p>
      </section>
    );
  }

  return (
    <section className="page history">
      <h1>{t('history.title')}</h1>
      {error && (
        <p className="error" role="alert">
          {t('error.generic')}
        </p>
      )}
      {!busy && !error && entries.length === 0 && (
        <p className="muted" data-testid="history-empty">
          {t('history.empty')}
        </p>
      )}
      {entries.length > 0 && (
        <table className="offers">
          <thead>
            <tr>
              <th>{t('history.colDate')}</th>
              <th>{t('history.colOpponent')}</th>
              <th>{t('history.colColor')}</th>
              <th>{t('history.colKind')}</th>
              <th>{t('history.colResult')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <HistoryRow key={e.game_id} entry={e} />
            ))}
          </tbody>
        </table>
      )}
      {next !== null && (
        <div className="actions">
          <button type="button" className="secondary" onClick={more} disabled={busy}>
            {t('history.more')}
          </button>
        </div>
      )}
    </section>
  );
}
