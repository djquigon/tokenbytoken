// Server configuration: the model, instructions, limits, and the dated reference facts that the trace
// labels as Reference (CLAUDE.md §4). The client can't send any of these.

import 'server-only';

import { z } from 'zod';

import { REQUEST_LIMITS } from '@/shared/limits';
import type { ReferenceValuesV1 } from '@/shared/protocol/v1';

/** Public by design: shown in the UI word for word. Never put secrets here. */
export const INSTRUCTIONS =
  'You are the assistant on Token by Token, an educational website that shows how language models ' +
  'generate text one token at a time. Answer helpfully, accurately, and concisely, usually in under ' +
  "150 words and in plain language. Use Markdown only when it helps. If you aren't sure about something, " +
  "say so. You have no tools, no internet access, and no memory of other conversations.";

export const CHAT_CONFIG = {
  model: 'gpt-6-luna',
  reasoningEffort: 'none',
  temperature: 1,
  topP: 1,
  topLogprobs: 20,
  maxOutputTokens: 600,
  inputBudgetTokens: 6_000,
  maxTurns: 12,
  moderationModel: 'omni-moderation-latest',
  /** Output tokens assumed generated-but-not-relayed when a reply is stopped (Phase 0 saw ~8 in flight). */
  stopAllowanceTokens: 32,
  /** Extra input tokens reserved on top of the estimate, so a reservation is an upper bound. */
  reserveInputMarginTokens: 64,
  /** Abort upstream if OpenAI sends nothing for this long. */
  upstreamIdleTimeoutMs: 45_000,
  heartbeatMs: 15_000,
  /** Must match `maxDuration` in src/app/api/chat/route.ts. */
  maxDurationSec: 60,
  /** Signed replies older than this are dropped from the context rather than re-sent. */
  signatureMaxAgeSec: 24 * 60 * 60,
  sdkTimeoutMs: 55_000,
} as const;

export const LIMITS_CONFIG = {
  /** Per-session (tab) daily requests: fairness between visitors sharing one IP, e.g. a classroom. */
  sessionPerDay: 30,
  ipPerMinute: 30,
  ipPerDay: 300,
  /** The app ledger: ≈ $17 ÷ 31 days (CLAUDE.md §10). */
  dailyBudgetMicroUsd: 550_000,
  /** One IP can use at most this share of a day's budget. */
  ipDailyBudgetMicroUsd: 150_000,
  lockTtlMs: (CHAT_CONFIG.maxDurationSec + 15) * 1_000,
  reservationTtlSec: 2 * 24 * 60 * 60,
} as const;

const MODEL_PAGE = { title: 'OpenAI model page: gpt-6-luna', url: 'https://developers.openai.com/api/docs/models/gpt-6-luna', retrieved: '2026-09-30' };
const PRICING_PAGE = { title: 'OpenAI API pricing', url: 'https://developers.openai.com/api/docs/pricing', retrieved: '2026-09-30' };
const PROBE = (what: string) => ({ what: `${what} (Phase 0 probe)`, date: '2026-09-30' });

export const REFERENCE: ReferenceValuesV1 = {
  modelId: CHAT_CONFIG.model,
  contextWindowTokens: { value: 1_050_000, doc: MODEL_PAGE },
  maxOutputTokens: { value: 128_000, doc: MODEL_PAGE },
  prices: {
    inputPerMTokUsd: 0.1,
    cachedInputPerMTokUsd: 0.01,
    cacheWritePerMTokUsd: 0.125,
    outputPerMTokUsd: 0.5,
    doc: PRICING_PAGE,
  },
  hiddenOutputTokensPerReply: { value: 4, measured: PROBE('Output tokens OpenAI counts but does not return as text') },
  inputOverhead: { value: { perRequest: 1, perMessage: 5 }, measured: PROBE('Formatting tokens OpenAI adds to the input') },
  logprobsAreRawScores: { value: true, measured: PROBE('Logprobs unchanged by temperature') },
  tokenizer: { encoding: 'o200k_base', library: 'gpt-tokenizer 4' },
};

export const APP_LIMITS = {
  inputBudgetTokens: CHAT_CONFIG.inputBudgetTokens,
  maxOutputTokens: CHAT_CONFIG.maxOutputTokens,
  maxTurns: CHAT_CONFIG.maxTurns,
  maxMessageChars: REQUEST_LIMITS.maxMessageChars,
  stopAllowanceTokens: CHAT_CONFIG.stopAllowanceTokens,
} as const;

// ---------------------------------------------------------------------------------------------------
// Environment (validated lazily, so builds don't need secrets).

// An empty variable (`KEY=` in an env file) counts as unset.
const opt = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const envSchema = z.object({
  OPENAI_API_KEY: opt(z.string()),
  /** At least 32 characters. Signs replies and derives hashed IDs. Rotate by moving it to _PREVIOUS. */
  HISTORY_SIGNING_SECRET: opt(z.string().min(32)),
  HISTORY_SIGNING_SECRET_PREVIOUS: opt(z.string().min(32)),
  /** "memory" is for local development and tests only; it is refused on Vercel deployments. */
  LIMITS_STORE: opt(z.enum(['redis', 'memory'])),
  UPSTASH_REDIS_REST_URL: opt(z.url()),
  UPSTASH_REDIS_REST_TOKEN: opt(z.string()),
  KV_REST_API_URL: opt(z.url()),
  KV_REST_API_TOKEN: opt(z.string()),
  /** Extra allowed origins, comma-separated. Same-origin requests are always allowed. */
  ALLOWED_ORIGINS: opt(z.string()),
  VERCEL: opt(z.string()),
  VERCEL_ENV: opt(z.enum(['production', 'preview', 'development'])),
});

export type ServerEnv = z.infer<typeof envSchema>;

export const readServerEnv = (source: Record<string, string | undefined> = process.env): ServerEnv => {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    // Names and rules only, never values: this message goes to the logs.
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')} (${i.message})`);
    throw new Error(`Invalid server environment: ${issues.join(', ')}`);
  }
  return parsed.data;
};

/** True on a Vercel preview or production deployment (not `vercel dev`, `next dev`, or `next start`). */
export const onVercelDeployment = (env: ServerEnv): boolean =>
  env.VERCEL === '1' && (env.VERCEL_ENV === 'production' || env.VERCEL_ENV === 'preview');

/** Local development only: a fixed, public signing secret. Refused on Vercel deployments. */
export const DEV_SIGNING_SECRET = 'development-only-signing-secret-not-for-deployments';
