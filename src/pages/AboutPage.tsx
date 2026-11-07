// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';

import { SOURCE_REPOSITORY_URL } from '../legalApi';

/** About the site: the frontend license and the link to its source (NFR-17, L-074). */
export function AboutPage() {
  const { t } = useTranslation();
  return (
    <article className="page legal" data-testid="about-page">
      <h1>{t('about.title')}</h1>
      <p>{t('about.description')}</p>
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
