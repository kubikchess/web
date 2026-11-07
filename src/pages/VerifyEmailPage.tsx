// SPDX-License-Identifier: GPL-3.0-or-later
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { authApi } from '../authApi';
import { useAuth } from '../auth/context';
import { errorMessage } from '../errors';
import { forgetHash, tokenFromHash } from '../token';

type Outcome = { state: 'pending' } | { state: 'done' } | { state: 'failed'; message: string };

/** Opened from the confirmation letter: /verify-email#token=... (ADR 0008). */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const [outcome, setOutcome] = useState<Outcome>(() =>
    token ? { state: 'pending' } : { state: 'failed', message: t('auth.linkIncomplete') },
  );
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return; // the token is single use; StrictMode runs effects twice
    sent.current = true;
    authApi
      .verifyEmail(token)
      .then(async () => {
        forgetHash();
        setOutcome({ state: 'done' });
        await refresh();
      })
      .catch((error: unknown) => setOutcome({ state: 'failed', message: errorMessage(error, t) }));
  }, [refresh, t, token]);

  return (
    <section className="page narrow">
      <h1>{t('auth.verifyTitle')}</h1>
      {outcome.state === 'pending' && <p>{t('auth.verifyPending')}</p>}
      {outcome.state === 'done' && (
        <p data-testid="verify-done">
          {t('auth.verifyDone')} <Link to="/">{t('auth.toHome')}</Link>
        </p>
      )}
      {outcome.state === 'failed' && (
        <>
          <p className="error" role="alert">
            {outcome.message}
          </p>
          <p>
            <Link to="/resend-verification">{t('auth.resendLink')}</Link>
          </p>
        </>
      )}
    </section>
  );
}
