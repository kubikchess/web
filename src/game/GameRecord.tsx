// SPDX-License-Identifier: GPL-3.0-or-later
import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { summaryOpenAtStart } from '../rules/summary';
import { formatFaces, formatMove, type RecordRow, recordRows, type RoundRecord } from './record';

/** The game record (GS-09): open on a wide screen, collapsed on a phone, like the short rules. */
export function GameRecord({ record }: { record: RoundRecord[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() =>
    summaryOpenAtStart(typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined),
  );
  const scroller = useRef<HTMLDivElement>(null);
  const entries = record.reduce((count, round) => count + round.moves.length + 1, 0);

  // Keep the latest row in sight as the game goes on.
  useEffect(() => {
    const box = scroller.current;
    if (open && box) box.scrollTop = box.scrollHeight;
  }, [open, entries]);

  const rows = recordRows(record);
  return (
    <details
      className="game-record"
      data-testid="game-record"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t('record.title')}</summary>
      {rows.length === 0 ? (
        <p className="muted">{t('record.empty')}</p>
      ) : (
        <div className="game-record-scroll" ref={scroller}>
          <table>
            <thead>
              <tr>
                <th scope="col">{t('record.number')}</th>
                <th scope="col" colSpan={2}>
                  {t('record.white')}
                </th>
                <th scope="col" colSpan={2}>
                  {t('record.black')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row key={row.number} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function Row({ row }: { row: RecordRow }) {
  return (
    <tr data-testid="record-row">
      <td className="number">{row.number}.</td>
      <Half round={row.white} />
      <Half round={row.black} />
    </tr>
  );
}

function Half({ round }: { round: RoundRecord | null }) {
  const { t } = useTranslation();
  if (!round) {
    return (
      <>
        <td className="faces" />
        <td className="moves" />
      </>
    );
  }
  return (
    <>
      <td className="faces" data-testid={`record-faces-${round.color}`}>
        {formatFaces(round.faces, t)}
      </td>
      <td className="moves" data-testid={`record-moves-${round.color}`}>
        {round.skipped
          ? t('record.skipped')
          : round.moves.map((move, index) => (
              // A move never breaks inside; the cell wraps at the spaces between moves.
              <Fragment key={index}>
                {index > 0 && ' '}
                <span className="move">{formatMove(move, t)}</span>
              </Fragment>
            ))}
      </td>
    </>
  );
}
