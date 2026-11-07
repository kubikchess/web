// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useNavigate } from 'react-router';

import { authApi } from './authApi';
import { useAuth } from './auth/context';
import { ABOUT_PAGE, LEGAL_PAGES } from './legalApi';

export function Layout() {
  const { t } = useTranslation();
  const { participant, loading, refresh } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await authApi.logout().catch(() => undefined);
    await refresh();
    void navigate('/');
  };

  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand" data-testid="brand">
          {t('brand')}
        </Link>
        <nav className="account">
          {import.meta.env.DEV && <Link to="/hot-seat">{t('nav.hotSeat')}</Link>}
          {!loading && participant?.kind === 'user' && <Link to="/history">{t('nav.history')}</Link>}
          {!loading && participant && (
            <>
              <span className="participant" data-testid="participant-name">
                {participant.display_name}
              </span>
              <button type="button" className="secondary" onClick={() => void logout()}>
                {t('nav.logout')}
              </button>
            </>
          )}
          {!loading && participant?.kind !== 'user' && (
            <>
              <Link to="/login">{t('nav.login')}</Link>
              <Link to="/register">{t('nav.register')}</Link>
            </>
          )}
        </nav>
      </header>
      {participant?.kind === 'user' && !participant.email_verified && (
        <p className="banner" role="status" data-testid="verify-banner">
          {t('auth.verifyBanner')} <Link to="/resend-verification">{t('auth.resendLink')}</Link>
        </p>
      )}
      <main>
        <Outlet />
      </main>
      <footer className="site-footer" data-testid="site-footer">
        <Link to={LEGAL_PAGES.terms}>{t('legal.footerTerms')}</Link>
        <Link to={LEGAL_PAGES.privacy_policy}>{t('legal.footerPrivacy')}</Link>
        <Link to={ABOUT_PAGE} data-testid="footer-about">
          {t('legal.footerAbout')}
        </Link>
      </footer>
    </>
  );
}
