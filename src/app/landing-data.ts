// Real data for the landing page's graphics, taken from the recorded sample conversation at build time
// (fixtures/sample/conversation.json). Nothing here is invented: every token and percentage is the sample's
// own, and the page shows each with its label (CLAUDE.md L3: invented values are never shown as numbers).

import sample from '../../fixtures/sample/conversation.json';

import { read } from '@/shared/provenance/read';
import { inputPieces, type TokenPiece } from '@/stages/common';
import type { FinalizedTrace, InputRunFacts, OutputToken } from '@/trace/facts';
import { finalizeTrace } from '@/trace/finalize';
import { traceLogSchema } from '@/trace/log';

const traces: FinalizedTrace[] = sample.conversation.turns.flatMap((t) => {
  const parsed = traceLogSchema.safeParse(t.log);
  return parsed.success ? [finalizeTrace(parsed.data)] : [];
});

const pctOf = (a: { pct: Parameters<typeof read>[0] }) => read(a.pct) as number;
const wordy = (t: OutputToken) => /^ ?[A-Za-z]+$/.test(read(t.text));

/** A spread-out position: several real options with a real share each, and no clear favorite. */
function spread(t: OutputToken): boolean {
  return wordy(t) && t.alternatives.filter((a) => pctOf(a) >= 2).length >= 3 && pctOf(t.alternatives[0] ?? t) < 80;
}

export interface Moment {
  readonly token: OutputToken;
  /** The tokens just before it, oldest first (real reply tokens). */
  readonly before: readonly OutputToken[];
}

function momentAt(trace: FinalizedTrace | undefined, test: (t: OutputToken) => boolean, context = 5): Moment | null {
  const tokens = trace?.output.tokens ?? [];
  const at = tokens.findIndex(test);
  const token = tokens[at];
  return token ? { token, before: tokens.slice(Math.max(0, at - context), at) } : null;
}

const [first, second] = traces;

/** The hero graphic: the first spread-out position in the first reply, with the reply so far (it's early). */
export const heroMoment = momentAt(first, spread, 8);

/** The "weighted pick" card: a position where the pick wasn't the top option. */
export const pickMoment = momentAt(second, (t) => spread(t) && !(t.alternatives[0]?.isChosen ?? true)) ?? momentAt(first, spread);

/** The "tokens" card: the sample's first question, split into tokens. */
const firstQuestion = first?.request?.inputRuns.find((r) => r.role === 'user');
export const questionPieces: readonly TokenPiece[] = firstQuestion ? inputPieces(firstQuestion) : [];

/** The "context" card: everything the second request carried. */
export const contextRuns: readonly InputRunFacts[] = second?.request?.inputRuns ?? [];

/** When and with which model the sample was recorded (both Recorded). */
export const recordedAt = first?.timing.browser.requestSent ?? null;
export const recordedModel = first?.model ?? null;
