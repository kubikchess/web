// SPDX-License-Identifier: GPL-3.0-or-later
import type { Participant } from '../authApi';

/**
 * After a lobby connection failed to open: is the session still there? The server refuses /ws
 * without a session at the handshake, and the browser reports that as a plain drop. Only an answer
 * from /auth/me ends the session; when the server cannot be asked (restart, network), keep it.
 */
export async function sessionStillValid(
  me: () => Promise<Participant | null>,
  participantId: string,
): Promise<boolean> {
  try {
    return (await me())?.id === participantId;
  } catch {
    return true;
  }
}
