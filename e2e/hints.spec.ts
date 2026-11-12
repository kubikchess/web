// SPDX-License-Identifier: GPL-3.0-or-later
// Hints about the rule that forbids a move (rules-help, GS-12, GS-13) and the short rules in
// hot-seat (L-099). Random dice give no chosen position, so the hot-seat API is stubbed here;
// the server side of the reasons is covered by pytest (L-093..L-097).
import { expect, type Page, test } from '@playwright/test';

type Piece = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king';

interface Blocked {
  move: string;
  reason: 'maximum' | 'king_capture_attacked' | 'king_takes_king';
  moves: number | null;
  attackers: string[];
}

interface StateFields {
  fen: string;
  turn?: 'white' | 'black';
  phase?: 'roll' | 'move' | 'finished';
  faces?: Piece[];
  remaining?: Piece[];
  allowed?: string[];
  movesLeft?: number;
  blocked?: Blocked[];
  kingAttackers?: string[];
  version?: number;
}

function state(fields: StateFields) {
  const turn = fields.turn ?? 'white';
  const faces = fields.faces ?? ['pawn', 'pawn', 'pawn'];
  return {
    game_id: 'stub',
    version: fields.version ?? 1,
    fen: fields.fen,
    turn,
    phase: fields.phase ?? 'move',
    dice: { color: turn, faces, remaining: fields.remaining ?? faces, skipped: false },
    allowed_moves: fields.allowed ?? [],
    moves_left: fields.movesLeft ?? 3,
    last_move: null,
    no_capture_moves: 0,
    skipped_rounds: 0,
    result: null,
    record: [{ color: turn, faces, moves: [], skipped: false }],
    blocked_moves: fields.blocked ?? [],
    king_attackers: fields.kingAttackers ?? [],
  };
}

/** Opens hot-seat on a stubbed state; returns the moves the page sends. */
async function openHotSeat(page: Page, first: ReturnType<typeof state>, afterMove?: ReturnType<typeof state>) {
  const sent: string[] = [];
  await page.route('**/dev/hot-seat/games', (route) => route.fulfill({ status: 201, json: first }));
  await page.route('**/dev/hot-seat/games/stub/moves', async (route) => {
    const body = route.request().postDataJSON() as { move: string };
    sent.push(body.move);
    await route.fulfill({ json: afterMove ?? first });
  });
  await page.goto('/hot-seat');
  await expect(page.getByTestId('board')).toBeVisible();
  return sent;
}

/** Centre of a square; hot-seat shows white at the bottom. */
async function squareCenter(page: Page, square: string) {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('Board is not visible');
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]);
  const size = box.width / 8;
  return { x: box.x + (file + 0.5) * size, y: box.y + (8 - rank + 0.5) * size };
}

