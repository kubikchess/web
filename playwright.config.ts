// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { release } from 'node:os';

import { defineConfig, devices } from '@playwright/test';

import { MAIL_DIR } from './e2e/mail';

// Separate ports so that E2E does not collide with a running dev server.
const API_PORT = 8001;
const WEB_PORT = 5174;

// WebKit: on macOS 14 (Darwin 23) Playwright pins an old WebKit build that cannot open pages.
// There the webkit and iphone projects use WebKit of the official Linux image of the same
// Playwright version; the browser reaches the local servers through the test runner
// (exposeNetwork). PW_WEBKIT_DOCKER=1 or 0 overrides the choice.
const WEBKIT_PORT = 3000;
const PLAYWRIGHT_VERSION = (
  JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf-8')) as {
    devDependencies: Record<string, string>;
  }
).devDependencies['@playwright/test'];
const webkitInDocker = process.env.PW_WEBKIT_DOCKER
  ? process.env.PW_WEBKIT_DOCKER === '1'
  : process.platform === 'darwin' && release().split('.')[0] === '23';
const webkitRemote = webkitInDocker
  ? { connectOptions: { wsEndpoint: `ws://127.0.0.1:${WEBKIT_PORT}/`, exposeNetwork: '<loopback>' } }
  : {};
const webkitServer = webkitInDocker
  ? [
      {
        command:
          `docker run --rm --init --name dicechess-pw-webkit -p 127.0.0.1:${WEBKIT_PORT}:${WEBKIT_PORT} ` +
          `--user pwuser --workdir /home/pwuser mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble ` +
          `/bin/sh -c "npx -y playwright@${PLAYWRIGHT_VERSION} run-server --port ${WEBKIT_PORT} --host 0.0.0.0"`,
        // Not `port`: Docker opens the port before the server inside listens; HTTP answers 200 once it does.
        url: `http://127.0.0.1:${WEBKIT_PORT}/`,
        reuseExistingServer: true,
        timeout: 180_000, // npx fetches the playwright package inside the container
        // SIGTERM reaches the container through `docker run`, so --rm removes it after the run.
        gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 10_000 },
      },
    ]
  : [];

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
  },
  // NFR-15: the full set in Chromium (Edge is Chromium too), the @smoke set in Firefox and WebKit,
  // @phone tests on phones. Firefox and WebKit run after Chromium, one by one: a quick play test
  // in two browsers at once would match players across browsers in one queue.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@phone/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, grep: /@smoke/, dependencies: ['chromium'] },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], ...webkitRemote },
      grep: /@smoke/,
      dependencies: ['firefox'],
    },
    { name: 'iphone', use: { ...devices['iPhone 14'], ...webkitRemote }, grep: /@phone/ },
    { name: 'android', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: [
    {
      // The development database (unique e-mails per run), its own Valkey db and mail folder.
      command: `uv run alembic upgrade head && uv run uvicorn dicechess.api.main:app --host 127.0.0.1 --port ${API_PORT}`,
      cwd: '..',
      env: {
        DICECHESS_DEV_TOOLS: 'true',
        DICECHESS_COOKIE_SECURE: 'false', // the browser talks plain http
        DICECHESS_PUBLIC_BASE_URL: `http://127.0.0.1:${WEB_PORT}`, // e-mail links and CSRF Origin
        DICECHESS_VALKEY_URL: 'redis://127.0.0.1:6379/14',
        DICECHESS_MAIL_DIR: MAIL_DIR,
        // Letters go to MAIL_DIR even when the developer's .env sets up SMTP: tests read them
        // there, and test addresses must never reach a real mail server.
        DICECHESS_SMTP_HOST: '',
        // Every test registers and logs in from 127.0.0.1.
        DICECHESS_REGISTER_LIMIT_PER_IP: '1000',
        DICECHESS_LOGIN_LIMIT_PER_IP: '1000',
      },
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT}`,
      env: { DICECHESS_API_URL: `http://127.0.0.1:${API_PORT}` },
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
    },
    ...webkitServer,
  ],
});
