// SPDX-License-Identifier: GPL-3.0-or-later
// Game error codes (docs/api.md, WebSocket /ws: game) as user-facing text.

import type { TFunction } from 'i18next';

import { lobbyErrorText } from '../lobby/errors';
import { LobbyError } from '../lobby/useLobby';

const GAME_CODES = new Set([
  'game_not_found',
  'game_over',
  'version_conflict',
  'not_your_turn',
  'illegal_move',
  'draw_already_offered',
  'no_draw_offer',
]);

export function gameErrorText(error: unknown, t: TFunction): string {
  if (error instanceof LobbyError && GAME_CODES.has(error.code)) return t(`gameError.${error.code}`);
  return lobbyErrorText(error, t);
}
