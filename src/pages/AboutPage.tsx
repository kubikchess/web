// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { RULES_PAGE, SOURCE_REPOSITORY_URL } from '../legalApi';

/** About the site: the rules link (NFR-18), the frontend license and its source (NFR-17, L-074). */
export function AboutPage() {
  const { t } = useTranslation();
  return (
    <article className="page legal" data-testid="about-page">
      <h1>{t('about.title')}</h1>
      <p>{t('about.description')}</p>
      <p>
        {t('about.rulesBefore')}
        <Link to={RULES_PAGE} data-testid="about-rules">
          {t('about.rulesLink')}
        </Link>
        {t('about.rulesAfter')}
      </p>
      <p>
        {t('about.licenseBefore')}
        <a href={SOURCE_REPOSITORY_URL} target="_blank" rel="noopener noreferrer" data-testid="about-source">
          {SOURCE_REPOSITORY_URL.replace('https://', '')}
        </a>
        {t('about.licenseAfter')}
      </p>
    </article>
  );
}
