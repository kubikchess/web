// SPDX-License-Identifier: GPL-3.0-or-later
// A lobby tab whose session is gone stops reconnecting and shows the login (fix 2026-11-09).
// An open socket learns of a lost session by code 4401; a new one is refused at the handshake,
// which the browser reports as a plain drop, so the tab kept reconnecting every ~10 s.
import { expect, test } from '@playwright/test';

// Count the lobby sockets and let the test drop them (the e2e tsconfig has no DOM types).
// Only /ws: the Vite dev client has its own socket and reloads the page when it drops.
const TRACK_SOCKETS = `
  window.__sockets = [];
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(...args) {
      super(...args);
      if (new URL(this.url).pathname === '/ws') window.__sockets.push(this);
    }
  };
`;

test('a lobby tab without a session stops reconnecting and shows the login', async ({ browser }) => {
  const context = await browser.newContext();
  const lobby = await context.newPage();
  await lobby.addInitScript(TRACK_SOCKETS);
  await lobby.goto('/');
  await lobby.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(lobby.getByTestId('quick-play')).toBeEnabled(); // connected

  // The session ends without a word from the server, as when a guest session expires (24 h):
  // the open socket stays as it is, the browser no longer has the session cookie.
  await context.clearCookies({ name: 'dicechess_session' });

  // The lobby socket drops, as on a server restart; the next handshake has no session.
  await lobby.evaluate('window.__sockets.forEach((socket) => socket.close())');

  await expect(lobby.getByRole('button', { name: 'Играть как гость' })).toBeVisible({ timeout: 10_000 });
  const lobbySockets = (): Promise<number> => lobby.evaluate<number>('window.__sockets.length');
  const settled = await lobbySockets();
  await lobby.waitForTimeout(3_000); // longer than the first reconnect delays
  expect(await lobbySockets()).toBe(settled);
});

test('a lobby tab keeps the player while the server cannot be asked', async ({ browser }) => {
  const context = await browser.newContext();
  const lobby = await context.newPage();
  await lobby.addInitScript(TRACK_SOCKETS);
  await lobby.goto('/');
  await lobby.getByRole('button', { name: 'Играть как гость' }).click();
  await expect(lobby.getByTestId('quick-play')).toBeEnabled();

  // The socket cannot open again and /auth/me does not answer, as during a restart.
  await context.clearCookies({ name: 'dicechess_session' });
  await lobby.route('**/auth/me', (route) => route.abort());
  await lobby.evaluate('window.__sockets.forEach((socket) => socket.close())');

  const lobbySockets = (): Promise<number> => lobby.evaluate<number>('window.__sockets.length');
  const before = await lobbySockets();
  await expect.poll(lobbySockets, { timeout: 10_000 }).toBeGreaterThan(before + 1); // keeps trying
  await expect(lobby.getByRole('button', { name: 'Играть как гость' })).toHaveCount(0);
  await expect(lobby.getByTestId('quick-play')).toBeVisible();

  // The server answers again: no session, so the tab shows the login.
  await lobby.unroute('**/auth/me');
  await expect(lobby.getByRole('button', { name: 'Играть как гость' })).toBeVisible({ timeout: 15_000 });
});
