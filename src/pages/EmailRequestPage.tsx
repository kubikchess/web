// SPDX-License-Identifier: GPL-3.0-or-later
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Field, Form } from '../auth/forms';
import { useAction } from '../auth/useAction';

interface Props {
  title: string;
  intro: string;
  submitLabel: string;
  doneText: string;
  send: (email: string) => Promise<void>;
}

/** Asks for an e-mail and sends a letter: resend confirmation, password reset. */
export function EmailRequestPage({ title, intro, submitLabel, doneText, send }: Props) {
  const { t } = useTranslation();
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    // The same text for any address (ACC-12).
    return (
      <section className="page narrow" data-testid="request-done">
        <h1>{t('auth.checkMailTitle')}</h1>
        <p>{doneText}</p>
        <p>
          <Link to="/login">{t('nav.login')}</Link>
        </p>
      </section>
    );
  }

  const submit = () =>
    void run(async () => {
      await send(email);
      setSent(true);
    });

  return (
    <section className="page narrow">
      <h1>{title}</h1>
      <p>{intro}</p>
      <Form onSubmit={submit} busy={busy} error={error} submitLabel={submitLabel}>
        <Field label={t('auth.email')} name="email" type="email" value={email} onChange={setEmail} autoComplete="email" />
      </Form>
    </section>
  );
}
