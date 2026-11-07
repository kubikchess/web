// SPDX-License-Identifier: GPL-3.0-or-later
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { errorMessage } from '../errors';

/** Runs a server call for a form: busy flag and a user-facing error text. */
export function useAction() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        await action();
        return true;
      } catch (caught) {
        setError(errorMessage(caught, t));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  return { busy, error, run };
}
