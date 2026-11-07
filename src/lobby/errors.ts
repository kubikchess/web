// SPDX-License-Identifier: GPL-3.0-or-later
// Lobby error codes (docs/api.md, WebSocket /ws) as user-facing text.

import type { TFunction } from 'i18next';

import { LobbyError } from './useLobby';

export function lobbyErrorText(error: unknown, t: TFunction): string {
  if (!(error instanceof LobbyError)) return t('lobbyError.generic');
  switch (error.code) {
    case 'forbidden':
      return t(`lobbyError.forbidden.${error.reason === 'email_not_verified' ? 'email_not_verified' : 'guest'}`);
    case 'busy':
      return t(`lobbyError.busy.${error.status ?? 'idle'}`, { defaultValue: t('lobbyError.busy.other') });
    case 'rate_limited':
      return t('lobbyError.rate_limited', { count: Math.max(1, error.retryAfter ?? 1) });
    case 'offer_unavailable':
    case 'invalid_time_control':
    case 'disconnected':
      return t(`lobbyError.${error.code}`);
    default:
      return t('lobbyError.generic');
  }
}
