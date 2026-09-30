// The TraceLog: raw wire events plus browser timestamps, append-only. It is the only thing persisted
// (docs/PLAN.md §3.5); every fact is recomputed from it, so fixing a bug in alignment or labeling also
// fixes old turns.

import { z } from 'zod';

import { appErrorSchema, serverEventSchema, type ServerEventV1 } from '@/shared/protocol/v1';
import type { AppError } from '@/shared/errors';
import type { ClientMs } from '@/shared/units';

export type TraceLogEntry = { readonly tc: ClientMs } & (
  | { readonly k: 'request_sent'; readonly messageIds: readonly string[]; readonly logprobs: boolean }
  | { readonly k: 'http_ok' }
  | { readonly k: 'http_error'; readonly status: number; readonly error: AppError | null }
  /** `read` numbers the network reads, so events that arrived together share one. */
  | { readonly k: 'server'; readonly ev: ServerEventV1; readonly read: number }
  | { readonly k: 'unknown_event' }
  | { readonly k: 'user_abort' }
  | { readonly k: 'stream_closed' }
  | { readonly k: 'network_error' }
  | { readonly k: 'idle_timeout' }
  | { readonly k: 'protocol_error'; readonly detail: 'invalid_event' | 'out_of_order' | 'bad_response' }
  /** Written on page load for a log that has no terminal entry (the page was reloaded mid-stream). */
  | { readonly k: 'recovered' }
);

export type EntryKind = TraceLogEntry['k'];

export interface TraceLogV1 {
  readonly v: 1;
  /** The clientRequestId of the request this turn sent. */
  readonly turnId: string;
  readonly conversationId: string;
  readonly userMessageId: string;
  readonly entries: readonly TraceLogEntry[];
}

/** Entries after which nothing more is recorded. Terminal states are sticky. */
export const TERMINAL_KINDS: ReadonlySet<EntryKind> = new Set<EntryKind>([
  'http_error',
  'user_abort',
  'stream_closed',
  'network_error',
  'idle_timeout',
  'protocol_error',
  'recovered',
]);

export const createLog = (turnId: string, conversationId: string, userMessageId: string): TraceLogV1 => ({
  v: 1,
  turnId,
  conversationId,
  userMessageId,
  entries: [],
});

export const isTerminated = (log: TraceLogV1): boolean => log.entries.some((e) => TERMINAL_KINDS.has(e.k));

/** Appends an entry unless the log has already reached a terminal state. */
export function appendEntry(log: TraceLogV1, entry: TraceLogEntry): TraceLogV1 {
  if (isTerminated(log)) return log;
  return { ...log, entries: [...log.entries, entry] };
}

// ---------------------------------------------------------------------------------------------------
// Validation for logs restored from sessionStorage (CLAUDE.md §6: storage restores are untrusted).

const tc = z
  .number()
  .nonnegative()
  .transform((n) => n as ClientMs);

const entrySchema = z.discriminatedUnion('k', [
  z.object({ tc, k: z.literal('request_sent'), messageIds: z.array(z.string()), logprobs: z.boolean() }),
  z.object({ tc, k: z.literal('http_ok') }),
  z.object({ tc, k: z.literal('http_error'), status: z.number().int(), error: appErrorSchema.nullable() }),
  z.object({ tc, k: z.literal('server'), ev: serverEventSchema, read: z.number().int().nonnegative() }),
  z.object({ tc, k: z.literal('unknown_event') }),
  z.object({ tc, k: z.literal('user_abort') }),
  z.object({ tc, k: z.literal('stream_closed') }),
  z.object({ tc, k: z.literal('network_error') }),
  z.object({ tc, k: z.literal('idle_timeout') }),
  z.object({ tc, k: z.literal('protocol_error'), detail: z.enum(['invalid_event', 'out_of_order', 'bad_response']) }),
  z.object({ tc, k: z.literal('recovered') }),
]);

export const traceLogSchema = z.object({
  v: z.literal(1),
  turnId: z.string(),
  conversationId: z.string(),
  userMessageId: z.string(),
  entries: z.array(entrySchema),
});

export const serverEvents = (log: TraceLogV1): ServerEventV1[] =>
  log.entries.flatMap((e) => (e.k === 'server' ? [e.ev] : []));
