// FinalizedTrace: the labeled facts of one turn (docs/PLAN.md §3.5). A pure fold over the TraceLog.
// Every displayable leaf is Sourced; plain fields are identifiers and layout (byte spans, indices).

import type { AppError } from '@/shared/errors';
import type { Sourced } from '@/shared/provenance';
import type { ClientMs, ServerMs } from '@/shared/units';

export type Outcome = 'completed' | 'incomplete' | 'stopped' | 'interrupted' | 'failed' | 'rejected';

/** The fixed list of ways a reply can end (docs/PLAN.md §2, Ch6). */
export type StopReason =
  | 'end_marker'
  | 'output_limit'
  | 'content_filter'
  | 'other_incomplete'
  | 'stopped_by_user'
  | 'connection_lost'
  | 'error'
  | 'rejected';

export type InterruptionCause = 'transport' | 'idle' | 'reload' | 'protocol';

export interface Alternative {
  readonly text: Sourced<string, 'recorded'>;
  readonly logprob: Sourced<number, 'recorded'>;
  readonly pct: Sourced<number, 'calculated'>;
  readonly isChosen: boolean;
}

export interface TokenSpanFacts {
  readonly start: number;
  readonly end: number;
  readonly placement: 'exact' | 'eliminated' | 'delta';
  readonly partialStart: boolean;
  readonly partialEnd: boolean;
}

export interface OutputToken {
  /** Index among the tokens OpenAI returned. */
  readonly index: number;
  readonly deltaIndex: number;
  readonly text: Sourced<string, 'recorded'>;
  readonly span: TokenSpanFacts;
  readonly logprob: Sourced<number, 'recorded'>;
  readonly pct: Sourced<number, 'calculated'>;
  /** The alternatives OpenAI listed for this position, highest first. Up to 20, sometimes fewer. */
  readonly alternatives: readonly Alternative[];
  /** 1-based rank of the chosen token among the alternatives; null when it wasn't listed. */
  readonly chosenRank: Sourced<number | null, 'calculated'>;
  readonly remainderPct: Sourced<number, 'calculated'>;
  readonly tokenId: Sourced<number, 'calculated'> | null;
  readonly closeCall: Sourced<boolean, 'calculated'>;
  readonly arrival: { readonly server: Sourced<ServerMs, 'recorded'>; readonly browser: Sourced<ClientMs, 'recorded'> };
  /** Milliseconds from sending the request to this token's arrival, in the browser (includes the network). */
  readonly arrivalAfterSend: Sourced<number, 'calculated'> | null;
}

export interface OutputGap {
  readonly deltaIndex: number;
  readonly text: Sourced<string, 'recorded'>;
  readonly span: { readonly start: number; readonly end: number };
  /** This app's own count of tokens in the gap: an estimate, never OpenAI's tokens. */
  readonly estimatedTokens: Sourced<number, 'calculated'> | null;
  readonly arrival: { readonly server: Sourced<ServerMs, 'recorded'>; readonly browser: Sourced<ClientMs, 'recorded'> };
}

export type OutputSegment =
  | { readonly kind: 'token'; readonly token: OutputToken }
  | { readonly kind: 'gap'; readonly gap: OutputGap };

/**
 * Where the reply's tokens come from. Never mixed: either OpenAI's tokens (with labeled gaps where it
 * returned none) or this app's tokenization of the whole reply.
 */
export type TokenSource = 'provider' | 'provider_with_gaps' | 'local' | 'none';

export interface OutputFacts {
  /** The streamed pieces joined in order. */
  readonly text: Sourced<string, 'calculated'>;
  /** The final text OpenAI reported. */
  readonly finalText: Sourced<string, 'recorded'> | null;
  readonly refusal: Sourced<string, 'calculated'> | null;
  readonly source: TokenSource;
  readonly segments: readonly OutputSegment[];
  readonly tokens: readonly OutputToken[];
  readonly providerTokenCount: Sourced<number, 'calculated'>;
  readonly gapTokenEstimate: Sourced<number, 'calculated'> | null;
  /** This app's tokenization of the whole reply. */
  readonly localTokens: { readonly ids: Sourced<readonly number[], 'calculated'>; readonly byteLengths: readonly number[] } | null;
  readonly deltaCount: Sourced<number, 'calculated'>;
  /** How many tokens each streamed piece carried, measured at the server. */
  readonly tokensPerDelta: Sourced<Readonly<Record<number, number>>, 'calculated'>;
  /** How many events each network read in the browser carried. */
  readonly eventsPerRead: Sourced<Readonly<Record<number, number>>, 'calculated'>;
  readonly chosenNotListed: Sourced<number, 'calculated'>;
}

