// SPDX-License-Identifier: GPL-3.0-or-later
// A dragged piece stays where it was dropped while the server answers (bug 2026-11-08: on
// kubikchess.ru the piece jumped back to its square and moved again after the server reply).
// Server messages are delayed through a routed WebSocket, as on a slow network.
import { expect, type Page, test } from '@playwright/test';

const SERVER_DELAY_MS = 1500;
const ROUND_TIMEOUT_MS = 20_000;

interface Network {
  delayMs: number;
  allowed: string[];
  ownRound: boolean;
  rejectNextMove: boolean;
}

/** Proxies /ws; server messages can be delayed and the next move can be answered with an error. */
async function slowNetwork(page: Page): Promise<Network> {
  const net: Network = { delayMs: 0, allowed: [], ownRound: false, rejectNextMove: false };
  let color: string | null = null;
  await page.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer();
    ws.onMessage((raw) => {
      const command = JSON.parse(String(raw)) as Record<string, unknown>;
      if (command.type === 'move' && net.rejectNextMove) {
        net.rejectNextMove = false;
        const reply = { type: 'error', request_id: command.request_id, code: 'illegal_move' };
        setTimeout(() => ws.send(JSON.stringify(reply)), net.delayMs);
        return;
      }
      server.send(raw);
    });
    server.onMessage((raw) => {
      const message = JSON.parse(String(raw)) as Record<string, unknown>;
      if (message.type === 'game_started') color = String(message.color);
      if (message.type === 'round_rolled' || message.type === 'move_made') {
        net.allowed = Array.isArray(message.allowed_moves) ? (message.allowed_moves as string[]) : [];
        // move_made carries no turn: it is the side to move in the FEN.
        const turn =
          message.type === 'round_rolled'
            ? message.color
            : String(message.fen).split(' ')[1] === 'w' ? 'white' : 'black';
        net.ownRound = turn === color && net.allowed.length > 0;
      }
      if (message.type === 'turn_skipped') net.ownRound = false;
      setTimeout(() => ws.send(raw), net.delayMs);
    });
  });
  return net;
}

async function squareCenter(page: Page, square: string): Promise<{ x: number; y: number }> {
  const box = await page.getByTestId('board').boundingBox();
  if (!box) throw new Error('no board');
  const size = box.width / 8;
  const column = square.charCodeAt(0) - 'a'.charCodeAt(0); // playing white: a1 bottom left
  const row = 8 - Number(square[1]);
  return { x: box.x + (column + 0.5) * size, y: box.y + (row + 0.5) * size };
}

async function drag(page: Page, from: string, to: string): Promise<void> {
  const start = await squareCenter(page, from);
  const end = await squareCenter(page, to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
}

/** Square of every piece on the board, from chessground's piece elements. */
async function pieceSquares(page: Page): Promise<string[]> {
  // A string: the e2e tsconfig has no DOM types.
  return page.evaluate<string[]>(
    "Array.from(document.querySelectorAll('cg-board piece:not(.ghost)')).map((p) => p.cgKey)",
  );
}

async function startBotGame(page: Page, net: Network): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(page.getByTestId('bot-game')).toBeEnabled();
  await page.locator('#bot-color').selectOption('white');
  await page.getByTestId('bot-game').click();
  await expect(page.getByTestId('opponent-name')).toHaveText('Компьютер');
  // A round can be skipped when no rolled piece can move: wait for one with moves.
  await expect.poll(() => net.ownRound, { timeout: ROUND_TIMEOUT_MS }).toBe(true);
  await expect(page.getByTestId('game-status')).toContainText('Ваш ход');
  const move = net.allowed.find((uci) => uci.length === 4);
  if (!move) throw new Error(`no simple move in ${net.allowed.join(' ')}`);
  return move;
}

test('a dropped piece stays on its new square while the server answers', async ({ page }) => {
  const net = await slowNetwork(page);
  const move = await startBotGame(page, net);
  const [from, to] = [move.slice(0, 2), move.slice(2, 4)];

  net.delayMs = SERVER_DELAY_MS;
  await drag(page, from, to);
  await page.waitForTimeout(SERVER_DELAY_MS / 3); // the reply is still on its way

  const squares = await pieceSquares(page);
  expect(squares).toContain(to);
  expect(squares).not.toContain(from);
});

test('a dropped piece goes back when the server rejects the move', async ({ page }) => {
  const net = await slowNetwork(page);
  const move = await startBotGame(page, net);
  const [from, to] = [move.slice(0, 2), move.slice(2, 4)];

  net.delayMs = SERVER_DELAY_MS;
  net.rejectNextMove = true;
  await drag(page, from, to);

  await expect(page.getByTestId('game-error')).toBeVisible({ timeout: SERVER_DELAY_MS * 3 });
  await expect.poll(() => pieceSquares(page)).toContain(from);
  expect(await pieceSquares(page)).not.toContain(to);
});
