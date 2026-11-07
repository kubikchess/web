// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { tokenFromHash } from './token';

describe('tokenFromHash', () => {
  it('reads the token after #', () => {
    expect(tokenFromHash('#token=abc-DEF_123')).toBe('abc-DEF_123');
  });

  it('ignores other parameters', () => {
    expect(tokenFromHash('#x=1&token=t0k')).toBe('t0k');
  });

  it.each(['', '#', '#token=', '#other=1'])('gives null for %j', (hash) => {
    expect(tokenFromHash(hash)).toBeNull();
  });
});
