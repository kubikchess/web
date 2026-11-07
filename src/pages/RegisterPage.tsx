// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';

import { authApi } from '../authApi';
import { useAuth } from '../auth/context';
import { Field, Form } from '../auth/forms';
import { useAction } from '../auth/useAction';
import { errorMessage } from '../errors';
import { ApiError } from '../http';
import { CONSENT_IDS, type ConsentId, consentsBody, fetchLegal, LEGAL_PAGES } from '../legalApi';

const UNTICKED: Record<ConsentId, boolean> = { terms: false, personal_data: false };

/** Current versions of the documents the form asks to accept (SEC-13). */
async function consentVersions(): Promise<Partial<Record<ConsentId, string>>> {
  const texts = await Promise.all(CONSENT_IDS.map((id) => fetchLegal(id)));
  return Object.fromEntries(texts.map((text) => [text.document, text.version]));
}

function ConsentBox({
  id,
  checked,
  disabled,
  onChange,
}: {
  id: ConsentId;
  checked: boolean;
  disabled: boolean; // until the version is loaded: a tick must name a version
  onChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  const [prefix, link] =
    id === 'terms'
      ? [t('auth.consentTerms'), t('auth.consentTermsLink')]
      : [t('auth.consentPersonalData'), t('auth.consentPersonalDataLink')];
  return (
    <label className="consent">
      <input
        type="checkbox"
        name={`consent-${id}`}
        data-testid={`consent-${id}`}
        checked={checked}
        disabled={disabled}
        required
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {prefix}{' '}
        {/* A new tab keeps the filled form. */}
        <a href={LEGAL_PAGES[id]} target="_blank" rel="noopener noreferrer">
          {link}
        </a>
      </span>
    </label>
  );
}

export function RegisterPage() {
  const { t } = useTranslation();
  const { participant } = useAuth();
  const { busy, error, run } = useAction();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [sent, setSent] = useState(false);
  // Boxes start unticked (SEC-13); versions are the ones shown, sent back with the form.
  const [ticked, setTicked] = useState(UNTICKED);
  const [versions, setVersions] = useState<Partial<Record<ConsentId, string>>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadVersions = useCallback(
    () =>
      consentVersions().then(
        (loaded) => {
          setVersions(loaded);
          setLoadError(null);
        },
        (caught: unknown) => setLoadError(errorMessage(caught, t)),
      ),
    [t],
  );
  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  if (participant?.kind === 'user') return <Navigate to="/" replace />;

  if (sent) {
    // The same text for a new and for a taken e-mail (ACC-12).
    return (
      <section className="page narrow" data-testid="register-done">
        <h1>{t('auth.checkMailTitle')}</h1>
        <p>{t('auth.checkMailVerify')}</p>
        <p>
          <Link to="/resend-verification">{t('auth.noLetterLink')}</Link>
        </p>
        <p>
          <Link to="/login">{t('nav.login')}</Link>
        </p>
      </section>
    );
  }

  const submit = () =>
    void run(async () => {
      try {
        await authApi.register(email, nickname, password, consentsBody(versions, ticked));
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'document_outdated') {
          // A new text was published while the form was open (L-060): show it, ask again.
          const document = caught.problem as ConsentId;
          setTicked((current) => ({ ...current, [document]: false }));
          await loadVersions();
        }
        throw caught;
      }
      setSent(true);
    });

  return (
    <section className="page narrow">
      <h1>{t('auth.registerTitle')}</h1>
      <Form onSubmit={submit} busy={busy} error={error} submitLabel={t('auth.registerSubmit')}>
        <Field label={t('auth.email')} name="email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label={t('auth.nickname')}
          name="nickname"
          type="text"
          value={nickname}
          onChange={setNickname}
          autoComplete="username"
        />
        <Field
          label={t('auth.password')}
          name="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        {CONSENT_IDS.map((id) => (
          <ConsentBox
            key={id}
            id={id}
            checked={ticked[id]}
            disabled={versions[id] === undefined}
            onChange={(checked) => setTicked((current) => ({ ...current, [id]: checked }))}
          />
        ))}
        {/* The policy has no checkbox, only a link next to the two (SEC-13). */}
        <p className="legal-notice" data-testid="register-privacy-link">
          {t('auth.privacyNotice')}{' '}
          <a href={LEGAL_PAGES.privacy_policy} target="_blank" rel="noopener noreferrer">
            {t('auth.privacyLink')}
          </a>
        </p>
        {loadError && (
          <p className="error" role="alert">
            {loadError}
          </p>
        )}
      </Form>
      <p>
        <Link to="/login">{t('auth.haveAccountLink')}</Link>
      </p>
    </section>
  );
}
