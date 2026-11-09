// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';
import { createBrowserRouter, RouterProvider } from 'react-router';

import { authApi } from './authApi';
import { AuthProvider } from './auth/AuthProvider';
import { Layout } from './Layout';
import { ABOUT_PAGE, LEGAL_PAGES, RULES_PAGE } from './legalApi';
import { AboutPage } from './pages/AboutPage';
import { EmailRequestPage } from './pages/EmailRequestPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { HotSeatPage } from './pages/HotSeatPage';
import { LegalPage } from './pages/LegalPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { RulesPage } from './pages/RulesPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';

function ResendVerificationPage() {
  const { t } = useTranslation();
  return (
    <EmailRequestPage
      title={t('auth.resendTitle')}
      intro={t('auth.resendIntro')}
      submitLabel={t('auth.resendSubmit')}
      doneText={t('auth.checkMailVerify')}
      send={authApi.resendVerification}
    />
  );
}

function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <EmailRequestPage
      title={t('auth.forgotTitle')}
      intro={t('auth.forgotIntro')}
      submitLabel={t('auth.forgotSubmit')}
      doneText={t('auth.checkMailReset')}
      send={authApi.requestPasswordReset}
    />
  );
}

// Paths of the e-mail links are fixed by the server (ADR 0008): /verify-email, /reset-password.
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/verify-email', element: <VerifyEmailPage /> },
      { path: '/resend-verification', element: <ResendVerificationPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      { path: '/history', element: <HistoryPage /> },
      { path: LEGAL_PAGES.terms, element: <LegalPage document="terms" /> },
      { path: LEGAL_PAGES.personal_data, element: <LegalPage document="personal_data" /> },
      { path: LEGAL_PAGES.privacy_policy, element: <LegalPage document="privacy_policy" /> },
      { path: ABOUT_PAGE, element: <AboutPage /> },
      { path: RULES_PAGE, element: <RulesPage /> },
      { path: '/hot-seat', element: <HotSeatPage /> }, // development tool (OQ-041)
      { path: '*', element: <HomePage /> },
    ],
  },
]);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