async function drag(page: Page, from: string, to: string) {
  const start = await squareCenter(page, from);
  const end = await squareCenter(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

async function clickSquare(page: Page, square: string) {
  const { x, y } = await squareCenter(page, square);
  await page.mouse.click(x, y);
}

/** The square under a piece element of the board. */
async function squareOf(page: Page, selector: string): Promise<string> {
  const board = await page.getByTestId('board').boundingBox();
  const piece = await page.locator(`cg-board piece.${selector}`).boundingBox();
  if (!board || !piece) throw new Error('no box');
  const size = board.width / 8;
  const file = Math.floor((piece.x + piece.width / 2 - board.x) / size);
  const rank = 8 - Math.floor((piece.y + piece.height / 2 - board.y) / size);
  return `${String.fromCharCode('a'.charCodeAt(0) + file)}${rank}`;
}

const highlighted = (page: Page) => page.getByTestId('rules-summary').locator('li.highlighted');

test('L-099: the short rules are open in hot-seat with 13 items and the full rules link', async ({ page }) => {
  await openHotSeat(page, state({ fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0', phase: 'roll' }));
  const summary = page.getByTestId('rules-summary');
  await expect(summary).toHaveAttribute('open', '');
  await expect(summary.locator('li[data-rule]')).toHaveCount(13);
  await expect(summary.getByRole('link', { name: 'Полные правила' })).toHaveAttribute('target', '_blank');
  await expect(page.getByTestId('move-hint')).toHaveCount(0);
});

test('L-100: a move that breaks the maximum goes back with a hint until an allowed move', async ({ page }) => {
  const fen = '7k/8/8/8/8/3P4/8/1NBRK3 w - - 0';
  const round = {
    fen,
    faces: ['knight', 'rook', 'rook'] as Piece[],
    allowed: ['b1a3', 'b1c3', 'd1d2'],
    movesLeft: 3,
    blocked: [{ move: 'b1d2', reason: 'maximum' as const, moves: 1, attackers: [] }],
  };
  const after = state({
    ...round,
    fen: '7k/8/8/8/8/N2P4/8/2BRK3 w - - 1',
    remaining: ['rook', 'rook'],
    allowed: ['d1d2'],
    movesLeft: 2,
    blocked: [],
    version: 2,
  });
  const sent = await openHotSeat(page, state(round), after);
  // Selected knight: dots on a3 and c3, none on the forbidden d2.
  await clickSquare(page, 'b1');
  await expect(page.locator('cg-board square.move-dest:not(.blocked-dest)')).toHaveCount(2);
  await expect(page.locator('cg-board square.move-dest.blocked-dest')).toHaveCount(1);

  await drag(page, 'b1', 'd2');

  const hint = page.getByTestId('move-hint');
  await expect(hint).toHaveText('Так получится только 1 ход из 3, а нужно сделать как можно больше ходов');
  await expect(hint).toHaveAttribute('data-rule', 'maximum');
  await expect(highlighted(page)).toHaveAttribute('data-rule', 'maximum');
  await expect.poll(() => squareOf(page, 'white.knight')).toBe('b1');
  expect(sent).toEqual([]);

  await drag(page, 'b1', 'a3');

  await expect.poll(() => sent).toEqual(['b1a3']);
  await expect(hint).toHaveCount(0);
  await expect(highlighted(page)).toHaveCount(0);
});

test('L-101: a king capture from an attacked square shows the attack', async ({ page }) => {
  const sent = await openHotSeat(
    page,
    state({
      fen: 'k7/8/8/8/8/8/8/3qK3 b - - 0',
      turn: 'black',
      faces: ['queen', 'queen', 'queen'],
      allowed: ['d1d2', 'd1c1', 'd1c2'],
      blocked: [{ move: 'd1e1', reason: 'king_capture_attacked', moves: null, attackers: ['e1'] }],
    }),
  );

  await drag(page, 'd1', 'e1');

  const hint = page.getByTestId('move-hint');
  await expect(hint).toHaveText('Короля нельзя взять: поле d1 бьёт соперник');
  await expect(highlighted(page)).toHaveAttribute('data-rule', 'king-capture');
  await expect(page.locator('svg.cg-shapes line')).toHaveCount(1);
  expect(sent).toEqual([]);
});

test('L-102: a king does not capture the king', async ({ page }) => {
  const sent = await openHotSeat(
    page,
    state({
      fen: '8/8/8/4k3/4K3/8/8/8 w - - 0',
      faces: ['king', 'king', 'king'],
      allowed: ['e4d3', 'e4e3', 'e4f3'],
      blocked: [{ move: 'e4e5', reason: 'king_takes_king', moves: null, attackers: [] }],
    }),
  );

  await drag(page, 'e4', 'e5');

  await expect(page.getByTestId('move-hint')).toHaveText('Король не может взять короля');
  await expect(highlighted(page)).toHaveAttribute('data-rule', 'king-king');
  expect(sent).toEqual([]);
});

test('L-103: a piece without a die gets a hint when picked', async ({ page }) => {
  const sent = await openHotSeat(
    page,
    state({
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0',
      faces: ['pawn', 'rook', 'rook'],
      allowed: ['a2a3', 'a2a4', 'h2h3', 'h2h4'],
    }),
  );

  await clickSquare(page, 'g1');

  await expect(page.getByTestId('move-hint')).toHaveText('Нет кубика «конь»: ходят только фигуры выпавших типов');
  await expect(highlighted(page)).toHaveAttribute('data-rule', 'dice');
  expect(sent).toEqual([]);
});

test('a move impossible in chess as well goes back without a hint', async ({ page }) => {
  const sent = await openHotSeat(
    page,
    state({
      fen: '4k3/8/8/8/8/8/8/2B1K3 w - - 0',
      faces: ['bishop', 'bishop', 'bishop'],
      allowed: ['c1b2', 'c1d2', 'c1a3', 'c1e3'],
      movesLeft: 3,
    }),
  );

  await drag(page, 'c1', 'c2');

  await expect.poll(() => squareOf(page, 'white.bishop')).toBe('c1');
  await expect(page.getByTestId('move-hint')).toHaveCount(0);
  expect(sent).toEqual([]);
});

test('L-104: the attacked king gets a hint at the start of the round until the first move', async ({ page }) => {
  const fen = '4k2R/8/8/8/8/8/8/4K3 b - - 0';
  const round = {
    fen,
    turn: 'black' as const,
    faces: ['king', 'king', 'king'] as Piece[],
    allowed: ['e8d7', 'e8e7', 'e8f7'],
    kingAttackers: ['h8'],
  };
  const after = state({
    ...round,
    fen: '7R/3k4/8/8/8/8/8/4K3 b - - 1',
    remaining: ['king', 'king'],
    allowed: ['d7c6', 'd7d6'],
    movesLeft: 2,
    kingAttackers: [],
    version: 2,
  });
  const sent = await openHotSeat(page, state(round), after);

  const hint = page.getByTestId('move-hint');
  await expect(hint).toHaveText('Ваш король под боем — шаха нет, раунд играется как обычно');
  await expect(highlighted(page)).toHaveAttribute('data-rule', 'king-attacked');

  await drag(page, 'e8', 'd7');

  await expect.poll(() => sent).toEqual(['e8d7']);
  await expect(hint).toHaveCount(0);
});

test('no hint about the attacked king while waiting for the roll', async ({ page }) => {
  await openHotSeat(page, state({ fen: '4k2R/8/8/8/8/8/8/4K3 b - - 0', turn: 'black', phase: 'roll', kingAttackers: [] }));

  await expect(page.getByTestId('status')).toBeVisible();
  await expect(page.getByTestId('move-hint')).toHaveCount(0);
});
