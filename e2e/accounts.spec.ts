// SPDX-License-Identifier: GPL-3.0-or-later
// Accounts end to end: pages, /auth API, Postgres, Valkey and the file mailer (task 7).
import { expect, test } from '@playwright/test';

import { linkFromLetter } from './mail';
import { login, newAccount, PASSWORD, register } from './users';

test('L-001, L-050: register, confirm the e-mail from the letter, log in and out', { tag: '@smoke' }, async ({ page }) => {
  const { email, nickname } = newAccount();

  await register(page, email, nickname);
  const link = await linkFromLetter(email, 'verify_email');
  expect(new URL(link).pathname).toBe('/verify-email');

  await login(page, email, PASSWORD);
  await expect(page.getByTestId('participant-name')).toHaveText(nickname);
  await expect(page.getByTestId('verify-banner')).toBeVisible(); // ACC-02: not confirmed yet

  await page.goto(link);
  await expect(page.getByTestId('verify-done')).toBeVisible();
  expect(new URL(page.url()).hash).toBe(''); // the token leaves the address bar
  await page.goto('/');
  await expect(page.getByTestId('participant-name')).toHaveText(nickname);
  await expect(page.getByTestId('verify-banner')).toHaveCount(0);

  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page.getByRole('button', { name: 'Играть как гость' })).toBeVisible();
  await expect(page.getByTestId('participant-name')).toHaveCount(0);
});

test('ACC-02: the confirmation link works in a fresh browser without the CSRF cookie', async ({ page, browser }) => {
  const { email, nickname } = newAccount();
  await register(page, email, nickname);
  const link = await linkFromLetter(email, 'verify_email');

  // Another browser, as when the letter is opened elsewhere: no cookies at all.
  const fresh = await (await browser.newContext()).newPage();
  await fresh.goto(link);

  await expect(fresh.getByTestId('verify-done')).toBeVisible();
});

test('ACC-01: registration waits for the CSRF token when /auth/me is slow', async ({ page }) => {
  await page.route('**/auth/me', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  const { email, nickname } = newAccount();

  await register(page, email, nickname); // submits before the first /auth/me answers
});

test('L-004: a used confirmation link is rejected', async ({ page }) => {
  const { email, nickname } = newAccount();
  await register(page, email, nickname);
  const link = await linkFromLetter(email, 'verify_email');
  await page.goto(link);
  await expect(page.getByTestId('verify-done')).toBeVisible();

  // Opened again from the letter: a new tab, as a mail app does.
  const again = await page.context().newPage();
  await again.goto(link);

  await expect(again.getByRole('alert')).toHaveText(/Ссылка недействительна/);
});

test('L-006: a taken e-mail looks like a new one and its owner gets a letter', async ({ page }) => {
  const { email, nickname } = newAccount();
  await register(page, email, nickname);

  await register(page, email, `${nickname.slice(0, 18)}x2`);

  expect(new URL(await linkFromLetter(email, 'account_exists')).pathname).toBe('/login');
});

test('wrong password gets one error for both cases (ACC-12)', async ({ page }) => {
  const { email, nickname } = newAccount();
  await register(page, email, nickname);

  await login(page, email, 'wrong password');
  await expect(page.getByRole('alert')).toHaveText('Неверный e-mail или пароль');
  await login(page, `nobody-${email}`, PASSWORD);
  await expect(page.getByRole('alert')).toHaveText('Неверный e-mail или пароль');
});

test('GST-06: play as a guest', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'Играть как гость' }).click();

  await expect(page.getByTestId('participant-name')).toHaveText(/^Guest-\d{4}$/);
  await page.reload();
  await expect(page.getByTestId('participant-name')).toHaveText(/^Guest-\d{4}$/);
});

test('ACC-03, ACC-13: reset the password from the letter', async ({ page, browser }) => {
  const { email, nickname } = newAccount();
  await register(page, email, nickname);
  const other = await browser.newPage(); // a second device that is logged in
  await login(other, email, PASSWORD);
  await expect(other.getByTestId('participant-name')).toHaveText(nickname);

  await page.goto('/forgot-password');
  await page.getByLabel('E-mail').fill(email);
  await page.getByRole('button', { name: 'Отправить ссылку' }).click();
  await expect(page.getByTestId('request-done')).toBeVisible();
  await page.goto(await linkFromLetter(email, 'reset_password'));
  await page.getByLabel('Новый пароль').fill('battery staple');
  await page.getByRole('button', { name: 'Сохранить пароль' }).click();
  await expect(page.getByTestId('reset-done')).toBeVisible();

  await other.reload(); // ACC-13: every session of the account has ended
  await expect(other.getByRole('button', { name: 'Играть как гость' })).toBeVisible();
  await login(page, email, PASSWORD);
  await expect(page.getByRole('alert')).toHaveText('Неверный e-mail или пароль');
  await login(page, email, 'battery staple');
  await expect(page.getByTestId('participant-name')).toHaveText(nickname);
});

test('L-053: the site shows the name KubikChess', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('KubikChess — шахматы с кубиками');
  await expect(page.getByTestId('brand')).toHaveText('KubikChess');
});
