// SPDX-License-Identifier: GPL-3.0-or-later
// One-time tokens from e-mail links stand after "#", so they never reach server logs
// or the Referer header (ADR 0008, item 8).

export function tokenFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || null;
}

/** Drop the token from the address bar and the history entry. */
export function forgetHash(): void {
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(window.history.state, '', url);
}
