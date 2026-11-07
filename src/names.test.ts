// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import i18n from './i18n';
import { opponentName } from './names';

const t = i18n.t.bind(i18n);

describe('opponentName', () => {
  it('names the bot from the interface strings, not the server name (ADR 0011)', () => {
    expect(opponentName({ kind: 'bot', display_name: 'Computer' }, t)).toBe('Компьютер');
  });

  it('keeps the name of a player', () => {
    expect(opponentName({ kind: 'user', display_name: 'Alice' }, t)).toBe('Alice');
  });

  it('marks a guest in the history only', () => {
    const guest = { kind: 'guest', display_name: 'Guest-0001' } as const;
    expect(opponentName(guest, t)).toBe('Guest-0001');
    expect(opponentName(guest, t, { markGuest: true })).toBe('Guest-0001 (гость)');
  });

  it('names a deleted account from the interface strings (ACC-14)', () => {
    expect(opponentName({ kind: 'deleted', display_name: '' }, t)).toBe('Удалённый игрок');
    expect(opponentName({ kind: 'deleted', display_name: '' }, t, { markGuest: true })).toBe(
      'Удалённый игрок',
    );
  });
});