export interface InputRunFacts {
  /** "instructions" or a message ID. */
  readonly key: string;
  readonly role: 'instructions' | 'user' | 'assistant';
  readonly text: Sourced<string, 'recorded'>;
  readonly ids: Sourced<readonly number[], 'calculated'>;
  readonly byteLengths: readonly number[];
  readonly count: Sourced<number, 'calculated'>;
}

export interface RequestFacts {
  readonly requestId: string;
  readonly assistantMessageId: string;
  readonly instructions: Sourced<string, 'recorded'>;
  readonly settings: {
    readonly model: Sourced<string, 'recorded'>;
    readonly temperature: Sourced<number | null, 'recorded'>;
    readonly topP: Sourced<number | null, 'recorded'>;
    readonly topLogprobs: Sourced<number | null, 'recorded'>;
    readonly maxOutputTokens: Sourced<number, 'recorded'>;
    readonly reasoningEffort: Sourced<string | null, 'recorded'>;
    readonly storedByProvider: Sourced<boolean, 'recorded'>;
    readonly truncation: Sourced<string, 'recorded'>;
    readonly toolsOffered: Sourced<number, 'recorded'>;
  };
  readonly upstreamBody: Sourced<Readonly<Record<string, unknown>>, 'recorded'>;
  readonly upstreamEndpoint: string;
  readonly context: {
    readonly inputBudgetTokens: Sourced<number, 'recorded'>;
    readonly included: Sourced<readonly string[], 'recorded'>;
    readonly dropped: Sourced<readonly { readonly id: string; readonly reason: string }[], 'recorded'>;
    readonly estimatedInputTokens: Sourced<number, 'calculated'>;
  };
  readonly inputRuns: readonly InputRunFacts[];
  readonly moderation: {
    readonly model: Sourced<string, 'recorded'>;
    readonly checkedIds: Sourced<readonly string[], 'recorded'>;
    readonly flagged: Sourced<boolean, 'recorded'>;
  };
  readonly limits: {
    readonly inputBudgetTokens: Sourced<number, 'recorded'>;
    readonly maxOutputTokens: Sourced<number, 'recorded'>;
    readonly maxTurns: Sourced<number, 'recorded'>;
    readonly maxMessageChars: Sourced<number, 'recorded'>;
  };
  readonly reference: {
    readonly contextWindowTokens: Sourced<number, 'reference'>;
    readonly maxOutputTokens: Sourced<number, 'reference'>;
    readonly inputPricePerMTokUsd: Sourced<number, 'reference'>;
    readonly cachedInputPricePerMTokUsd: Sourced<number, 'reference'>;
    readonly cacheWritePricePerMTokUsd: Sourced<number, 'reference'>;
    readonly outputPricePerMTokUsd: Sourced<number, 'reference'>;
    readonly hiddenOutputTokensPerReply: Sourced<number, 'reference'>;
    readonly logprobsAreRawScores: Sourced<boolean, 'reference'>;
    readonly inputOverhead: Sourced<{ readonly perRequest: number; readonly perMessage: number }, 'reference'>;
    readonly tokenizer: Sourced<string, 'reference'>;
    readonly tokenizerVocabulary: Sourced<number, 'reference'> | null;
    readonly knowledgeCutoff: Sourced<string, 'reference'> | null;
    readonly apiDataUsedForTraining: Sourced<boolean, 'reference'> | null;
  };
}

