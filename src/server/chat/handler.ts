// POST /api/chat (docs/PLAN.md §3.4). Every check that can reject a request runs before the stream
// starts, so rejections carry a real HTTP status. After the `start` event, failures arrive in-band as
// `end{failed}`. Cleanup (ledger settlement, lock release, the metadata log line) runs in after(),
// because Vercel terminates the function when the client disconnects (ADR 0002).
//
// Order: origin → content type → size → schema → configuration → bot check → reply signatures →
// tokenize + context policy → admission (lock, rate limits, budget reservation) → moderation → stream.

import 'server-only';

import { APP_LIMITS, CHAT_CONFIG, INSTRUCTIONS, LIMITS_CONFIG, REFERENCE } from '../config';
import type { LimitsStore, LimitsPolicy, AdmissionKeys } from '../limits/store';
import { UpstreamAborted, UpstreamFailure, type GenerationRequest, type Upstream, type UpstreamEvent } from '../openai/adapter';
import { hashedKey, safetyIdentifier, signReply, verifyReply, type SigningKeys } from '../signing/signing';
import type { LocalTokenizer } from '../tokenizer/local-tokenizer';
import { applyContextPolicy, type PolicyMessage } from '@/shared/context-policy/policy';
import type { AppError, AppErrorCode } from '@/shared/errors';
import { REQUEST_LIMITS } from '@/shared/limits';
import { SSE_HEADERS, SSE_PADDING, formatSseComment, formatSseMessage } from '@/shared/protocol/sse';
import {
  PROTOCOL_VERSION,
  chatRequestSchema,
  type ChatRequestV1,
  type ContextReportV1,
  type ServerEventInput,
  type TokenRun,
  type WireUsage,
} from '@/shared/protocol/v1';
import { sha256Hex } from '@/shared/sha256';

import { clientIp, errorOf, errorResponse, originAllowed, readBodyCapped } from './http';

export interface ChatDeps {
  /** Null when the server isn't configured (for example, no API key): requests fail closed. */
  readonly upstream: Upstream | null;
  readonly store: LimitsStore | null;
  readonly keys: SigningKeys | null;
  readonly tokenizer: LocalTokenizer;
  readonly botCheck: () => Promise<{ readonly isBot: boolean }>;
  readonly after: (task: () => Promise<void>) => void;
  readonly nowMs: () => number;
  readonly monotonicMs: () => number;
  readonly randomId: () => string;
  /** One metadata line per request. Never content. */
  readonly log: (entry: Readonly<Record<string, unknown>>) => void;
  readonly allowedOrigins: readonly string[];
  readonly limits?: LimitsPolicy;
  readonly timers?: { readonly upstreamIdleTimeoutMs?: number; readonly heartbeatMs?: number };
}

type EventBody = ServerEventInput extends infer E ? (E extends unknown ? Omit<E, 'v' | 'seq' | 't'> : never) : never;

type Basis = 'usage' | 'estimate' | 'none';

interface Settlement {
  readonly basis: Basis;
  readonly microUsd: number;
}

/** µ$ from tokens: prices are USD per 1M tokens, which is the same number as µ$ per token. */
function costMicroUsd(usage: WireUsage): number {
  const p = REFERENCE.prices;
  const written = usage.cacheWriteTokens ?? 0;
  const uncached = Math.max(0, usage.inputTokens - usage.cachedInputTokens - written);
  return Math.ceil(
    uncached * p.inputPerMTokUsd + usage.cachedInputTokens * p.cachedInputPerMTokUsd + written * p.cacheWritePerMTokUsd + usage.outputTokens * p.outputPerMTokUsd,
  );
}

/** Worst case for one request, so a reservation is an upper bound on what OpenAI can bill. */
function reserveMicroUsd(estimatedInputTokens: number): number {
  const p = REFERENCE.prices;
  const input = estimatedInputTokens + CHAT_CONFIG.reserveInputMarginTokens;
  const output = CHAT_CONFIG.maxOutputTokens + REFERENCE.hiddenOutputTokensPerReply.value;
  return Math.ceil(input * Math.max(p.inputPerMTokUsd, p.cacheWritePerMTokUsd) + output * p.outputPerMTokUsd);
}

