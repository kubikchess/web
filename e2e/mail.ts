// SPDX-License-Identifier: GPL-3.0-or-later
// Letters of the file mailer the E2E API writes (DICECHESS_MAIL_DIR, ACC-07).
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const MAIL_DIR = fileURLToPath(new URL('../../artifacts/e2e-mail', import.meta.url));

export type LetterKind = 'verify_email' | 'reset_password' | 'account_exists';

const POLL_MS = 100;
const TIMEOUT_MS = 10_000;

interface Letter {
  to: string;
  body: string;
}

function parse(raw: string): Letter {
  const [head = '', ...rest] = raw.split(/\r?\n\r?\n/);
  const header = (name: string) =>
    head.match(new RegExp(`^${name}: (.*)$`, 'mi'))?.[1]?.trim() ?? '';
  const content = rest.join('\n\n');
  const body = /base64/i.test(header('Content-Transfer-Encoding'))
    ? Buffer.from(content.replace(/\s+/g, ''), 'base64').toString('utf8')
    : content;
  return { to: header('To'), body };
}

/** Link from the newest letter of a kind sent to `to`; waits until it arrives. */
export async function linkFromLetter(to: string, kind: LetterKind): Promise<string> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const names = await readdir(MAIL_DIR).catch(() => [] as string[]);
    // Names start with a UTC timestamp: newest last.
    for (const name of names.filter((n) => n.includes(`-${kind}-`) && n.endsWith('.eml')).sort().reverse()) {
      const letter = parse(await readFile(`${MAIL_DIR}/${name}`, 'utf8'));
      if (letter.to !== to) continue;
      const link = letter.body.match(/https?:\/\/\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`No ${kind} letter to ${to} in ${MAIL_DIR}`);
}
