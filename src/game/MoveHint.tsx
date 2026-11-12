// SPDX-License-Identifier: GPL-3.0-or-later
import { useTranslation } from 'react-i18next';

import { type Hint, hintText } from './hints';

/** The hint line under the board (GS-12, GS-13); the live region stays for screen readers. */
export function MoveHint({ hint }: { hint: Hint | null }) {
  const { t } = useTranslation();
  return (
    <div aria-live="polite">
      {hint && (
        <p className="move-hint" data-testid="move-hint" data-rule={hint.rule}>
          {hintText(hint, t)}
        </p>
      )}
    </div>
  );
}
