# KubikChess web client

The frontend of [kubikchess.ru](https://kubikchess.ru): online dice chess against another player or
the computer.

This repository holds the source of the frontend that runs on the site. Every release is one commit
with a `release-…` tag. It is a mirror of releases: changes are not accepted here.

## License

GPL-3.0-or-later, see [LICENSE](LICENSE). The board component
[chessground](https://github.com/lichess-org/chessground) is GPL-3.0-or-later, so the frontend is too.
The game server is not open source and is not part of this repository.

## How it works

The client knows no game rules. The server rolls the dice, sends the result and the allowed moves,
checks every move and keeps the clocks. The client shows the board and sends the moves one by one.

- Lobby and games: one WebSocket per tab, `/ws`. The client rebuilds its state from versioned
  server messages and reconnects after drops; clocks count down locally between messages.
- HTTP: accounts under `/auth`, game history `GET /games`, legal documents `GET /legal/{document}`.
  Changing requests repeat the CSRF cookie value in the `X-CSRF-Token` header (`src/http.ts`).
- The client checks no field rules: the server answers with error codes, `src/errors.ts` turns them
  into text. Interface strings are in `src/locales/ru.json`.

## Pages

| Path | Page |
|---|---|
| `/` | Log in, register or play as a guest; with a session — the lobby: quick play, own game, list of games, game against the computer (`src/lobby/`); in a game — board, dice, clocks, resignation, draw offers (`src/game/`) |
| `/history` | Finished games of a registered player |
| `/login`, `/register` | Accounts; registration asks to accept the user agreement and the consent to personal data processing |
| `/verify-email`, `/reset-password` | Links from the letters; the token stays after `#` |
| `/resend-verification`, `/forgot-password` | Ask for a letter |
| `/terms`, `/personal-data`, `/privacy` | Legal documents, open without a session |
| `/about` | About the site, this license and the link to this repository |
| `/hot-seat` | Development tool, only in the development build |

## Build

Node.js — the version in [.nvmrc](.nvmrc).

```sh
npm ci
npm run build      # production build in dist/
npm run dev        # Vite dev server on http://127.0.0.1:5173
```

The dev server proxies `/auth`, `/games`, `/legal`, `/health` and `/ws` to the game server at
`DICECHESS_API_URL` (default `http://127.0.0.1:8000`). Without the game server the pages open, but
logging in and playing do not work.

Checks: `npm run typecheck`, `npm run lint`, `npm test` (Vitest). The browser tests in `e2e/`
(Playwright) need the game server.
