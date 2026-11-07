// SPDX-License-Identifier: GPL-3.0-or-later
import { expect, type Page, type Response, test } from '@playwright/test';

interface State {
  turn: 'white' | 'black';
  phase: 'roll' | 'move' | 'finished';
  version: number;
  allowed_moves: string[];
  moves_left: number;
}

const isCommand = (path: string) => (response: Response) =>
  response.url().endsWith(path) && response.request().method() === 'POST';

/** Roll until some side has a move: a round without moves is skipped by the server. */
async function rollUntilMove(page: Page): Promise<State> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const [response] = await Promise.all([
      page.waitForResponse(isCommand('/roll')),
      page.getByTestId('roll').click(),
    ]);
    const state = (await response.json()) as State;
    if (state.phase === 'move') return state;
  }
  throw new Error('No round with moves in 20 rolls');
}

/** Centre of a square on a board oriented with white at the bottom. */
async function squareCenter(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('Board is not visible');
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  const size = box.width / 8;
  return { x: box.x + (file + 0.5) * size, y: box.y + (8 - rank + 0.5) * size };
}

async function clickSquare(page: Page, square: string) {
  const { x, y } = await squareCenter(page, square);
  await page.mouse.click(x, y);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/hot-seat');
  await expect(page.getByTestId('status')).toHaveText('Белые: бросьте кубики');
});

test('roll and make an allowed move', async ({ page }) => {
  const rolled = await rollUntilMove(page);
  await expect(page.getByTestId('die')).toHaveCount(3);
  await expect(page.getByTestId('status')).toContainText('остал');

  const move = rolled.allowed_moves.find((uci) => uci.length === 4);
  if (!move) throw new Error('Expected a non-promotion move');
  await clickSquare(page, move.slice(0, 2));
  const [response] = await Promise.all([
    page.waitForResponse(isCommand('/moves')),
    clickSquare(page, move.slice(2, 4)),
  ]);

  expect(response.status()).toBe(200);
  const state = (await response.json()) as State;
  expect(state.version).toBe(rolled.version + 1);
  await expect(page.locator('[data-testid="die"][data-used="true"]')).not.toHaveCount(0);
});

test('a square without an allowed move sends nothing', async ({ page }) => {
  // White's round may be skipped, so the side to move can be either.
  const rolled = await rollUntilMove(page);
  const white = rolled.turn === 'white';
  const sources = new Set(rolled.allowed_moves.map((uci) => uci.slice(0, 2)));
  const backRank = [...'abcdefgh'].map((file) => `${file}${white ? 1 : 8}`);
  const blocked = backRank.find((sq) => !sources.has(sq));
  const commands: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/moves')) commands.push(request.url());
  });

  if (blocked) {
    await clickSquare(page, blocked);
    await clickSquare(page, `${blocked[0]}4`);
  }
  await clickSquare(page, white ? 'e7' : 'e2'); // an opponent pawn
  await clickSquare(page, white ? 'e5' : 'e4');

  expect(commands).toEqual([]);
});

test('new game resets the board', async ({ page }) => {
  await rollUntilMove(page);

  await page.getByRole('button', { name: 'Новая партия' }).click();

  await expect(page.getByTestId('status')).toHaveText('Белые: бросьте кубики');
  await expect(page.getByTestId('die')).toHaveCount(0);
});

const PROMOTION_FEN = '8/1P6/7k/8/8/8/PPPPPPP1/4K3 w - - 0';

/** A game where white can promote b7 this round; retried if no pawn die is rolled. */
async function openPromotionGame(page: Page): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const created = await page.request.post('/dev/hot-seat/games', {
      data: { fen: PROMOTION_FEN },
    });
    const { game_id: gameId } = (await created.json()) as { game_id: string };
    await page.goto(`/hot-seat?game=${gameId}`);
    const [response] = await Promise.all([
      page.waitForResponse(isCommand('/roll')),
      page.getByTestId('roll').click(),
    ]);
    const state = (await response.json()) as State;
    if (state.allowed_moves.includes('b7b8q')) return;
  }
  throw new Error('No pawn die in 10 games');
}

test('promotion asks for the piece and sends it', async ({ page }) => {
  await openPromotionGame(page);

  await clickSquare(page, 'b7');
  await clickSquare(page, 'b8');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const [response] = await Promise.all([
    page.waitForResponse(isCommand('/moves')),
    dialog.getByRole('button', { name: 'Конь' }).click(),
  ]);

  expect(response.request().postDataJSON()).toMatchObject({ move: 'b7b8n' });
  expect(((await response.json()) as { fen: string }).fen).toMatch(/^1N6\//);
  await expect(dialog).toBeHidden();
});

test('cancelled promotion sends nothing', async ({ page }) => {
  await openPromotionGame(page);
  const commands: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/moves')) commands.push(request.url());
  });

  await clickSquare(page, 'b7');
  await clickSquare(page, 'b8');
  await page.getByRole('button', { name: 'Отмена' }).click();

  await expect(page.getByRole('dialog')).toBeHidden();
  expect(commands).toEqual([]);
});

test('a reload keeps the game', async ({ page }) => {
  await rollUntilMove(page);
  const status = await page.getByTestId('status').textContent();

  await page.reload();

  await expect(page).toHaveURL(/\?game=/);
  await expect(page.getByTestId('status')).toHaveText(status ?? '');
  await expect(page.getByTestId('die')).toHaveCount(3);
});
