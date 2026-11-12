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

/** A record of 12 rows, each with the longest moves of a round (L-098); stubbed hot-seat. */
function longRecordState() {
  const note = (piece: string, to: string, extra: Record<string, unknown> = {}) => ({
    piece,
    origin: '',
    capture: false,
    to,
    promotion: null,
    castling: null,
    ...extra,
  });
  const white = {
    color: 'white',
    faces: ['king', 'queen', 'rook'],
    moves: [note('king', 'e2'), note('queen', 'd1'), note('rook', 'd1', { origin: 'a' })],
    skipped: false,
  };
  const black = {
    color: 'black',
    faces: ['pawn', 'pawn', 'pawn'],
    moves: [
      note('pawn', 'd5', { origin: 'e', capture: true }),
      note('pawn', 'e4', { origin: 'f', capture: true }),
      note('pawn', 'd1', { origin: 'c', capture: true, promotion: 'queen' }),
    ],
    skipped: false,
  };
  return {
    game_id: 'stub',
    version: 1,
    fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0',
    turn: 'white',
    phase: 'roll',
    dice: null,
    allowed_moves: [],
    moves_left: 0,
    last_move: null,
    no_capture_moves: 0,
    skipped_rounds: 0,
    result: null,
    record: Array.from({ length: 12 }, () => [white, black]).flat(),
    blocked_moves: [],
    king_attackers: [],
  };
}

for (const width of [1100, 1280, 1440]) {
  test(`L-098: the moves of a round fit one line of the record at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/dev/hot-seat/games', (route) => route.fulfill({ status: 201, json: longRecordState() }));
    await page.goto('/hot-seat');
    const record = page.getByTestId('game-record');
    await expect(record.getByTestId('record-row')).toHaveCount(12);

    // A cell of one line is no taller than its line height (plus padding).
    const tooTall = await page.evaluate<number>(`
      [...document.querySelectorAll('[data-testid^="record-moves-"]')].filter((cell) => {
        const style = getComputedStyle(cell);
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        return cell.getBoundingClientRect().height > line * 1.5 + padding;
      }).length
    `);
    expect(tooTall).toBe(0);
    const board = await page.getByTestId('board').boundingBox();
    if (!board) throw new Error('no box');
    expect(board.width).toBeGreaterThanOrEqual(560);
    expect(await fitsWidth(page)).toBe(true);
  });
}
