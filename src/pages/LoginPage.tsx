// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';

import { authApi } from '../authApi';
import { useAuth } from '../auth/context';
import { Field, Form } from '../auth/forms';
import { useAction } from '../auth/useAction';

export function LoginPage() {
  const { t } = useTranslation();
  const { participant, setParticipant } = useAuth();
  const navigate = useNavigate();
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (participant?.kind === 'user') return <Navigate to="/" replace />;

  const submit = () =>
    void run(async () => {
      setParticipant(await authApi.login(email, password));
      void navigate('/', { replace: true });
    });

  return (
    <section className="page narrow">
      <h1>{t('auth.loginTitle')}</h1>
      <Form onSubmit={submit} busy={busy} error={error} submitLabel={t('auth.loginSubmit')}>
        <Field label={t('auth.email')} name="email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label={t('auth.password')}
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
      </Form>
      <ul className="links">
        <li>
          <Link to="/forgot-password">{t('auth.forgotLink')}</Link>
        </li>
        <li>
          <Link to="/register">{t('auth.noAccountLink')}</Link>
        </li>
        <li>
          <Link to="/resend-verification">{t('auth.noLetterLink')}</Link>
        </li>
      </ul>
    </section>
  );
}
