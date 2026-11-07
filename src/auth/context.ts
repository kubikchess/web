// SPDX-License-Identifier: GPL-3.0-or-later
import { createContext, useContext } from 'react';

import type { Participant } from '../authApi';

export interface AuthState {
  /** Null until /auth/me answers, then the participant or null for an anonymous visitor. */
  participant: Participant | null;
  loading: boolean;
  setParticipant: (participant: Participant | null) => void;
  refresh: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth is used outside AuthProvider');
  return auth;
}
