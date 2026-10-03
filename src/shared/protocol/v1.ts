// Wire protocol v1 between the browser and /api/chat (ADR 0003). Provider-agnostic: only
// src/server/openai/ knows OpenAI's event names. The schemas are the source of truth for the types.
//
// Unknown event types are ignored by the client, so additive changes are safe. Breaking changes bump v.

import { z } from 'zod';

import { APP_ERROR_CODES } from '../errors';
import { REQUEST_LIMITS } from '../limits';
import type { ServerMs } from '../units';

export const PROTOCOL_VERSION = 1;

// ---------------------------------------------------------------------------------------------------
// Request (browser → server)

const id = z.string().regex(REQUEST_LIMITS.idPattern);

export const userMessageSchema = z.strictObject({
  role: z.literal('user'),
  id,
  content: z.string().min(1).max(REQUEST_LIMITS.maxMessageChars),
});

export const assistantMessageSchema = z.strictObject({
  role: z.literal('assistant'),
  id,
  // Replies are capped by max_output_tokens; this bound only rejects absurd payloads.
  content: z.string().max(REQUEST_LIMITS.maxMessageChars * 4),
  /** The server's HMAC over this reply. Unsigned (stopped or interrupted) replies are never re-sent. */
  sig: z.string().min(1).max(256),
});

export const requestMessageSchema = z.discriminatedUnion('role', [userMessageSchema, assistantMessageSchema]);

export const chatRequestSchema = z
  .strictObject({
    v: z.literal(PROTOCOL_VERSION),
    clientRequestId: id,
    /** Anonymous and tab-scoped. Used for per-session limits and, hashed, as OpenAI's safety_identifier. */
    sessionId: id,
    /** Rotated when the conversation is cleared. Signed replies are bound to it. */
    conversationId: id,
    /** Oldest first. The last message is the new user message. */
    messages: z.array(requestMessageSchema).min(1).max(REQUEST_LIMITS.maxMessages),
    options: z.strictObject({ logprobs: z.boolean() }),
  })
  .refine((r) => r.messages.at(-1)?.role === 'user', { message: 'the last message must be from the user' })
  .refine((r) => new Set(r.messages.map((m) => m.id)).size === r.messages.length, { message: 'message IDs must be unique' });

export type UserMessageV1 = z.infer<typeof userMessageSchema>;
export type AssistantMessageV1 = z.infer<typeof assistantMessageSchema>;
export type RequestMessageV1 = z.infer<typeof requestMessageSchema>;
export type ChatRequestV1 = z.infer<typeof chatRequestSchema>;

// ---------------------------------------------------------------------------------------------------
// Shared pieces

const count = z.number().int().nonnegative();

export const appErrorSchema = z.object({
  code: z.enum(APP_ERROR_CODES),
  retryAfterSec: z.number().int().nonnegative().optional(),
  resetAt: z.string().optional(),
});

const alternativeSchema = z.object({ token: z.string(), logprob: z.number() });

/** One token OpenAI returned, with the top alternatives it listed for that position. */
export const wireLogprobSchema = z.object({
  token: z.string(),
  logprob: z.number(),
  top: z.array(alternativeSchema),
});

/** Tokens from this app's tokenizer: one run per piece of text, with each token's UTF-8 length. */
export const tokenRunSchema = z.object({
  key: z.string(),
  ids: z.array(count),
  byteLengths: z.array(z.number().int().positive()),
});

export const tokenRunsSchema = z.object({
  encoding: z.literal('o200k_base'),
  runs: z.array(tokenRunSchema),
});

export const usageSchema = z.object({
  inputTokens: count,
  cachedInputTokens: count,
  cacheWriteTokens: count.nullable(),
  outputTokens: count,
  /** Null when the provider omitted this detail; absence does not establish zero hidden work. */
  reasoningTokens: count.nullable(),
  totalTokens: count,
});

const docSchema = z.object({ title: z.string(), url: z.string(), retrieved: z.string() });
const measuredSchema = z.object({ what: z.string(), date: z.string() });

