// SPDX-License-Identifier: GPL-3.0-or-later
// How the interface names an opponent: the bot and a deleted account by interface strings
// (NFR-14, ADR 0011, ACC-14).

import type { TFunction } from 'i18next';

export interface Named {
  kind: 'user' | 'guest' | 'bot' | 'deleted';
  display_name: string;
}

export function opponentName(member: Named, t: TFunction, { markGuest = false } = {}): string {
  if (member.kind === 'bot') return t('names.computer');
  if (member.kind === 'deleted') return t('names.deletedPlayer');
  if (markGuest && member.kind === 'guest') return t('history.guestOpponent', { name: member.display_name });
  return member.display_name;
}
