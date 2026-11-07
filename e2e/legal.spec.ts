// SPDX-License-Identifier: GPL-3.0-or-later
// Legal documents and consent at registration (SEC-12, SEC-13).
import { expect, test } from '@playwright/test';

import { newAccount, PASSWORD } from './users';

test('L-058: documents open without a session; the footer links to them everywhere', async ({ page }) => {
  for (const [path, testId, title] of [
    ['/terms', 'legal-terms', 'Пользовательское соглашение'],
    ['/personal-data', 'legal-personal_data', 'Согласие на обработку персональных данных'],
    ['/privacy', 'legal-privacy_policy', 'Политика обработки персональных данных'],
  ]) {
    await page.goto(path);
    const text = page.getByTestId(testId);
    await expect(text.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(text.getByTestId('legal-version')).toContainText('Версия от');
  }

  // A guest in the lobby sees the links too.
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeEnabled();
  const footer = page.getByTestId('site-footer');
  await expect(footer.getByRole('link', { name: 'Пользовательское соглашение' })).toBeVisible();
  await footer.getByRole('link', { name: 'Политика обработки персональных данных' }).click();
  await expect(page.getByTestId('legal-privacy_policy')).toBeVisible();
});

test('L-059: registration does not go without both consents', async ({ page }) => {
  const { email, nickname } = newAccount();
  await page.goto('/register');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Ник').fill(nickname);
  await page.getByLabel('Пароль').fill(PASSWORD);
  const terms = page.getByTestId('consent-terms');
  const personalData = page.getByTestId('consent-personal_data');
  await expect(terms).not.toBeChecked(); // unticked by default
  await expect(personalData).not.toBeChecked();
  await terms.check();

  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

  await expect(page.getByTestId('register-done')).toBeHidden();
  expect(await personalData.evaluate((box) => (box as unknown as { validity: { valueMissing: boolean } }).validity.valueMissing)).toBe(true);

  // The links open the texts in a new tab, the form stays.
  const opened = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'согласие на обработку персональных данных' }).click();
  await expect((await opened).getByTestId('legal-personal_data')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue(email);
});

test('L-072: the guest button says that pressing it accepts the user agreement', async ({ page }) => {
  await page.goto('/');
  const notice = page.getByTestId('guest-terms-notice');
  await expect(notice).toContainText('Нажимая «Играть как гость», вы принимаете пользовательское соглашение');

  // The link opens the text; the guest button still lets the visitor in, without a tick.
  await notice.getByRole('link', { name: 'пользовательское соглашение' }).click();
  await expect(page.getByTestId('legal-terms')).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeEnabled();
  await expect(page.getByTestId('guest-terms-notice')).toBeHidden();
});

test('L-073: the registration form links to the privacy policy, without a third checkbox', async ({ page }) => {
  const { email, nickname } = newAccount();
  await page.goto('/register');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Ник').fill(nickname);
  await expect(page.getByRole('checkbox')).toHaveCount(2);

  const opened = page.waitForEvent('popup');
  await page.getByTestId('register-privacy-link').getByRole('link', { name: 'политике обработки персональных данных' }).click();
  await expect((await opened).getByTestId('legal-privacy_policy')).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue(email);
  await expect(page.getByLabel('Ник')).toHaveValue(nickname);
});

test('L-074: the footer links to the About page with the frontend license and its source', async ({ page }) => {
  const source = 'https://github.com/kubikchess/web';
  // Never load the external site in tests.
  await page.route(`${source}**`, (route) => route.abort());

  const checkAbout = async () => {
    await page.getByTestId('site-footer').getByTestId('footer-about').click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('О KubikChess');
    await expect(page.getByTestId('about-page')).toContainText('GNU GPL');
    const link = page.getByTestId('about-source');
    await expect(link).toHaveAttribute('href', source);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  };

  // A visitor without a session: from the home page and from a document page.
  await page.goto('/');
  await checkAbout();
  await page.goto('/terms');
  await checkAbout();

  // A guest in the lobby.
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeEnabled();
  await checkAbout();
});