/** Documented or previously measured facts from the server's config, echoed so the trace can label them. */
export const referenceValuesSchema = z.object({
  modelId: z.string(),
  contextWindowTokens: z.object({ value: count, doc: docSchema }),
  maxOutputTokens: z.object({ value: count, doc: docSchema }),
  prices: z.object({
    inputPerMTokUsd: z.number(),
    cachedInputPerMTokUsd: z.number(),
    cacheWritePerMTokUsd: z.number(),
    outputPerMTokUsd: z.number(),
    doc: docSchema,
  }),
  hiddenOutputTokensPerReply: z.object({ value: count, measured: measuredSchema }),
  inputOverhead: z.object({
    value: z.object({ perRequest: z.number(), perMessage: z.number() }),
    measured: measuredSchema,
  }),
  logprobsAreRawScores: z.object({ value: z.boolean(), measured: measuredSchema }),
  tokenizer: z.object({
    encoding: z.literal('o200k_base'),
    library: z.string(),
    /** Ordinary (non-special) tokens in the assumed vocabulary. Optional: older logs lack it. */
    vocabularySize: z.object({ value: count, measured: measuredSchema }).optional(),
  }),
  /** Optional: added in Phase 2, so logs recorded earlier still validate. */
  knowledgeCutoff: z.object({ value: z.string(), doc: docSchema }).optional(),
  apiDataUsedForTraining: z.object({ value: z.boolean(), doc: docSchema }).optional(),
});

/** The generation settings this app sent. */
export const settingsSchema = z.object({
  model: z.string(),
  temperature: z.number().nullable(),
  topP: z.number().nullable(),
  topLogprobs: count.nullable(),
  maxOutputTokens: count,
  reasoningEffort: z.string().nullable(),
  storedByProvider: z.boolean(),
  truncation: z.string(),
  toolsOffered: count,
});

/** What this app did to fit the conversation into its budget. */
export const contextReportSchema = z.object({
  inputBudgetTokens: count,
  /** Message IDs sent, oldest first. */
  included: z.array(z.string()),
  /** Earlier messages not sent: over the budget, past the turn limit, or a reply signed too long ago. */
  dropped: z.array(z.object({ id: z.string(), reason: z.enum(['over_budget', 'turn_limit', 'expired_signature']) })),
  /** This app's estimate of the input tokens OpenAI will count. */
  estimatedInputTokens: count,
});

export const moderationReportSchema = z.object({
  model: z.string(),
  /** Messages checked on this request: the new one, plus any not already checked with a signed reply. */
  checkedIds: z.array(z.string()),
  flagged: z.boolean(),
  startedAt: z.number().nonnegative(),
  endedAt: z.number().nonnegative(),
});

export const appLimitsSchema = z.object({
  inputBudgetTokens: count,
  maxOutputTokens: count,
  maxTurns: count,
  maxMessageChars: count,
  /** Output tokens this app assumes were generated but not relayed when a reply is stopped. */
  stopAllowanceTokens: count,
});

// ---------------------------------------------------------------------------------------------------
// Server events (server → browser)

const t = z
  .number()
  .nonnegative()
  .transform((n) => n as ServerMs);

const base = { v: z.literal(PROTOCOL_VERSION), seq: count, t };

export const startEventSchema = z.object({
  ...base,
  type: z.literal('start'),
  requestId: z.string(),
  assistantMessageId: z.string(),
  /** This app's instructions, word for word (public by design). */
  instructions: z.string(),
  settings: settingsSchema,
  /** The exact JSON body sent upstream, for "View the full request". Opaque to the client. */
  upstreamRequest: z.object({ endpoint: z.string(), body: z.record(z.string(), z.unknown()) }),
  context: contextReportSchema,
  /** This app's tokenization of the instructions and each included message. */
  inputTokens: tokenRunsSchema,
  moderation: moderationReportSchema,
  limits: appLimitsSchema,
  reference: referenceValuesSchema,
});

export const upstreamOpenEventSchema = z.object({ ...base, type: z.literal('upstream_open') });

export const responseCreatedEventSchema = z.object({
  ...base,
  type: z.literal('response_created'),
  /** The model snapshot OpenAI reported. */
  model: z.string(),
});

