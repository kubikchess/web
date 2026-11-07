// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { authApi } from '../authApi';
import { useAuth } from '../auth/context';
import { Field, Form } from '../auth/forms';
import { useAction } from '../auth/useAction';
import { forgetHash, tokenFromHash } from '../token';

/** Opened from the reset letter: /reset-password#token=... (ADR 0008). */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { refresh } = useAuth();
  const { busy, error, run } = useAction();
  const [token] = useState(() => tokenFromHash(window.location.hash));
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <section className="page narrow">
        <h1>{t('auth.resetTitle')}</h1>
        <p className="error" role="alert">
          {t('auth.linkIncomplete')}
        </p>
        <p>
          <Link to="/forgot-password">{t('auth.forgotLink')}</Link>
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="page narrow" data-testid="reset-done">
        <h1>{t('auth.resetTitle')}</h1>
        <p>
          {t('auth.resetDone')} <Link to="/login">{t('nav.login')}</Link>
        </p>
      </section>
    );
  }

  const submit = () =>
    void run(async () => {
      await authApi.resetPassword(token, password);
      forgetHash();
      setDone(true);
      await refresh(); // the reset ended every session of the account (ACC-13)
    });

  return (
    <section className="page narrow">
      <h1>{t('auth.resetTitle')}</h1>
      <Form onSubmit={submit} busy={busy} error={error} submitLabel={t('auth.resetSubmit')}>
        <Field
          label={t('auth.newPassword')}
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
      </Form>
    </section>
  );
}