function estimateMicroUsd(estimatedInputTokens: number, relayedOutputTokens: number): number {
  const p = REFERENCE.prices;
  const output = relayedOutputTokens + REFERENCE.hiddenOutputTokensPerReply.value + CHAT_CONFIG.stopAllowanceTokens;
  return Math.ceil(estimatedInputTokens * p.inputPerMTokUsd + output * p.outputPerMTokUsd);
}

type Verified =
  | { ok: true; messages: ChatRequestV1['messages']; expired: string[] }
  | { ok: false };

/** Checks every re-sent reply. A forged or altered one rejects the request; an old one is dropped. */
function verifyHistory(req: ChatRequestV1, keys: SigningKeys, nowSec: number): Verified {
  const kept: ChatRequestV1['messages'] = [];
  const expired: string[] = [];
  for (let i = 0; i < req.messages.length; i += 1) {
    const m = req.messages[i];
    if (!m) continue;
    if (m.role === 'user') {
      kept.push(m);
      continue;
    }
    const prev = req.messages[i - 1];
    if (!prev || prev.role !== 'user') return { ok: false };
    const result = verifyReply(
      keys,
      m.sig,
      { conversationId: req.conversationId, messageId: m.id, previousUserText: prev.content, text: m.content },
      nowSec,
      CHAT_CONFIG.signatureMaxAgeSec,
    );
    if (result === 'invalid') return { ok: false };
    if (result === 'expired') expired.push(m.id);
    else kept.push(m);
  }
  return { ok: true, messages: kept, expired };
}

