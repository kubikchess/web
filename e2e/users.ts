// SPDX-License-Identifier: GPL-3.0-or-later
// Accounts for E2E tests through the pages (task 7).
import { expect, type Page } from '@playwright/test';

import { linkFromLetter } from './mail';

export const PASSWORD = 'correct horse';

/** Unique per test: the E2E API shares the development database. */
export function newAccount() {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { email: `e2e-${id}@example.com`, nickname: `e2e${id}`.slice(0, 20) };
}

/** Both consents of the registration form (SEC-13); a box is enabled once its version loads. */
export async function acceptDocuments(page: Page) {
  await page.getByTestId('consent-terms').check();
  await page.getByTestId('consent-personal_data').check();
}

export async function register(page: Page, email: string, nickname: string) {
  await page.goto('/register');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Ник').fill(nickname);
  await page.getByLabel('Пароль').fill(PASSWORD);
  await acceptDocuments(page);
  await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
  await expect(page.getByTestId('register-done')).toBeVisible();
}

export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

/** A player with a confirmed e-mail, logged in on `page` (ROLE-2). */
export async function verifiedPlayer(page: Page): Promise<string> {
  const { email, nickname } = newAccount();
  await register(page, email, nickname);
  await page.goto(await linkFromLetter(email, 'verify_email'));
  await expect(page.getByTestId('verify-done')).toBeVisible();
  await login(page, email, PASSWORD);
  await expect(page.getByTestId('participant-name')).toHaveText(nickname);
  return nickname;
}
