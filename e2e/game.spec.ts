// SPDX-License-Identifier: GPL-3.0-or-later
// Online game end to end: moves, resignation, draw, reload and history (task 9, ADR 0010).
// Tests run in parallel in one lobby: each one plays its own mode and increment.
import { type Browser, expect, type Page, test } from '@playwright/test';

import { clickMove } from './board';
import { verifiedPlayer } from './users';

/** What a page received over /ws: the latest game version and allowed moves. */
interface Seen {
  version: number;
  allowed: string[];
  moves: string[]; // every move_made, in order
}

interface Player {
  page: Page;
  seen: Seen;
}

// Game messages only: participant_state has a game_id too, but its version is the participant's.
const GAME_MESSAGES = new Set(['game_started', 'game_state', 'round_rolled', 'move_made', 'turn_skipped']);

function watch(page: Page): Seen {
  const seen: Seen = { version: 0, allowed: [], moves: [] };
  page.on('websocket', (socket) => {
    socket.on('framereceived', (frame) => {
      const message = JSON.parse(String(frame.payload)) as Record<string, unknown>;
      if (!GAME_MESSAGES.has(String(message.type)) || typeof message.version !== 'number') return;
      if (message.version < seen.version) return;
      seen.version = message.version;
      if (Array.isArray(message.allowed_moves)) seen.allowed = message.allowed_moves as string[];
      if (message.type === 'move_made') seen.moves.push(String(message.move));
    });
  });
  return seen;
}

async function guest(browser: Browser): Promise<Player> {
  const page = await (await browser.newContext()).newPage();
  const seen = watch(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('quick-play')).toBeEnabled();
  return { page, seen };
}

async function player(browser: Browser): Promise<Player> {
  const page = await (await browser.newContext()).newPage();
  const seen = watch(page);
  await verifiedPlayer(page);
  await page.goto('/');
  await expect(page.getByTestId('quick-play')).toBeEnabled();
  return { page, seen };
}

// Queues of this file: none of the lobby tests' (rapid 30, rapid 25). Copies of a test made by
// --repeat-each get their own queue, or they would be matched with each other.
const QUEUES: ['blitz' | 'rapid', string][] = [
  ['blitz', '5'],
  ['blitz', '10'],
  ['blitz', '15'],
  ['rapid', '5'],
  ['rapid', '10'],
  ['blitz', '20'],
  ['blitz', '25'],
  ['blitz', '30'],
  ['rapid', '15'],
  ['rapid', '20'],
];
const TESTS_IN_FILE = 5;

/** Quick play for both; returns [the side to move, the other] once the first round has moves. */
async function seat(a: Player, b: Player, slot: number): Promise<[Player, Player]> {
  const queue = QUEUES[slot + TESTS_IN_FILE * test.info().repeatEachIndex];
  if (!queue) throw new Error('no free queue for this test copy');
  const [mode, increment] = queue;
  for (const p of [a, b]) {
    await p.page.locator('#quick-mode').selectOption(mode);
    await p.page.locator('#quick-increment').selectOption(increment);
    await p.page.getByTestId('quick-play').click();
  }
  const ownRound = (p: Player) => p.page.getByTestId('game-status').filter({ hasText: 'Ваш ход' });
  await expect.poll(async () => (await ownRound(a).count()) + (await ownRound(b).count())).toBe(1);
  return (await ownRound(a).count()) === 1 ? [a, b] : [b, a];
}

/** Click-move the first allowed non-promotion move; returns it in UCI. */
async function moveOnce(p: Player): Promise<string> {
  return clickMove(p.page, p.seen.allowed);
}

test('L-050: a move goes through the server to the opponent', { tag: '@smoke' }, async ({ browser }) => {
  const [mover, other] = await seat(await guest(browser), await guest(browser), 0);

  const move = await moveOnce(mover);

  await expect.poll(() => other.seen.moves).toContain(move);
  await expect.poll(() => mover.seen.moves).toContain(move);
  await expect(mover.page.getByTestId('game-error')).toHaveCount(0);
});

test('T-078, T-079: resignation ends the game for both', async ({ browser }) => {
  const [mover, other] = await seat(await guest(browser), await guest(browser), 1);

  await other.page.getByTestId('resign').click(); // in the opponent's round
  await other.page.getByTestId('resign-confirm').click();

  await expect(other.page.getByTestId('game-status')).toHaveText('Вы проиграли: сдача');
  await expect(mover.page.getByTestId('game-status')).toHaveText('Вы победили: сдача');
  await mover.page.getByTestId('leave-game').click();
  await expect(mover.page.getByTestId('quick-play')).toBeEnabled(); // free again (QP-03)
});

test('T-080: a draw offer is accepted', async ({ browser }) => {
  const [mover, other] = await seat(await guest(browser), await guest(browser), 2);

  await mover.page.getByTestId('offer-draw').click();
  await expect(mover.page.getByTestId('own-draw-offer')).toBeVisible();
  await expect(mover.page.getByTestId('offer-draw')).toBeDisabled(); // once per round (T-082)
  await other.page.getByTestId('accept-draw').click();

  for (const p of [mover, other]) {
    await expect(p.page.getByTestId('game-status')).toHaveText('Ничья: по соглашению');
  }
});

test('L-030: a reload brings the game back with running clocks', async ({ browser }) => {
  const [mover, other] = await seat(await guest(browser), await guest(browser), 3);
  const before = await other.page.getByTestId('game-status').textContent();

  await other.page.reload();

  await expect(other.page.getByTestId('game-status')).toHaveText(before ?? '');
  const color = (await mover.page.getByTestId('game-started').textContent())?.includes('белыми') ? 'white' : 'black';
  await expect(other.page.getByTestId(`clock-${color}`)).toHaveAttribute('data-running', 'true');
  await expect(other.page.getByTestId('opponent-name')).toHaveText(/\S+/);
});

test('L-035: the history keeps the game of a player, not of a guest', async ({ browser }) => {
  const alice = await player(browser);
  const stranger = await guest(browser);
  await seat(alice, stranger, 4);

  await alice.page.getByTestId('resign').click();
  await alice.page.getByTestId('resign-confirm').click();
  await expect(alice.page.getByTestId('game-status')).toHaveText('Вы проиграли: сдача');
  await alice.page.getByRole('link', { name: 'История' }).click();

  const row = alice.page.getByTestId('history-row').first();
  await expect(row.getByTestId('history-outcome')).toHaveText('Поражение, сдача');
  await expect(row).toContainText('(гость)');
  await expect(stranger.page.getByRole('link', { name: 'История' })).toHaveCount(0);
});
