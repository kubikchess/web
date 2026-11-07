// SPDX-License-Identifier: GPL-3.0-or-later
// Server moves (UCI) to chessground shapes. No rules here: the server decides (ADR 0006).
import type { Dests, Key } from 'chessground/types';

export type Promotion = 'q' | 'r' | 'b' | 'n';

const squareOf = (uci: string, start: number) => uci.slice(start, start + 2) as Key;

export function toDests(allowed: readonly string[]): Dests {
  const dests: Dests = new Map();
  for (const uci of allowed) {
    const from = squareOf(uci, 0);
    const to = squareOf(uci, 2);
    const targets = dests.get(from) ?? [];
    if (!targets.includes(to)) targets.push(to);
    dests.set(from, targets);
  }
  return dests;
}

export function promotionChoices(allowed: readonly string[], from: Key, to: Key): Promotion[] {
  const path = `${from}${to}`;
  return allowed
    .filter((uci) => uci.length === 5 && uci.startsWith(path))
    .map((uci) => uci[4] as Promotion);
}

export function toUci(from: Key, to: Key, promotion?: Promotion): string {
  return `${from}${to}${promotion ?? ''}`;
}

export function boardFen(fen: string): string {
  return fen.split(' ')[0] ?? fen;
}

export function lastMoveKeys(uci: string | null): [Key, Key] | undefined {
  return uci ? [squareOf(uci, 0), squareOf(uci, 2)] : undefined;
}