export const deltaEventSchema = z.object({
  ...base,
  type: z.literal('delta'),
  channel: z.enum(['text', 'refusal']),
  text: z.string(),
  /** Tokens OpenAI returned with this piece of text; null when logprobs weren't requested. May be empty. */
  logprobs: z.array(wireLogprobSchema).nullable(),
  upstreamSeq: count,
  /** When text arrived with no tokens, this app's own tokenization of it (an estimate, not OpenAI's). */
  gapTokens: tokenRunSchema.optional(),
});

export const textDoneEventSchema = z.object({
  ...base,
  type: z.literal('text_done'),
  channel: z.enum(['text', 'refusal']),
  text: z.string(),
});

export const endEventSchema = z.object({
  ...base,
  type: z.literal('end'),
  outcome: z.enum(['completed', 'incomplete', 'failed']),
  /** OpenAI's reason for an incomplete reply, e.g. max_output_tokens or content_filter. */
  incompleteReason: z.string().nullable(),
  error: appErrorSchema.nullable(),
  usage: usageSchema.nullable(),
  /** The kinds of output items OpenAI returned (e.g. "message"), so tool calls would be visible. */
  outputItemTypes: z.array(z.string()),
  /** SHA-256 of the text the server relayed. */
  textSha256: z.string(),
  /** UTF-8 bytes of each token from OpenAI's final token list, when it came back complete. */
  finalTokenBytes: z.array(z.array(z.number().int().min(0).max(255))).nullable(),
  /** This app's vocabulary lookup for each streamed token, in order (null when not found). */
  providerTokenIds: z.array(count.nullable()),
  /** This app's tokenization of the whole relayed text. */
  outputTokens: tokenRunSchema.nullable(),
  /** The signature to send back with this reply next turn; null for replies that must not be re-sent. */
  assistantSig: z.string().nullable(),
  ledger: z.object({ basis: z.enum(['usage', 'estimate', 'none']), microUsd: count }),
});

export const serverEventSchema = z.discriminatedUnion('type', [
  startEventSchema,
  upstreamOpenEventSchema,
  responseCreatedEventSchema,
  deltaEventSchema,
  textDoneEventSchema,
  endEventSchema,
]);

export type ServerEventV1 = z.infer<typeof serverEventSchema>;
export type ServerEventType = ServerEventV1['type'];
export type StartEventV1 = z.infer<typeof startEventSchema>;
export type DeltaEventV1 = z.infer<typeof deltaEventSchema>;
export type TextDoneEventV1 = z.infer<typeof textDoneEventSchema>;
export type EndEventV1 = z.infer<typeof endEventSchema>;
export type ResponseCreatedEventV1 = z.infer<typeof responseCreatedEventSchema>;
export type WireLogprob = z.infer<typeof wireLogprobSchema>;
export type WireUsage = z.infer<typeof usageSchema>;
export type TokenRun = z.infer<typeof tokenRunSchema>;
export type TokenRuns = z.infer<typeof tokenRunsSchema>;
export type ContextReportV1 = z.infer<typeof contextReportSchema>;
export type ModerationReportV1 = z.infer<typeof moderationReportSchema>;
export type ReferenceValuesV1 = z.infer<typeof referenceValuesSchema>;
export type SettingsV1 = z.infer<typeof settingsSchema>;
export type AppLimitsV1 = z.infer<typeof appLimitsSchema>;

/** Input shape of an event before the branded timestamp transform (what the server serializes). */
export type ServerEventInput = z.input<typeof serverEventSchema>;

export const SERVER_EVENT_TYPES: readonly ServerEventType[] = [
  'start',
  'upstream_open',
  'response_created',
  'delta',
  'text_done',
  'end',
];

export type ParsedEvent = { ok: true; event: ServerEventV1 } | { ok: false; reason: 'unknown_type' | 'invalid' };

/** Validates one SSE payload. Unknown event types are reported separately so callers can skip them. */
export function parseServerEvent(data: string): ParsedEvent {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  const type = typeof json === 'object' && json !== null ? (json as { type?: unknown }).type : undefined;
  if (typeof type !== 'string' || !(SERVER_EVENT_TYPES as readonly string[]).includes(type)) {
    return { ok: false, reason: typeof type === 'string' ? 'unknown_type' : 'invalid' };
  }
  const result = serverEventSchema.safeParse(json);
  return result.success ? { ok: true, event: result.data } : { ok: false, reason: 'invalid' };
}