export interface UsageFacts {
  readonly inputTokens: Sourced<number, 'recorded'>;
  readonly cachedInputTokens: Sourced<number, 'recorded'>;
  readonly cacheWriteTokens: Sourced<number, 'recorded'> | null;
  readonly outputTokens: Sourced<number, 'recorded'>;
  readonly reasoningTokens: Sourced<number, 'recorded'>;
  readonly totalTokens: Sourced<number, 'recorded'>;
}

type Moment<T> = Sourced<T, 'recorded'> | null;
type Span = Sourced<number, 'calculated'> | null;

export interface TimingFacts {
  readonly browser: {
    readonly requestSent: Moment<ClientMs>;
    readonly responseHeaders: Moment<ClientMs>;
    readonly start: Moment<ClientMs>;
    readonly firstText: Moment<ClientMs>;
    readonly lastEvent: Moment<ClientMs>;
  };
  readonly server: {
    readonly start: Moment<ServerMs>;
    readonly upstreamOpen: Moment<ServerMs>;
    readonly responseCreated: Moment<ServerMs>;
    readonly firstText: Moment<ServerMs>;
    readonly end: Moment<ServerMs>;
  };
  /** Durations in milliseconds, each between two timestamps from the same clock. */
  readonly durations: {
    readonly browserToFirstText: Span;
    readonly browserTotal: Span;
    readonly serverModeration: Span;
    readonly serverToUpstreamOpen: Span;
    readonly serverCreatedToFirstText: Span;
    readonly serverFirstToLastText: Span;
  };
  /** Tokens per second as this app received them in the browser (includes the network). */
  readonly deliveryRate: Span;
}

export type ReconciliationStatus = 'match' | 'explained' | 'mismatch';

export interface ReconciliationLine {
  readonly id: 'text_vs_final' | 'relay_hash' | 'output_tokens' | 'input_tokens';
  readonly label: string;
  readonly ours: Sourced<number | string>;
  readonly theirs: Sourced<number | string>;
  readonly difference: Sourced<number, 'calculated'> | null;
  readonly status: ReconciliationStatus;
  /** Plain-language explanation, always shown with both numbers (never a silent correction). */
  readonly note: string;
}

export interface CloseCallFacts {
  /** Token indices meeting the displayed rule, in order. */
  readonly all: readonly number[];
  /** Up to two spaced-out moments for the walkthrough to feature. */
  readonly featured: readonly number[];
}

export type AnomalyCode =
  | 'text_mismatch'
  | 'relay_hash_mismatch'
  | 'unplaced_tokens'
  | 'final_bytes_count_mismatch'
  | 'out_of_order_events'
  | 'unknown_events_skipped'
  | 'provider_token_ids_mismatch';

export interface FinalizedTrace {
  readonly turnId: string;
  readonly userMessageId: string;
  readonly outcome: Sourced<Outcome>;
  readonly stopReason: Sourced<StopReason>;
  readonly interruption: InterruptionCause | null;
  readonly incompleteReason: Sourced<string, 'recorded'> | null;
  readonly error: AppError | null;
  readonly request: RequestFacts | null;
  readonly model: Sourced<string, 'recorded'> | null;
  readonly output: OutputFacts;
  readonly usage: UsageFacts | null;
  readonly timing: TimingFacts;
  /** True when OpenAI reported zero reasoning tokens, so the token-by-token story can be told (A4). */
  readonly reasoningGate: Sourced<boolean, 'calculated'> | null;
  readonly reconciliation: readonly ReconciliationLine[];
  readonly closeCalls: Sourced<CloseCallFacts, 'calculated'>;
  readonly cost: { readonly usd: Sourced<number, 'calculated'>; readonly basis: 'usage' | 'estimate' } | null;
  readonly ledger: Sourced<{ readonly basis: string; readonly microUsd: number }, 'recorded'> | null;
  readonly toolCallsReturned: Sourced<number, 'calculated'>;
  readonly anomalies: readonly AnomalyCode[];
  /** For the conversation: the reply may be re-sent next turn only with a valid signature. */
  readonly assistant: { readonly messageId: string | null; readonly sig: string | null };
}
