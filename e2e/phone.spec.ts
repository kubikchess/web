// SPDX-License-Identifier: GPL-3.0-or-later
// Lobby and game on a phone (NFR-15): run in the iphone and android projects only (@phone).
// The game is against the computer: no queue, so the two phone projects do not meet.
import { expect, type Page, test } from '@playwright/test';

import { tapMove } from './board';

const ROUND_TIMEOUT_MS = 20_000;

/** Own moves seen in WebSocket frames: the allowed moves of the latest round message. */
function watch(page: Page): { color: string | null; allowed: string[]; ownMoves: number } {
  const seen = { color: null as string | null, allowed: [] as string[], ownMoves: 0 };
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      const message = JSON.parse(String(frame.payload)) as Record<string, unknown>;
      if (message.type === 'game_started') seen.color = String(message.color);
      if (message.type === 'round_rolled' || message.type === 'move_made') {
        seen.allowed = Array.isArray(message.allowed_moves) ? (message.allowed_moves as string[]) : [];
        if (message.type === 'move_made' && message.color === seen.color) seen.ownMoves += 1;
      }
    });
  });
  return seen;
}

async function asGuest(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeVisible();
}

/** No horizontal page scroll. */
async function fitsWidth(page: Page): Promise<boolean> {
  // A string: the e2e tsconfig has no DOM types.
  return page.evaluate<boolean>('document.documentElement.scrollWidth <= document.documentElement.clientWidth');
}

/** The element lies within the screen width. */
async function inWidth(page: Page, selector: ReturnType<Page['locator']>): Promise<void> {
  const box = await selector.boundingBox();
  const width = page.viewportSize()?.width;
  if (!box || !width) throw new Error('no box or viewport');
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width + 1); // subpixel rounding
}

test('L-051: the lobby fits a phone screen', { tag: '@phone' }, async ({ page }) => {
  // The home page with the guest notice (GST-09) fits too.
  await page.goto('/');
  await inWidth(page, page.getByTestId('guest-terms-notice'));
  await inWidth(page, page.getByTestId('footer-about'));
  expect(await fitsWidth(page)).toBe(true);

  // The About page with the source link (NFR-17) fits as well.
  await page.getByTestId('footer-about').click();
  await inWidth(page, page.getByTestId('about-source'));
  expect(await fitsWidth(page)).toBe(true);
  await page.goto('/');

  await asGuest(page);

  for (const id of ['quick-play', 'bot-game']) {
    await page.getByTestId(id).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(id)).toBeVisible();
    await inWidth(page, page.getByTestId(id));
  }
  expect(await fitsWidth(page)).toBe(true);
});

test('L-052: a game on a phone fits the screen and takes a move by tap', { tag: '@phone' }, async ({ page }) => {
  const seen = watch(page);
  await asGuest(page);
  await page.locator('#bot-color').selectOption('white');
  await page.getByTestId('bot-game').click();
  await expect(page.getByTestId('opponent-name')).toHaveText('Компьютер');

  // A round can be skipped when no rolled piece can move: wait for one with moves.
  const ownRound = page.getByTestId('game-status').filter({ hasText: 'Ваш ход' });
  await expect.poll(async () => (await ownRound.count()) === 1 && seen.allowed.length > 0, {
    timeout: ROUND_TIMEOUT_MS,
  }).toBe(true);

  await inWidth(page, page.getByTestId('board'));
  await expect(page.getByTestId('die').first()).toBeVisible();
  await inWidth(page, page.locator('aside.panel'));
  expect(await fitsWidth(page)).toBe(true);

  await tapMove(page, seen.allowed);
  await expect.poll(() => seen.ownMoves).toBe(1);
  await expect(page.getByTestId('game-error')).toHaveCount(0);
});
