// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';

import { rulesTextValues } from '../rules/profile';

/** Sections of the rules page in reading order; texts are rules.page.<section> in ru.json. */
const SECTIONS = ['goal', 'round', 'moves', 'kingCapture', 'special', 'end', 'time', 'differences'] as const;

/** The full rules of KubikChess (rules-help, NFR-18); retells the game rule specs. */
export function RulesPage() {
  const { t } = useTranslation();
  const values = rulesTextValues();
  return (
    <article className="page legal rules" data-testid="rules-page">
      <h1>{t('rules.page.title')}</h1>
      <p>{t('rules.page.intro', values)}</p>
      {SECTIONS.map((section) => {
        const items = t(`rules.page.${section}.items`, { ...values, returnObjects: true }) as string[];
        return (
          <section key={section} data-section={section}>
            <h2>{t(`rules.page.${section}.title`)}</h2>
            {items.length === 1 ? (
              <p>{items[0]}</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </article>
  );
}
