// Facts for the live strip (docs/PLAN.md §1, step 3), from the log so far: only recorded events, in
// order — request sent, the wait, first text, tokens arriving. Cheap enough to recompute each time the
// conversation store publishes (at most once per frame): it doesn't align or reconcile; finalizeTrace does
// that once the reply ends.

import { derive, deriveAll, type Sourced } from '@/shared/provenance';
import { recordedWith } from '@/shared/provenance/mint';
import type { ClientMs } from '@/shared/units';

import type { TraceLogV1 } from './log';
import { PROV } from './provs';

export interface LiveToken {
  /** The token string as OpenAI streamed it. */
  readonly text: Sourced<string, 'recorded'>;
  /** Which streamed piece carried it (0-based). */
  readonly piece: number;
}

export interface LiveFacts {
  readonly requestSent: Sourced<ClientMs, 'recorded'> | null;
  readonly firstText: Sourced<ClientMs, 'recorded'> | null;
  /** Time from sending to the first text, by this browser's clock (includes the network). */
  readonly waited: Sourced<number, 'calculated'> | null;
  readonly tokens: readonly LiveToken[];
  /** Tokens received so far. */
  readonly tokenCount: Sourced<number, 'calculated'>;
  /** Streamed pieces of text received so far. */
  readonly pieceCount: Sourced<number, 'calculated'>;
  /** The most tokens any one piece carried (OpenAI reports each piece's tokens). */
  readonly mostTokensInOnePiece: Sourced<number, 'recorded'> | null;
  /** Text arrived that OpenAI returned no tokens for (some emoji); it is shown as text, never as tokens. */
  readonly textWithoutTokens: boolean;
}

const SENT = PROV.browserTime('request sent');
const FIRST_TEXT = PROV.browserTime('first text received');
const NOW = PROV.browserTime('now, by this page’s clock');
const TOKENS = PROV.token;
const COUNTED = PROV.browserTime('streamed piece received');

export function liveFacts(log: TraceLogV1): LiveFacts {
  let requestSent: Sourced<ClientMs, 'recorded'> | null = null;
  let firstText: Sourced<ClientMs, 'recorded'> | null = null;
  const tokens: LiveToken[] = [];
  const pieceTimes: Sourced<ClientMs, 'recorded'>[] = [];
  let most = 0;
  let textWithoutTokens = false;
  for (const e of log.entries) {
    if (e.k === 'request_sent') requestSent ??= recordedWith(SENT, e.tc);
    if (e.k !== 'server' || e.ev.type !== 'delta' || e.ev.channel !== 'text') continue;
    const piece = pieceTimes.length;
    pieceTimes.push(recordedWith(COUNTED, e.tc));
    if (e.ev.text.length > 0) firstText ??= recordedWith(FIRST_TEXT, e.tc);
    const lps = e.ev.logprobs ?? [];
    if (lps.length === 0 && e.ev.text.length > 0) textWithoutTokens = true;
    most = Math.max(most, lps.length);
    for (const lp of lps) tokens.push({ text: recordedWith(TOKENS, lp.token), piece });
  }
  return {
    requestSent,
    firstText,
    waited: requestSent && firstText ? derive('duration', [requestSent, firstText], (a, b) => b - a) : null,
    tokens,
    tokenCount: deriveAll('count', tokens.map((t) => t.text), (xs) => xs.length),
    pieceCount: deriveAll('count', pieceTimes, (xs) => xs.length),
    mostTokensInOnePiece: pieceTimes.length > 0 ? recordedWith(PROV.tokensInDelta, most) : null,
    textWithoutTokens,
  };
}

/** The waiting timer: time since the request was sent, by this browser's clock. */
export function elapsedSince(sent: Sourced<ClientMs, 'recorded'>, now: ClientMs): Sourced<number, 'calculated'> {
  return derive('duration', [sent, recordedWith(NOW, now)], (a, b) => Math.max(0, b - a));
}
