// SPDX-License-Identifier: GPL-3.0-or-later
import type { PieceName } from './api';

export interface DieSlot {
  piece: PieceName;
  used: boolean;
}

/** Rolled dice in roll order; a die is used when its type is no longer among the remaining. */
export function diceSlots(faces: readonly PieceName[], remaining: readonly PieceName[]): DieSlot[] {
  const left = new Map<PieceName, number>();
  for (const piece of remaining) left.set(piece, (left.get(piece) ?? 0) + 1);
  return faces.map((piece) => {
    const count = left.get(piece) ?? 0;
    if (count > 0) left.set(piece, count - 1);
    return { piece, used: count === 0 };
  });
}
