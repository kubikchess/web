// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { authApi } from '../authApi';
import { useAuth } from '../auth/context';
import { useAction } from '../auth/useAction';
import { LEGAL_PAGES } from '../legalApi';
import { LobbyPage } from './LobbyPage';

export function HomePage() {
  const { t } = useTranslation();
  const { participant, loading, setParticipant } = useAuth();
  const { busy, error, run } = useAction();

  if (loading) return null;

  if (participant) {
    return <LobbyPage participant={participant} />;
  }

  const playAsGuest = () => void run(async () => setParticipant(await authApi.guest()));

  return (
    <section className="page">
      <h1>{t('home.title')}</h1>
      <p>{t('home.intro')}</p>
      <div className="actions">
        <Link className="button" to="/login">
          {t('nav.login')}
        </Link>
        <Link className="button secondary" to="/register">
          {t('nav.register')}
        </Link>
        <button type="button" className="secondary" onClick={playAsGuest} disabled={busy}>
          {t('auth.playAsGuest')}
        </button>
      </div>
      {/* Pressing the guest button accepts the user agreement (GST-09); nothing is recorded. */}
      <p className="legal-notice" data-testid="guest-terms-notice">
        {t('auth.guestTermsNotice')} <Link to={LEGAL_PAGES.terms}>{t('auth.guestTermsLink')}</Link>
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
