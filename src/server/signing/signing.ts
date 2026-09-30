// HMAC signatures for assistant replies (docs/PLAN.md §3.6). The server is stateless, so the browser
// sends the history back each turn; a signature proves a reply is exactly what this server relayed, in
// this conversation, after that user message. Also derives the hashed IDs used for limits and OpenAI's
// safety_identifier, so raw session IDs and IPs are never stored or sent.

import 'server-only';

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface SigningKeys {
  /** Signs new replies and derives hashed IDs. */
  readonly current: string;
  /** Still accepted when verifying, so a rotation doesn't break open conversations. */
  readonly previous: string | null;
}

export interface ReplyFields {
  readonly conversationId: string;
  readonly messageId: string;
  readonly previousUserText: string;
  readonly text: string;
}

const b64url = (buf: Buffer) => buf.toString('base64url');
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const kidOf = (secret: string) => b64url(createHash('sha256').update(`kid:${secret}`).digest()).slice(0, 8);

const mac = (secret: string, fields: ReplyFields, issuedAt: number) =>
  b64url(
    createHmac('sha256', secret)
      .update(
        // JSON keeps field boundaries unambiguous.
        JSON.stringify(['reply-v1', fields.conversationId, fields.messageId, sha256(fields.previousUserText), sha256(fields.text), issuedAt]),
      )
      .digest(),
  );

/** `v1.<kid>.<issuedAtSec>.<mac>` */
export function signReply(keys: SigningKeys, fields: ReplyFields, issuedAtSec: number): string {
  return `v1.${kidOf(keys.current)}.${issuedAtSec}.${mac(keys.current, fields, issuedAtSec)}`;
}

export type VerifyResult = 'valid' | 'expired' | 'invalid';

export function verifyReply(
  keys: SigningKeys,
  sig: string,
  fields: ReplyFields,
  nowSec: number,
  maxAgeSec: number,
): VerifyResult {
  const parts = sig.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return 'invalid';
  const [, kid, iatText, given] = parts;
  const issuedAt = Number(iatText);
  if (!Number.isSafeInteger(issuedAt) || !given) return 'invalid';
  const secret = [keys.current, keys.previous].find((s): s is string => s !== null && kidOf(s) === kid);
  if (!secret) return 'invalid';
  const expected = Buffer.from(mac(secret, fields, issuedAt));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return 'invalid';
  if (issuedAt > nowSec + 60) return 'invalid';
  return nowSec - issuedAt > maxAgeSec ? 'expired' : 'valid';
}

const derive = (keys: SigningKeys, purpose: string, value: string) =>
  b64url(createHmac('sha256', keys.current).update(`${purpose}:${value}`).digest());

/** OpenAI's safety_identifier: a stable hash of the anonymous session, at most 64 characters. */
export const safetyIdentifier = (keys: SigningKeys, sessionId: string) => `tbt_${derive(keys, 'safety', sessionId)}`;

/** Keys for the limits store. Raw IPs and session IDs never reach Redis. */
export const hashedKey = (keys: SigningKeys, purpose: 'ip' | 'session', value: string) =>
  derive(keys, `limits-${purpose}`, value).slice(0, 22);
