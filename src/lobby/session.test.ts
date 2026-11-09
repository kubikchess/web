// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import type { Participant } from '../authApi';
import { sessionStillValid } from './session';

const me = (participant: Participant | null) => () => Promise.resolve(participant);
const guest: Participant = { kind: 'guest', id: 'g-1', display_name: 'Guest-0001', role: null, email_verified: false };

describe('session check after a lobby connection failed', () => {
  it('keeps the session when the server still knows the participant', async () => {
    await expect(sessionStillValid(me(guest), 'g-1')).resolves.toBe(true);
  });

  it('ends it when the server answers without a participant', async () => {
    await expect(sessionStillValid(me(null), 'g-1')).resolves.toBe(false);
  });

  it('ends it when the browser now holds another participant', async () => {
    await expect(sessionStillValid(me({ ...guest, id: 'g-2' }), 'g-1')).resolves.toBe(false);
  });

  it('keeps the session when the server cannot be asked (restart, network)', async () => {
    await expect(sessionStillValid(() => Promise.reject(new Error('offline')), 'g-1')).resolves.toBe(true);
  });
});
