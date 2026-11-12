// SPDX-License-Identifier: GPL-3.0-or-later
// The game record on the game screen (game-session, GS-09, GS-10). Hot-seat: hot-seat.spec.ts.
import { expect, type Page, test } from '@playwright/test';

/** Bot moves come after a pause and the search: allow for several. */
const BOT_TIMEOUT_MS = 20_000;
/** Dice letters of a round: three of Кр, Ф, Л, С, К, П. */
const FACES = /^(Кр|[ФЛСКП]) (Кр|[ФЛСКП]) (Кр|[ФЛСКП])$/;

/** A guest plays black against the computer: the computer rolls first. */
async function guestBotGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('bot-game')).toBeEnabled();
  await page.locator('#bot-color').selectOption('black');
  await page.getByTestId('bot-game').click();
  await expect(page.getByTestId('opponent-name')).toHaveText('Компьютер');
}

async function fitsWidth(page: Page): Promise<boolean> {
  // A string: the e2e tsconfig has no DOM types.
  return page.evaluate<boolean>('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
}

test('L-087, L-089: the round of the computer is in the record and stays after a reload', async ({ page }) => {
  await guestBotGame(page);
  const record = page.getByTestId('game-record');
  await expect(record).toHaveAttribute('open', '');

  const first = record.getByTestId('record-row').first();
  await expect(first.locator('td.number')).toHaveText('1.');
  await expect(first.getByTestId('record-faces-white')).toHaveText(FACES);
  // The round of black opens once the computer has finished: moves, or the dash of a skip.
  await expect(first.getByTestId('record-faces-black')).toHaveText(FACES, { timeout: BOT_TIMEOUT_MS });
  const whiteMoves = await first.getByTestId('record-moves-white').innerText();
  expect(whiteMoves).toMatch(/\S/);
  const whiteFaces = await first.getByTestId('record-faces-white').innerText();

  await page.reload();

  const again = page.getByTestId('game-record').getByTestId('record-row').first();
  await expect(again.getByTestId('record-faces-white')).toHaveText(whiteFaces);
  await expect(again.getByTestId('record-moves-white')).toHaveText(whiteMoves);
});

test('L-090: the record is collapsed below the board on a phone and opens by tap', { tag: '@phone' }, async ({ page }) => {
  await guestBotGame(page);
  const record = page.getByTestId('game-record');
  await expect(record).not.toHaveAttribute('open', /.*/);
  await expect(record.locator('table')).toBeHidden();
  expect(await fitsWidth(page)).toBe(true);
  // Below the board and the dice: they stay where they were.
  const recordBox = await record.boundingBox();
  const boardBox = await page.getByTestId('board').boundingBox();
  const diceBox = await page.getByTestId('die').first().boundingBox();
  if (!recordBox || !boardBox || !diceBox) throw new Error('no box');
  expect(recordBox.y).toBeGreaterThanOrEqual(boardBox.y + boardBox.height);
  expect(recordBox.y).toBeGreaterThanOrEqual(diceBox.y + diceBox.height);

  await record.locator('summary').tap();

  await expect(record.getByTestId('record-faces-white').first()).toHaveText(FACES);
  expect(await fitsWidth(page)).toBe(true);
});
