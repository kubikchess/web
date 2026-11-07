// SPDX-License-Identifier: GPL-3.0-or-later
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { authApi, type Participant } from '../authApi';
import { AuthContext } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Also hands out the CSRF cookie that every changing request needs.
    setParticipant(await authApi.me().catch(() => null));
  }, []);

  useEffect(() => {
    let current = true;
    authApi
      .me()
      .catch(() => null)
      .then((found) => {
        if (!current) return;
        setParticipant(found);
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const value = useMemo(
    () => ({ participant, loading, setParticipant, refresh }),
    [participant, loading, refresh],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
