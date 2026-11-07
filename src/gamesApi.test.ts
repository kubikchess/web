// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, expect, it } from 'vitest';

import { historyPath } from './gamesApi';

describe('history request', () => {
  it('asks for the first page without a cursor', () => {
    expect(historyPath()).toBe('/games');
  });

  it('passes the cursor of the next page as is', () => {
    expect(historyPath('1730721600000.0b1c&x')).toBe('/games?before=1730721600000.0b1c%26x');
  });
});
