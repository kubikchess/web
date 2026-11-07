// SPDX-License-Identifier: GPL-3.0-or-later
// History of a registered player (docs/api.md, "HTTP API: история партий").

import type { ColorName } from './api';
import { ApiError, request } from './http';
import type { Mode } from './lobby/protocol';

export interface HistoryEntry {
  game_id: string;
  color: ColorName;
  opponent: { kind: 'user' | 'guest' | 'bot' | 'deleted'; display_name: string }; // deleted: ACC-14
  mode: Mode;
  increment: number | null;
  outcome: 'win' | 'loss' | 'draw';
  reason: string;
  started_at: string;
  finished_at: string;
}

export interface HistoryPage {
  games: HistoryEntry[];
  next: string | null;
}

export function historyPath(before?: string): string {
  return before === undefined ? '/games' : `/games?${new URLSearchParams({ before }).toString()}`;
}

export async function fetchHistory(before?: string): Promise<HistoryPage> {
  const page = await request<HistoryPage>('GET', historyPath(before));
  if (page === null) throw new ApiError(502);
  return page;
}
