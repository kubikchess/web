// SPDX-License-Identifier: GPL-3.0-or-later
// Moves on the chessground board by clicks or taps, for E2E tests of online games.
import type { Page } from '@playwright/test';

async function squareCenter(page: Page, square: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('no board');
  const white = (await page.getByTestId('game-started').textContent())?.includes('белыми') ?? true;
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = Number(square[1]) - 1;
  const size = box.width / 8;
  const column = white ? file : 7 - file;
  const row = white ? 7 - rank : rank;
  return { x: box.x + (column + 0.5) * size, y: box.y + (row + 0.5) * size };
}

async function pointMove(page: Page, allowed: readonly string[], touch: boolean): Promise<string> {
  const move = allowed.find((uci) => uci.length === 4);
  if (!move) throw new Error(`no simple move in ${allowed.join(' ')}`);
  for (const square of [move.slice(0, 2), move.slice(2, 4)]) {
    const { x, y } = await squareCenter(page, square);
    if (touch) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
  }
  return move;
}

/** Click-move the first allowed non-promotion move; returns it in UCI. */
export async function clickMove(page: Page, allowed: readonly string[]): Promise<string> {
  return pointMove(page, allowed, false);
}

/** The same by taps, for phones (NFR-15). */
export async function tapMove(page: Page, allowed: readonly string[]): Promise<string> {
  return pointMove(page, allowed, true);
}
