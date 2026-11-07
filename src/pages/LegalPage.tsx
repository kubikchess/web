// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '../errors';
import { fetchLegal, type LegalDocument, type LegalDocumentId } from '../legalApi';

/** A legal document for everyone, without a session (SEC-12, L-058). */
export function LegalPage({ document }: { document: LegalDocumentId }) {
  const { t } = useTranslation();
  // Keyed by document: a result for another page is ignored, no reset needed.
  const [loaded, setLoaded] = useState<{ document: LegalDocumentId; text?: LegalDocument; error?: string }>();

  useEffect(() => {
    let current = true;
    fetchLegal(document).then(
      (text) => current && setLoaded({ document, text }),
      (caught: unknown) => current && setLoaded({ document, error: errorMessage(caught, t) }),
    );
    return () => {
      current = false;
    };
  }, [document, t]);

  const text = loaded?.document === document ? loaded.text : undefined;
  const error = loaded?.document === document ? loaded.error : undefined;
  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!text) return <p>{t('legal.loading')}</p>;
  return (
    <article className="page legal" data-testid={`legal-${document}`}>
      <h1>{text.title}</h1>
      <p className="legal-version" data-testid="legal-version">
        {t('legal.version', { version: text.version })}
      </p>
      {text.blocks.map((block, index) =>
        block.kind === 'heading' ? <h2 key={index}>{block.text}</h2> : <p key={index}>{block.text}</p>,
      )}
    </article>
  );
}
