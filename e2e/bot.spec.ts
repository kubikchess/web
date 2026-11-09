// SPDX-License-Identifier: GPL-3.0-or-later
// Games against the computer end to end (task 10, ADR 0011). No queue: tests do not meet.
import { type Browser, expect, type Page, test } from '@playwright/test';

import { clickMove } from './board';
import { verifiedPlayer } from './users';

/** Bot moves come after a pause and the search: allow for several. */
const BOT_TIMEOUT_MS = 20_000;

interface Seen {
  color: string | null; // own color from game_started
  allowed: string[]; // allowed moves of the latest round message
  botMoves: number;
}

function watch(page: Page): Seen {
  const seen: Seen = { color: null, allowed: [], botMoves: 0 };
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      const message = JSON.parse(String(frame.payload)) as Record<string, unknown>;
      if (message.type === 'game_started') seen.color = String(message.color);
      if (message.type === 'round_rolled' || message.type === 'move_made') {
        seen.allowed = Array.isArray(message.allowed_moves) ? (message.allowed_moves as string[]) : [];
        if (message.type === 'move_made' && message.color !== seen.color) seen.botMoves += 1;
      }
    });
  });
  return seen;
}

async function startBotGame(page: Page, color: 'white' | 'black' | 'random'): Promise<void> {
  await expect(page.getByTestId('bot-game')).toBeEnabled();
  await page.locator('#bot-color').selectOption(color);
  await page.getByTestId('bot-game').click();
  await expect(page.getByTestId('opponent-name')).toHaveText('Компьютер');
}

/** Wait for a bot move; the human plays its own rounds meanwhile (a skipped bot round). */
async function waitForBotMove(page: Page, seen: Seen): Promise<void> {
  const ownRound = page.getByTestId('game-status').filter({ hasText: 'Ваш ход' });
  const deadline = Date.now() + BOT_TIMEOUT_MS;
  while (seen.botMoves === 0) {
    if (Date.now() > deadline) throw new Error('the computer did not move');
    if ((await ownRound.count()) === 1 && seen.allowed.length > 0) await clickMove(page, seen.allowed);
    await page.waitForTimeout(200);
  }
}

async function guestPage(browser: Browser): Promise<{ page: Page; seen: Seen }> {
  const page = await (await browser.newContext()).newPage();
  const seen = watch(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  return { page, seen };
}

test('L-043, L-046, L-050: a guest plays the computer, its moves arrive by themselves', { tag: '@smoke' }, async ({ browser }) => {
  const { page, seen } = await guestPage(browser);

  await startBotGame(page, 'black'); // the computer is white and rolls first

  await waitForBotMove(page, seen);
  await expect(page.getByTestId('game-error')).toHaveCount(0);
  await page.getByTestId('resign').click();
  await page.getByTestId('resign-confirm').click();
  await expect(page.getByTestId('game-status')).toHaveText('Вы проиграли: сдача');
  await page.getByTestId('leave-game').click();
  await expect(page.getByTestId('bot-game')).toBeEnabled(); // free again (QP-03)
});

test('BOT-08: the game against the computer is in the player history', async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await verifiedPlayer(page);
  await page.goto('/');

  await startBotGame(page, 'white');
  await page.getByTestId('resign').click();
  await page.getByTestId('resign-confirm').click();
  await expect(page.getByTestId('game-status')).toHaveText('Вы проиграли: сдача');
  await page.getByRole('link', { name: 'История' }).click();

  const row = page.getByTestId('history-row').first();
  await expect(row).toContainText('Компьютер');
  await expect(row.getByTestId('history-outcome')).toHaveText('Поражение, сдача');
});

test('L-049: the computer form offers the increments of quick play', async ({ browser }) => {
  const { page } = await guestPage(browser);
  const options = (id: string) =>
    page.locator(`${id} option`).evaluateAll((items) =>
      items.map((item) => [item.getAttribute('value') ?? '', item.textContent ?? '']),
    );

  // The lobby renders after the guest session: wait for the forms before reading them.
  await expect(page.locator('#quick-increment option')).toHaveCount(7);
  await expect(page.locator('#bot-increment option')).toHaveCount(7);
  const quick = await options('#quick-increment');
  expect(quick.map(([value]) => value)).toEqual(['', '5', '10', '15', '20', '25', '30']); // PAR-06
  expect(await options('#bot-increment')).toEqual(quick);
});
