// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RULES_PAGE } from '../legalApi';
import { rulesTextValues } from './profile';
import { RULE_SUMMARY_IDS, type RuleSummaryId, summaryOpenAtStart } from './summary';

/**
 * Short rules on the game screen (GS-08): open on a wide screen, collapsed on a phone.
 * `highlight` marks the item that forbids the last attempted move (GS-12, GS-13); the block
 * does not open by itself, so the board never moves in the middle of a move.
 */
export function RulesSummary({ highlight }: { highlight?: RuleSummaryId | null }) {
  const { t } = useTranslation();
  // Decided once when shown; afterwards the player opens and closes it.
  const [open, setOpen] = useState(() =>
    summaryOpenAtStart(typeof window.matchMedia === 'function' ? (query) => window.matchMedia(query) : undefined),
  );
  const values = rulesTextValues();
  return (
    <details
      className="rules-summary"
      data-testid="rules-summary"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t('rules.summary.title')}</summary>
      <ol>
        {RULE_SUMMARY_IDS.map((id) => (
          <li
            key={id}
            data-rule={id}
            className={id === highlight ? 'highlighted' : undefined}
            aria-current={id === highlight ? 'true' : undefined}
          >
            {t(`rules.summary.${id}`, values)}
          </li>
        ))}
      </ol>
      {/* A new tab: leaving the page would interrupt the game view. */}
      <a href={RULES_PAGE} target="_blank" rel="noopener noreferrer">
        {t('rules.summary.full')}
      </a>
    </details>
  );
}
