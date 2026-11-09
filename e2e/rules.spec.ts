// SPDX-License-Identifier: GPL-3.0-or-later
// Rules help: the rules page and the short rules on the game screen (rules-help, NFR-18, GS-08).
import { expect, type Page, test } from '@playwright/test';

const SECTIONS = [
  'Цель игры',
  'Раунд и кубики',
  'Ходы',
  'Взятие короля',
  'Особые ходы',
  'Конец партии',
  'Время',
  'Отличия от обычных шахмат',
];

test('L-077: the rules page opens without a session from the header', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('nav-rules').click();
  await expect(page).toHaveURL(/\/rules$/);

  const rules = page.getByTestId('rules-page');
  await expect(rules.getByRole('heading', { level: 1 })).toHaveText('Правила KubikChess');
  await expect(rules.getByRole('heading', { level: 2 })).toHaveText(SECTIONS);
  // Profile numbers are filled in (L-079 keeps them equal to the server profile).
  await expect(rules).toContainText('30 ходов подряд');
  await expect(rules).toContainText('Блиц — 3 минуты');
  await expect(rules).not.toContainText('{{');
  // No old product name: L-076 checks the texts (ru.json) without naming it here.
});

test('L-078: the About page links to the rules', async ({ page }) => {
  await page.goto('/about');
  await page.getByTestId('about-rules').click();
  await expect(page).toHaveURL(/\/rules$/);
  await expect(page.getByTestId('rules-page')).toBeVisible();
});

const SUMMARY_IDS = ['dice', 'maximum', 'goal', 'king-capture', 'special', 'promotion', 'draw'];

/** A guest starts a game against the computer and waits for the game screen. */
async function guestBotGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeVisible();
  await page.getByTestId('bot-game').click();
  await expect(page.getByTestId('opponent-name')).toHaveText('Компьютер');
}

/** No horizontal page scroll; a string: the e2e tsconfig has no DOM types. */
async function fitsWidth(page: Page): Promise<boolean> {
  return page.evaluate<boolean>('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
}

test('L-080: the short rules are open left of the board on a wide screen and link to the full rules', async ({ page }) => {
  await guestBotGame(page);
  const summary = page.getByTestId('rules-summary');
  await expect(summary).toHaveAttribute('open', '');
  const items = summary.locator('li[data-rule]');
  await expect(items).toHaveCount(SUMMARY_IDS.length);
  for (const [index, id] of SUMMARY_IDS.entries()) {
    await expect(items.nth(index)).toHaveAttribute('data-rule', id);
    await expect(items.nth(index)).toBeVisible();
  }
  await expect(summary).toContainText('30 ходов подряд без взятий');
  // A column to the left of the board; the board keeps its full size (600 px).
  const summaryBox = await summary.boundingBox();
  const boardBox = await page.getByTestId('board').boundingBox();
  if (!summaryBox || !boardBox) throw new Error('no box');
  expect(summaryBox.x + summaryBox.width).toBeLessThanOrEqual(boardBox.x);
  expect(Math.round(boardBox.width)).toBe(600);
  // The rules column is wider than the panel with the clocks and the dice (customer, 2026-11-09).
  const panelBox = await page.locator('aside.panel').boundingBox();
  if (!panelBox) throw new Error('no box');
  expect(summaryBox.width).toBeGreaterThan(panelBox.width);

  const full = summary.getByRole('link', { name: 'Полные правила' });
  await expect(full).toHaveAttribute('href', '/rules');
  await expect(full).toHaveAttribute('target', '_blank');
  await expect(full).toHaveAttribute('rel', /noopener/);
  // The full rules open in a new tab; the game tab stays on the game.
  const [rulesTab] = await Promise.all([page.context().waitForEvent('page'), full.click()]);
  await expect(rulesTab.getByTestId('rules-page')).toBeVisible();
  await expect(page.getByTestId('opponent-name')).toBeVisible();
});

test('L-081: the short rules are collapsed below the panel on a phone and open by tap', { tag: '@phone' }, async ({ page }) => {
  await guestBotGame(page);
  const summary = page.getByTestId('rules-summary');
  await expect(summary).not.toHaveAttribute('open', /.*/);
  await expect(summary.locator('li[data-rule]').first()).toBeHidden();
  expect(await fitsWidth(page)).toBe(true);
  // Below the panel: the board and the dice stay where they were.
  const summaryBox = await summary.boundingBox();
  const panelBox = await page.locator('aside.panel').boundingBox();
  if (!summaryBox || !panelBox) throw new Error('no box');
  expect(summaryBox.y).toBeGreaterThanOrEqual(panelBox.y + panelBox.height);

  await summary.locator('summary').tap();
  const items = summary.locator('li[data-rule]');
  await expect(items).toHaveCount(SUMMARY_IDS.length);
  for (const index of SUMMARY_IDS.keys()) await expect(items.nth(index)).toBeVisible();
  expect(await fitsWidth(page)).toBe(true);
});
