// SPDX-License-Identifier: GPL-3.0-or-later
// Lobby end to end: the page, WebSocket /ws, Valkey scripts and pub/sub (task 8).
// Tests run in parallel on one lobby: each one plays its own mode and increment.
import { type Browser, expect, type Page, test } from '@playwright/test';

import { verifiedPlayer } from './users';

async function guest(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeEnabled(); // connected to the lobby
  return page;
}

async function player(browser: Browser): Promise<{ page: Page; nickname: string }> {
  const page = await (await browser.newContext()).newPage();
  const nickname = await verifiedPlayer(page);
  await page.goto('/');
  await expect(page.getByTestId('quick-play')).toBeEnabled();
  return { page, nickname };
}

async function quickPlay(page: Page, mode: 'blitz' | 'rapid', increment: string) {
  await page.locator('#quick-mode').selectOption(mode);
  await page.locator('#quick-increment').selectOption(increment);
  await page.getByTestId('quick-play').click();
}

test('L-040, L-010, L-050: two guests are matched and get opposite colors', { tag: '@smoke' }, async ({ browser }) => {
  const first = await guest(browser);
  const second = await guest(browser);

  await quickPlay(first, 'rapid', '30');
  await expect(first.getByTestId('waiting')).toContainText('Рапид, 5 мин + 30 с');
  await quickPlay(second, 'rapid', '30');

  for (const page of [first, second]) {
    await expect(page.getByTestId('game-started')).toBeVisible();
    await expect(page.getByTestId('opponent-name')).toHaveText(/^Guest-\d{4}$/);
  }
  const colors = await Promise.all(
    [first, second].map((p) => p.getByTestId('game-started').textContent()),
  );
  expect(colors.filter((c) => c?.includes('белыми'))).toHaveLength(1); // QP-02
});

test('L-014: leaving the queue returns to the form', async ({ browser }) => {
  const page = await guest(browser);
  await quickPlay(page, 'rapid', '25');
  await expect(page.getByTestId('waiting')).toBeVisible();

  await page.getByRole('button', { name: 'Отмена' }).click();

  await expect(page.getByTestId('quick-play')).toBeEnabled();
});

test('GST-03, GST-05: a guest has quick play only', async ({ browser }) => {
  const page = await guest(browser);
  await expect(page.getByTestId('create-game')).toHaveCount(0);
  await expect(page.getByText('Игры игроков')).toHaveCount(0);
});

test('L-020, L-022: a created game is listed, accepted and seats by color', async ({ browser }) => {
  const alice = await player(browser);
  const bob = await player(browser);

  await alice.page.locator('#offer-mode').selectOption('blitz');
  await alice.page.locator('#offer-increment').selectOption('20');
  await alice.page.locator('#offer-color').selectOption('white');
  await alice.page.getByTestId('create-game').click();
  await expect(alice.page.getByTestId('own-offer')).toContainText('Блиц, 3 мин + 20 с');

  const row = bob.page.getByTestId('offer-row').filter({ hasText: alice.nickname });
  await expect(row).toContainText('белые');
  await row.getByRole('button', { name: 'Принять' }).click();

  await expect(bob.page.getByTestId('game-started')).toContainText('чёрными');
  await expect(bob.page.getByTestId('opponent-name')).toHaveText(alice.nickname);
  await expect(alice.page.getByTestId('game-started')).toContainText('белыми');
  await expect(alice.page.getByTestId('opponent-name')).toHaveText(bob.nickname);
});

test('L-025: a cancelled game disappears from the list', async ({ browser }) => {
  const alice = await player(browser);
  const bob = await player(browser);
  await alice.page.locator('#offer-mode').selectOption('rapid');
  await alice.page.locator('#offer-increment').selectOption('15');
  await alice.page.getByTestId('create-game').click();
  const row = bob.page.getByTestId('offer-row').filter({ hasText: alice.nickname });
  await expect(row).toHaveCount(1);

  await alice.page.getByRole('button', { name: 'Отмена' }).click();

  await expect(row).toHaveCount(0);
  await expect(alice.page.getByTestId('create-game')).toBeEnabled();
});