export function createChatHandler(deps: ChatDeps) {
  const limits = deps.limits ?? LIMITS_CONFIG;
  const idleTimeoutMs = deps.timers?.upstreamIdleTimeoutMs ?? CHAT_CONFIG.upstreamIdleTimeoutMs;
  const heartbeatMs = deps.timers?.heartbeatMs ?? CHAT_CONFIG.heartbeatMs;

  return async function handleChat(request: Request): Promise<Response> {
    const t0 = deps.monotonicMs();
    const elapsed = () => Math.round((deps.monotonicMs() - t0) * 10) / 10;
    const requestId = deps.randomId();
    const reject = (error: AppError, stage: string) => {
      deps.log({ evt: 'chat', id: requestId, status: 'rejected', code: error.code, stage, ms: elapsed() });
      return errorResponse(error);
    };

    // 1–4: cheap checks on the request itself.
    if (!originAllowed(request, deps.allowedOrigins)) return reject(errorOf('forbidden'), 'origin');
    if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
      return reject(errorOf('bad_request'), 'content_type');
    }
    const body = await readBodyCapped(request, REQUEST_LIMITS.maxBodyBytes);
    if (!body.ok) return reject(errorOf(body.reason === 'too_large' ? 'payload_too_large' : 'bad_request'), 'body');
    let json: unknown;
    try {
      json = JSON.parse(body.text);
    } catch {
      return reject(errorOf('bad_request'), 'json');
    }
    const parsed = chatRequestSchema.safeParse(json);
    if (!parsed.success) return reject(errorOf('bad_request'), 'schema');
    const req = parsed.data;

    // 5: fail closed when anything the pipeline depends on is missing.
    const { upstream, store, keys } = deps;
    if (!upstream || !store || !keys) return reject(errorOf('service_unavailable'), 'config');

    // 6: bots. BotID needs the request to come from a page that ran its client script.
    try {
      if ((await deps.botCheck()).isBot) return reject(errorOf('forbidden'), 'bot');
    } catch {
      return reject(errorOf('service_unavailable'), 'bot_check');
    }

    // 7: re-sent replies must carry this server's signature.
    const nowSec = Math.floor(deps.nowMs() / 1000);
    const verified = verifyHistory(req, keys, nowSec);
    if (!verified.ok) return reject(errorOf('invalid_history'), 'signature');

    // 8: tokenize and fit the context.
    const tokenizer = deps.tokenizer;
    const counts = new Map(verified.messages.map((m) => [m.id, tokenizer.count(m.content)]));
    const policyMessages: PolicyMessage[] = verified.messages.map((m) => ({ id: m.id, role: m.role, tokens: counts.get(m.id) ?? 0 }));
    const policy = applyContextPolicy(
      { instructionsTokens: tokenizer.count(INSTRUCTIONS), messages: policyMessages },
      { inputBudgetTokens: CHAT_CONFIG.inputBudgetTokens, maxTurns: CHAT_CONFIG.maxTurns, overhead: REFERENCE.inputOverhead.value },
    );
    if (!policy.ok) return reject(errorOf('context_too_long'), 'context');
    const byId = new Map(verified.messages.map((m) => [m.id, m]));
    const included = policy.included.flatMap((id) => {
      const m = byId.get(id);
      return m ? [m] : [];
    });
    const context: ContextReportV1 = {
      inputBudgetTokens: CHAT_CONFIG.inputBudgetTokens,
      included: policy.included as string[],
      dropped: [...verified.expired.map((id) => ({ id, reason: 'expired_signature' as const })), ...policy.dropped],
      estimatedInputTokens: policy.estimatedInputTokens,
    };

    // 9: admission — one atomic step for the lock, rate limits, and the budget reservation.
    const reserved = reserveMicroUsd(policy.estimatedInputTokens);
    const nowMs = deps.nowMs();
    let keysForSettle: AdmissionKeys;
    try {
      const admitted = await store.admit(
        {
          requestId,
          sessionKey: hashedKey(keys, 'session', req.sessionId),
          ipKey: hashedKey(keys, 'ip', clientIp(request)),
          reserveMicroUsd: reserved,
          nowMs,
        },
        limits,
      );
      if (!admitted.ok) {
        if (admitted.reason === 'daily_budget_exhausted') {
          return reject(errorOf('daily_budget_exhausted', { retryAfterSec: admitted.retryAfterSec, resetAt: admitted.resetAt }), 'budget');
        }
        return reject(errorOf(admitted.reason, { retryAfterSec: admitted.retryAfterSec }), 'admission');
      }
      keysForSettle = admitted.keys;
    } catch {
      return reject(errorOf('service_unavailable'), 'store');
    }

    // From here on the reservation must be settled exactly once, whatever happens.
    const finished = Promise.withResolvers<Settlement>();
    const summary: Record<string, unknown> = { evt: 'chat', id: requestId, reservedMicroUsd: reserved };
    deps.after(async () => {
      const settlement = await finished.promise;
      try {
        await store.settle({ requestId, keys: keysForSettle, reservedMicroUsd: reserved, actualMicroUsd: settlement.microUsd, nowMs: deps.nowMs() });
      } catch {
        summary.settleFailed = true; // the reservation stays charged in full: safe, never over budget
      }
      deps.log({ ...summary, basis: settlement.basis, microUsd: settlement.microUsd, ms: elapsed() });
    });

    const upstreamAbort = new AbortController();
    let disconnectedAt: number | null = null;
    const onDisconnect = () => {
      disconnectedAt ??= elapsed();
      upstreamAbort.abort();
    };
    request.signal.addEventListener('abort', onDisconnect);
    if (request.signal.aborted) onDisconnect();

    // 10: moderation of any user text that hasn't been checked before (text followed by a signed reply
    // was checked on the request that produced that reply).
    const unchecked = included.filter((m, i) => m.role === 'user' && included[i + 1]?.role !== 'assistant');
    const moderationStartedAt = elapsed();
    let moderation: { model: string; flagged: boolean };
    try {
      moderation = await upstream.moderate(unchecked.map((m) => m.content), CHAT_CONFIG.moderationModel, upstreamAbort.signal);
    } catch (err) {
      // Fail closed: without a moderation result, nothing is sent to the model.
      finished.resolve({ basis: 'none', microUsd: 0 });
      summary.status = 'rejected';
      summary.code = 'service_unavailable';
      summary.stage = err instanceof UpstreamAborted ? 'moderation_client_gone' : 'moderation_failed';
      return errorResponse(errorOf('service_unavailable'));
    }
    const moderationEndedAt = elapsed();
    if (moderation.flagged) {
      finished.resolve({ basis: 'none', microUsd: 0 });
      summary.status = 'rejected';
      summary.code = 'input_flagged';
      return errorResponse(errorOf('input_flagged'));
    }

    // 11: stream.
    const newestUser = included.at(-1);
    const assistantMessageId = `msg_${deps.randomId().replaceAll('-', '')}`;
    const generation: GenerationRequest = {
      instructions: INSTRUCTIONS,
      messages: included.map((m) => ({ role: m.role, content: m.content })),
      settings: {
        model: CHAT_CONFIG.model,
        reasoningEffort: CHAT_CONFIG.reasoningEffort,
        temperature: CHAT_CONFIG.temperature,
        topP: CHAT_CONFIG.topP,
        topLogprobs: req.options.logprobs ? CHAT_CONFIG.topLogprobs : null,
        maxOutputTokens: CHAT_CONFIG.maxOutputTokens,
      },
      safetyIdentifier: safetyIdentifier(keys, req.sessionId),
    };
    const call = upstream.describe(generation);
    const inputRuns: TokenRun[] = [
      tokenizer.run('instructions', INSTRUCTIONS),
      ...included.map((m) => tokenizer.run(m.id, m.content)),
    ];
    summary.status = 'streamed';

    let seq = 0;
    let closed = false;
    let lastWrite = deps.monotonicMs();
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        const raw = (text: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(text));
            lastWrite = deps.monotonicMs();
          } catch {
            closed = true;
          }
        };
        const send = (event: EventBody) => {
          seq += 1;
          raw(formatSseMessage(seq, JSON.stringify({ v: PROTOCOL_VERSION, seq, t: elapsed(), ...event })));
        };
        const heartbeat = setInterval(() => {
          if (deps.monotonicMs() - lastWrite >= heartbeatMs) raw(formatSseComment('heartbeat'));
        }, Math.max(50, Math.floor(heartbeatMs / 3)));

        raw(SSE_PADDING);
        send({
          type: 'start',
          requestId,
          assistantMessageId,
          instructions: INSTRUCTIONS,
          settings: {
            model: generation.settings.model,
            temperature: generation.settings.temperature,
            topP: generation.settings.topP,
            topLogprobs: generation.settings.topLogprobs,
            maxOutputTokens: generation.settings.maxOutputTokens,
            reasoningEffort: generation.settings.reasoningEffort,
            storedByProvider: false,
            truncation: 'disabled',
            toolsOffered: 0,
          },
          upstreamRequest: { endpoint: call.endpoint, body: { ...call.body } },
          context,
          inputTokens: { encoding: 'o200k_base', runs: inputRuns },
          moderation: {
            model: moderation.model,
            checkedIds: unchecked.map((m) => m.id),
            flagged: false,
            startedAt: moderationStartedAt,
            endedAt: moderationEndedAt,
          },
          limits: { ...APP_LIMITS },
          reference: REFERENCE,
        });

        let text = '';
        let refusal = '';
        const tokens: string[] = [];
        let deltas = 0;
        let createdSeen = false;
        let terminal: Extract<UpstreamEvent, { kind: 'terminal' }> | null = null;
        let failure: AppErrorCode | null = null;
        let timedOut = false;
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        const armWatchdog = () => {
          clearTimeout(watchdog);
          watchdog = setTimeout(() => {
            timedOut = true;
            upstreamAbort.abort();
          }, idleTimeoutMs);
        };

        try {
          armWatchdog();
          for await (const ev of upstream.generate(generation, upstreamAbort.signal)) {
            armWatchdog();
            switch (ev.kind) {
              case 'open':
                send({ type: 'upstream_open' });
                break;
              case 'created':
                createdSeen = true;
                send({ type: 'response_created', model: ev.model });
                break;
              case 'delta': {
                deltas += 1;
                if (ev.channel === 'text') {
                  text += ev.text;
                  for (const lp of ev.logprobs ?? []) tokens.push(lp.token);
                } else {
                  refusal += ev.text;
                }
                const gap = ev.channel === 'text' && ev.logprobs !== null && ev.logprobs.length === 0 && ev.text.length > 0;
                send({
                  type: 'delta',
                  channel: ev.channel,
                  text: ev.text,
                  logprobs: ev.logprobs,
                  upstreamSeq: ev.upstreamSeq,
                  ...(gap ? { gapTokens: tokenizer.run('gap', ev.text) } : {}),
                });
                break;
              }
              case 'done':
                send({ type: 'text_done', channel: ev.channel, text: ev.text });
                break;
              case 'terminal':
                terminal = ev;
                break;
            }
          }
          if (!terminal) failure = 'upstream_stream_interrupted';
        } catch (err) {
          if (err instanceof UpstreamAborted) failure = timedOut ? 'upstream_timeout' : null;
          else failure = err instanceof UpstreamFailure ? err.code : 'upstream_failed';
        } finally {
          clearTimeout(watchdog);
          clearInterval(heartbeat);
          request.signal.removeEventListener('abort', onDisconnect);
        }

        const reply = text || refusal;
        const usage = terminal?.usage ?? null;
        const localOutput = tokenizer.count(reply);
        const settlement: Settlement = usage
          ? { basis: 'usage', microUsd: costMicroUsd(usage) }
          : createdSeen || deltas > 0
            ? { basis: 'estimate', microUsd: estimateMicroUsd(policy.estimatedInputTokens, localOutput) }
            : { basis: 'none', microUsd: 0 };
        finished.resolve(settlement);
        Object.assign(summary, {
          outcome: disconnectedAt !== null ? 'disconnected' : (terminal?.outcome ?? 'failed'),
          code: failure ?? terminal?.errorCode ?? undefined,
          deltas,
          tokens: tokens.length,
          usage: usage ? { in: usage.inputTokens, cached: usage.cachedInputTokens, out: usage.outputTokens, reasoning: usage.reasoningTokens } : null,
          disconnectedAtMs: disconnectedAt,
          timedOut,
        });

        if (disconnectedAt === null) {
          const outcome = failure ? 'failed' : (terminal?.outcome ?? 'failed');
          const signable = (outcome === 'completed' || outcome === 'incomplete') && newestUser !== undefined;
          send({
            type: 'end',
            outcome,
            incompleteReason: terminal?.incompleteReason ?? null,
            error: failure ? { code: failure } : terminal?.errorCode ? { code: terminal.errorCode } : null,
            usage,
            outputItemTypes: terminal?.outputItemTypes ?? [],
            textSha256: sha256Hex(text),
            finalTokenBytes: terminal?.finalTokenBytes ?? null,
            providerTokenIds: tokens.map((t) => tokenizer.lookup(t)),
            outputTokens: reply ? tokenizer.run('output', reply) : null,
            assistantSig: signable
              ? signReply(keys, { conversationId: req.conversationId, messageId: assistantMessageId, previousUserText: newestUser.content, text: reply }, Math.floor(deps.nowMs() / 1000))
              : null,
            ledger: settlement,
          });
        }
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed or cancelled by the client
        }
      },
      cancel: () => {
        closed = true;
        onDisconnect();
      },
    });

    return new Response(stream, { headers: { ...SSE_HEADERS } });
  };
}
