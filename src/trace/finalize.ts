// finalizeTrace: TraceLog → FinalizedTrace. Pure (no Date, randomness, DOM, or fetch). This is the only
// place Recorded and Reference values are minted (CLAUDE.md §4).

import type { AppError } from '@/shared/errors';
import { derive, deriveAll, type Sourced } from '@/shared/provenance';
import { recordedProv, recordedWith, reference, referenceWith, referenceProv } from '@/shared/provenance/mint';
import { read } from '@/shared/provenance/read';
import type { DeltaEventV1, EndEventV1, ServerEventV1, StartEventV1, TextDoneEventV1 } from '@/shared/protocol/v1';
import type { ClientMs, ServerMs } from '@/shared/units';

import { alignTokens, type TokenSpan } from './align/align';
import { findCloseCalls, isCloseCall } from './close-calls';
import type {
  Alternative,
  AnomalyCode,
  FinalizedTrace,
  InputRunFacts,
  InterruptionCause,
  Outcome,
  OutputFacts,
  OutputGap,
  OutputSegment,
  OutputToken,
  RequestFacts,
  StopReason,
  TimingFacts,
  TokenSource,
  UsageFacts,
} from './facts';
import type { TraceLogEntry, TraceLogV1 } from './log';
import { BROWSER_DELTA_TIME, PROV, SERVER_DELTA_TIME } from './provs';
import { reconcile } from './reconcile';

const pctOf = (logprob: number) => Math.exp(logprob) * 100;

interface Scan {
  requestSent: Extract<TraceLogEntry, { k: 'request_sent' }> | null;
  httpOk: TraceLogEntry | null;
  httpError: Extract<TraceLogEntry, { k: 'http_error' }> | null;
  start: { ev: StartEventV1; tc: ClientMs } | null;
  upstreamOpen: { ev: ServerEventV1; tc: ClientMs } | null;
  created: { ev: Extract<ServerEventV1, { type: 'response_created' }>; tc: ClientMs } | null;
  deltas: { ev: DeltaEventV1; tc: ClientMs; read: number }[];
  textDone: { ev: TextDoneEventV1; tc: ClientMs } | null;
  end: { ev: EndEventV1; tc: ClientMs } | null;
  terminal: TraceLogEntry | null;
  lastTc: ClientMs | null;
  unknownEvents: number;
  outOfOrder: boolean;
}

function scan(log: TraceLogV1): Scan {
  const s: Scan = {
    requestSent: null,
    httpOk: null,
    httpError: null,
    start: null,
    upstreamOpen: null,
    created: null,
    deltas: [],
    textDone: null,
    end: null,
    terminal: null,
    lastTc: null,
    unknownEvents: 0,
    outOfOrder: false,
  };
  let lastSeq = -1;
  for (const e of log.entries) {
    s.lastTc = e.tc;
    switch (e.k) {
      case 'request_sent':
        s.requestSent ??= e;
        break;
      case 'http_ok':
        s.httpOk ??= e;
        break;
      case 'unknown_event':
        s.unknownEvents += 1;
        break;
      case 'server': {
        const ev = e.ev;
        if (ev.seq <= lastSeq) s.outOfOrder = true;
        lastSeq = Math.max(lastSeq, ev.seq);
        if (s.end) break; // nothing after the final event counts
        if (ev.type === 'start') s.start ??= { ev, tc: e.tc };
        else if (ev.type === 'upstream_open') s.upstreamOpen ??= { ev, tc: e.tc };
        else if (ev.type === 'response_created') s.created ??= { ev, tc: e.tc };
        else if (ev.type === 'delta') s.deltas.push({ ev, tc: e.tc, read: e.read });
        else if (ev.type === 'text_done') {
          if (ev.channel === 'text') s.textDone ??= { ev, tc: e.tc };
        } else if (ev.type === 'end') s.end = { ev, tc: e.tc };
        break;
      }
      default:
        if (e.k === 'http_error') s.httpError ??= e;
        s.terminal ??= e;
    }
  }
  return s;
}

function outcomeOf(s: Scan): {
  outcome: Sourced<Outcome>;
  stopReason: Sourced<StopReason>;
  interruption: InterruptionCause | null;
  error: AppError | null;
} {
  if (s.httpError && !s.start) {
    return {
      outcome: recordedWith(PROV.rejected, 'rejected' as Outcome),
      stopReason: recordedWith(PROV.rejected, 'rejected' as StopReason),
      interruption: null,
      error: s.httpError.error ?? { code: 'service_unavailable' },
    };
  }
  if (s.end) {
    const end = s.end.ev;
    const outcome = recordedWith(PROV.outcome, end.outcome as Outcome);
    if (end.outcome === 'completed') {
      // No stop sequences are ever set, so "completed" means the model generated its end marker.
      return {
        outcome,
        stopReason: derive('end-marker-inferred', [outcome], () => 'end_marker' as StopReason),
        interruption: null,
        error: null,
      };
    }
    if (end.outcome === 'incomplete') {
      const reason = end.incompleteReason;
      const stop: StopReason =
        reason === 'max_output_tokens' ? 'output_limit' : reason === 'content_filter' ? 'content_filter' : 'other_incomplete';
      return { outcome, stopReason: recordedWith(PROV.incompleteReason, stop), interruption: null, error: null };
    }
    return { outcome, stopReason: recordedWith(PROV.outcome, 'error' as StopReason), interruption: null, error: end.error };
  }
  if (s.terminal?.k === 'user_abort') {
    return {
      outcome: recordedWith(PROV.userAbort, 'stopped' as Outcome),
      stopReason: recordedWith(PROV.userAbort, 'stopped_by_user' as StopReason),
      interruption: null,
      error: null,
    };
  }
  const cause: InterruptionCause =
    s.terminal?.k === 'idle_timeout'
      ? 'idle'
      : s.terminal?.k === 'recovered'
        ? 'reload'
        : s.terminal?.k === 'protocol_error'
          ? 'protocol'
          : 'transport';
  const noEnd = recordedWith(PROV.browserTime('last event received'), s.lastTc ?? (0 as ClientMs));
  return {
    outcome: derive('outcome-from-log', [noEnd], () => 'interrupted' as Outcome),
    stopReason: derive('outcome-from-log', [noEnd], () => 'connection_lost' as StopReason),
    interruption: cause,
    error: cause === 'protocol' ? { code: 'protocol_error' } : { code: 'stream_interrupted' },
  };
}

function requestFacts(start: StartEventV1): RequestFacts {
  const st = start.settings;
  const setting = <T>(name: keyof typeof st, value: T) => recordedWith(PROV.setting(name), value);
  const ref = start.reference;
  const priceDoc = referenceProv({ doc: ref.prices.doc });
  const probe = (m: { what: string; date: string }) => referenceProv({ measured: m });
  const inputRuns: InputRunFacts[] = start.inputTokens.runs.map((run) => {
    const text = recordedWith(run.key === 'instructions' ? PROV.instructions : PROV.messages, textForRun(start, run.key));
    const ids = derive('local-token-count', [text], () => run.ids as readonly number[]);
    return { key: run.key, text, ids, byteLengths: run.byteLengths, count: derive('local-token-count', [text], () => run.ids.length) };
  });
  const overhead = referenceWith(probe(ref.inputOverhead.measured), ref.inputOverhead.value);
  return {
    requestId: start.requestId,
    assistantMessageId: start.assistantMessageId,
    instructions: recordedWith(PROV.instructions, start.instructions),
    settings: {
      model: setting('model', st.model),
      temperature: setting('temperature', st.temperature),
      topP: setting('topP', st.topP),
      topLogprobs: setting('topLogprobs', st.topLogprobs),
      maxOutputTokens: setting('maxOutputTokens', st.maxOutputTokens),
      reasoningEffort: setting('reasoningEffort', st.reasoningEffort),
      storedByProvider: setting('storedByProvider', st.storedByProvider),
      truncation: setting('truncation', st.truncation),
      toolsOffered: setting('toolsOffered', st.toolsOffered),
    },
    upstreamBody: recordedWith(PROV.upstreamBody, start.upstreamRequest.body),
    upstreamEndpoint: start.upstreamRequest.endpoint,
    context: {
      inputBudgetTokens: recordedWith(PROV.contextBudget, start.context.inputBudgetTokens),
      included: recordedWith(PROV.contextIncluded, start.context.included as readonly string[]),
      dropped: recordedWith(PROV.contextDropped, start.context.dropped as readonly { id: string; reason: string }[]),
      estimatedInputTokens: derive(
        'input-estimate',
        [...inputRuns.map((r) => r.count), overhead],
        () => start.context.estimatedInputTokens,
      ),
    },
    inputRuns,
    moderation: {
      model: recordedWith(PROV.moderationModel, start.moderation.model),
      checkedIds: recordedWith(PROV.moderationChecked, start.moderation.checkedIds as readonly string[]),
      flagged: recordedWith(PROV.moderationFlagged, start.moderation.flagged),
    },
    limits: {
      inputBudgetTokens: recordedWith(PROV.limit('inputBudgetTokens'), start.limits.inputBudgetTokens),
      maxOutputTokens: recordedWith(PROV.limit('maxOutputTokens'), start.limits.maxOutputTokens),
      maxTurns: recordedWith(PROV.limit('maxTurns'), start.limits.maxTurns),
      maxMessageChars: recordedWith(PROV.limit('maxMessageChars'), start.limits.maxMessageChars),
    },
    reference: {
      contextWindowTokens: reference({ doc: ref.contextWindowTokens.doc }, ref.contextWindowTokens.value),
      maxOutputTokens: reference({ doc: ref.maxOutputTokens.doc }, ref.maxOutputTokens.value),
      inputPricePerMTokUsd: referenceWith(priceDoc, ref.prices.inputPerMTokUsd),
      cachedInputPricePerMTokUsd: referenceWith(priceDoc, ref.prices.cachedInputPerMTokUsd),
      cacheWritePricePerMTokUsd: referenceWith(priceDoc, ref.prices.cacheWritePerMTokUsd),
      outputPricePerMTokUsd: referenceWith(priceDoc, ref.prices.outputPerMTokUsd),
      hiddenOutputTokensPerReply: referenceWith(probe(ref.hiddenOutputTokensPerReply.measured), ref.hiddenOutputTokensPerReply.value),
      logprobsAreRawScores: referenceWith(probe(ref.logprobsAreRawScores.measured), ref.logprobsAreRawScores.value),
      inputOverhead: overhead,
      tokenizer: reference(
        { measured: { what: 'Round-trip check of every output token against o200k_base (Phase 0 probe)', date: '2026-09-30' } },
        `${ref.tokenizer.encoding} (${ref.tokenizer.library})`,
      ),
    },
  };
}

/** The text a token run covers: the instructions, or a message as the server sent it. */
function textForRun(start: StartEventV1, key: string): string {
  if (key === 'instructions') return start.instructions;
  const input = start.upstreamRequest.body.input;
  if (!Array.isArray(input)) return '';
  const index = start.context.included.indexOf(key);
  const item: unknown = input[index];
  return typeof item === 'object' && item !== null && typeof (item as { content?: unknown }).content === 'string'
    ? (item as { content: string }).content
    : '';
}

function outputFacts(s: Scan, logprobsRequested: boolean): { facts: OutputFacts; anomalies: AnomalyCode[] } {
  const anomalies: AnomalyCode[] = [];
  const requestSent = s.requestSent ? recordedWith(PROV.browserTime('request sent'), s.requestSent.tc) : null;
  const textDeltas = s.deltas.filter((d) => d.ev.channel === 'text');
  const refusalDeltas = s.deltas.filter((d) => d.ev.channel === 'refusal');
  const deltaTexts = textDeltas.map((d) => recordedWith(PROV.deltaText, d.ev.text));
  const text = deriveAll('text-join', deltaTexts, (xs) => xs.join(''));

  const aligned = alignTokens({
    deltas: textDeltas.map((d) => ({ text: d.ev.text, tokens: d.ev.logprobs ? d.ev.logprobs.map((l) => l.token) : null })),
    finalTokenBytes: s.end?.ev.finalTokenBytes ?? null,
  });
  for (const issue of aligned.issues) anomalies.push(issue.kind === 'unplaced_tokens' ? 'unplaced_tokens' : 'final_bytes_count_mismatch');

  const providerIds = s.end?.ev.providerTokenIds ?? null;
  if (providerIds && providerIds.length !== aligned.tokenCount) anomalies.push('provider_token_ids_mismatch');
  const idsUsable = providerIds !== null && providerIds.length === aligned.tokenCount;

  const flat = textDeltas.flatMap((d, deltaIndex) => (d.ev.logprobs ?? []).map((lp) => ({ lp, d, deltaIndex })));
  const spans = new Map<number, TokenSpan>();
  for (const seg of aligned.segments) if (seg.kind === 'token') spans.set(seg.tokenIndex, seg);

  const tokens: OutputToken[] = flat.map(({ lp, d, deltaIndex }, index) => {
    const tokenText = recordedWith(PROV.token, lp.token);
    const logprob = recordedWith(PROV.logprob, lp.logprob);
    const alternativesList = recordedWith(PROV.alternatives, lp.top);
    const sorted = [...lp.top].sort((a, b) => b.logprob - a.logprob);
    const alternatives: Alternative[] = sorted.map((alt) => {
      const altLogprob = recordedWith(PROV.altLogprob, alt.logprob);
      return {
        text: recordedWith(PROV.altToken, alt.token),
        logprob: altLogprob,
        pct: derive('pct-from-logprob', [altLogprob], pctOf),
        isChosen: alt.token === lp.token,
      };
    });
    const rankIndex = sorted.findIndex((alt) => alt.token === lp.token);
    const pct = derive('pct-from-logprob', [logprob], pctOf);
    const span = spans.get(index);
    const id = idsUsable ? providerIds[index] : null;
    const browserArrival = recordedWith(BROWSER_DELTA_TIME, d.tc);
    return {
      index,
      deltaIndex,
      text: tokenText,
      span: span
        ? { start: span.start, end: span.end, placement: span.placement, partialStart: span.partialStart, partialEnd: span.partialEnd }
        : { start: 0, end: 0, placement: 'delta', partialStart: false, partialEnd: false },
      logprob,
      pct,
      alternatives,
      chosenRank: derive('rank', [tokenText, alternativesList], () => (rankIndex === -1 ? null : rankIndex + 1)),
      remainderPct: derive('remainder', [alternativesList], (alts) =>
        Math.max(0, 100 - alts.reduce((sum, a) => sum + pctOf(a.logprob), 0)),
      ),
      tokenId: id === null || id === undefined ? null : derive('token-id-lookup', [tokenText], () => id),
      closeCall: derive('close-call', [logprob, alternativesList], (value, alts) =>
        isCloseCall(pctOf(value), alts.map((a) => pctOf(a.logprob)).sort((a, b) => b - a)),
      ),
      arrival: { server: recordedWith(SERVER_DELTA_TIME, d.ev.t), browser: browserArrival },
      arrivalAfterSend: requestSent ? derive('duration', [requestSent, browserArrival], (sent, at) => at - sent) : null,
    };
  });

  const gaps: OutputGap[] = [];
  const segments: OutputSegment[] = aligned.segments.flatMap((seg): OutputSegment[] => {
    if (seg.kind === 'token') {
      const token = tokens[seg.tokenIndex];
      return token ? [{ kind: 'token', token }] : [];
    }
    const d = textDeltas[seg.deltaIndex];
    if (!d) return [];
    const gapText = recordedWith(PROV.deltaText, d.ev.text);
    const gapTokens = d.ev.gapTokens;
    const gap: OutputGap = {
      deltaIndex: seg.deltaIndex,
      text: gapText,
      span: { start: seg.start, end: seg.end },
      estimatedTokens: gapTokens ? derive('local-token-count', [gapText], () => gapTokens.ids.length) : null,
      arrival: { server: recordedWith(SERVER_DELTA_TIME, d.ev.t), browser: recordedWith(BROWSER_DELTA_TIME, d.tc) },
    };
    gaps.push(gap);
    return [{ kind: 'gap', gap }];
  });

  const estimates = gaps.flatMap((g) => (g.estimatedTokens ? [g.estimatedTokens] : []));
  const source: TokenSource = !logprobsRequested
    ? s.end?.ev.outputTokens
      ? 'local'
      : 'none'
    : tokens.length === 0 && gaps.length === 0
      ? 'none'
      : aligned.coveredFully
        ? 'provider'
        : 'provider_with_gaps';

  const outputRun = s.end?.ev.outputTokens ?? null;
  const tokensPerDelta = deriveAll(
    'count',
    textDeltas.map((d) => recordedWith(PROV.tokensInDelta, d.ev.logprobs?.length ?? 0)),
    histogram,
  );
  const reads = deriveAll(
    'count',
    s.deltas.map((d) => recordedWith(PROV.networkRead, d.read)),
    (xs) => histogram([...countBy(xs).values()]),
  );

  return {
    anomalies,
    facts: {
      text,
      finalText: s.textDone ? recordedWith(PROV.finalText, s.textDone.ev.text) : null,
      refusal:
        refusalDeltas.length > 0
          ? deriveAll('text-join', refusalDeltas.map((d) => recordedWith(PROV.refusalText, d.ev.text)), (xs) => xs.join(''))
          : null,
      source,
      segments,
      tokens,
      providerTokenCount: deriveAll('count', tokens.map((t) => t.text), (xs) => xs.length),
      gapTokenEstimate: estimates.length > 0 ? deriveAll('local-token-count', estimates, (xs) => xs.reduce((a, b) => a + b, 0)) : null,
      localTokens: outputRun
        ? { ids: derive('local-token-count', [text], () => outputRun.ids as readonly number[]), byteLengths: outputRun.byteLengths }
        : null,
      deltaCount: deriveAll('count', deltaTexts, (xs) => xs.length),
      tokensPerDelta,
      eventsPerRead: reads,
      chosenNotListed: deriveAll('count', tokens.map((t) => t.chosenRank), (ranks) => ranks.filter((r) => r === null).length),
    },
  };
}

function histogram(values: readonly number[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

function countBy(values: readonly number[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return m;
}

function usageFacts(end: EndEventV1 | undefined): UsageFacts | null {
  const u = end?.usage;
  if (!u) return null;
  return {
    inputTokens: recordedWith(PROV.usage.inputTokens, u.inputTokens),
    cachedInputTokens: recordedWith(PROV.usage.cachedInputTokens, u.cachedInputTokens),
    cacheWriteTokens: u.cacheWriteTokens === null ? null : recordedWith(PROV.usage.cacheWriteTokens, u.cacheWriteTokens),
    outputTokens: recordedWith(PROV.usage.outputTokens, u.outputTokens),
    reasoningTokens: recordedWith(PROV.usage.reasoningTokens, u.reasoningTokens),
    totalTokens: recordedWith(PROV.usage.totalTokens, u.totalTokens),
  };
}

const moment = <T extends number>(p: ReturnType<typeof recordedProv>, value: T | undefined) =>
  value === undefined ? null : recordedWith(p, value);

function between<T extends number>(a: Sourced<T, 'recorded'> | null, b: Sourced<T, 'recorded'> | null) {
  return a && b ? derive('duration', [a, b], (x, y) => y - x) : null;
}

function timingFacts(s: Scan, providerTokens: number): TimingFacts {
  const firstTextDelta = s.deltas.find((d) => d.ev.channel === 'text' && d.ev.text.length > 0);
  const textDeltas = s.deltas.filter((d) => d.ev.channel === 'text');
  const lastTextDelta = textDeltas.at(-1);
  const browser = {
    requestSent: moment(PROV.browserTime('request sent'), s.requestSent?.tc),
    responseHeaders: moment(PROV.browserTime('response headers received'), s.httpOk?.tc),
    start: moment(PROV.browserTime('start event received'), s.start?.tc),
    firstText: moment(PROV.browserTime('first text received'), firstTextDelta?.tc),
    lastEvent: moment(PROV.browserTime('last event received'), s.lastTc ?? undefined),
  };
  const server = {
    start: moment(PROV.serverTime('start sent'), s.start?.ev.t),
    upstreamOpen: moment(PROV.serverTime('OpenAI stream opened'), s.upstreamOpen?.ev.t),
    responseCreated: moment(PROV.serverTime('response.created received'), s.created?.ev.t),
    firstText: moment(PROV.serverTime('first text received from OpenAI'), firstTextDelta?.ev.t),
    end: moment(PROV.serverTime('end sent'), s.end?.ev.t),
  };
  const moderation = s.start?.ev.moderation;
  const modStart = moment(PROV.serverTime('moderation started'), moderation ? (moderation.startedAt as ServerMs) : undefined);
  const modEnd = moment(PROV.serverTime('moderation finished'), moderation ? (moderation.endedAt as ServerMs) : undefined);
  const lastServerText = moment(PROV.serverTime('last text received from OpenAI'), lastTextDelta?.ev.t);
  const firstBrowser = browser.firstText;
  const lastBrowser = moment(PROV.browserTime('last text received'), lastTextDelta?.tc);
  const deliveryRate =
    firstBrowser && lastBrowser && providerTokens > 1 && read(lastBrowser) > read(firstBrowser)
      ? derive('delivery-rate', [firstBrowser, lastBrowser], (a, b) => ((providerTokens - 1) * 1000) / (b - a))
      : null;
  return {
    browser,
    server,
    durations: {
      browserToFirstText: between(browser.requestSent, browser.firstText),
      browserTotal: between(browser.requestSent, browser.lastEvent),
      serverModeration: between(modStart, modEnd),
      serverToUpstreamOpen: between(server.start, server.upstreamOpen),
      serverCreatedToFirstText: between(server.responseCreated, server.firstText),
      serverFirstToLastText: between(server.firstText, lastServerText),
    },
    deliveryRate,
  };
}

function costFacts(
  req: RequestFacts | null,
  usage: UsageFacts | null,
  output: OutputFacts,
  start: StartEventV1 | undefined,
): FinalizedTrace['cost'] {
  if (!req) return null;
  const r = req.reference;
  if (usage) {
    const cacheWrite = usage.cacheWriteTokens ?? derive('count', [], () => 0);
    const usd = derive(
      'cost-from-usage',
      [usage.inputTokens, usage.cachedInputTokens, cacheWrite, usage.outputTokens, r.inputPricePerMTokUsd, r.cachedInputPricePerMTokUsd, r.cacheWritePricePerMTokUsd, r.outputPricePerMTokUsd],
      (input, cached, written, out, pIn, pCached, pWrite, pOut) =>
        (Math.max(0, input - cached - written) * pIn + cached * pCached + written * pWrite + out * pOut) / 1e6,
    );
    return { usd, basis: 'usage' };
  }
  const allowance = start?.limits.stopAllowanceTokens ?? 0;
  const usd = derive(
    'cost-estimate',
    [req.context.estimatedInputTokens, output.providerTokenCount, r.inputPricePerMTokUsd, r.outputPricePerMTokUsd],
    (input, relayed, pIn, pOut) => (input * pIn + (relayed + allowance) * pOut) / 1e6,
    { assumptions: `input billed in full, plus ${allowance} output tokens that may have been generated but not relayed` },
  );
  return { usd, basis: 'estimate' };
}

export function finalizeTrace(log: TraceLogV1): FinalizedTrace {
  const s = scan(log);
  const { outcome, stopReason, interruption, error } = outcomeOf(s);
  const start = s.start?.ev;
  const end = s.end?.ev;
  const request = start ? requestFacts(start) : null;
  const logprobsRequested = start ? start.settings.topLogprobs !== null : (s.requestSent?.logprobs ?? false);
  const { facts: output, anomalies } = outputFacts(s, logprobsRequested);
  const usage = usageFacts(end);
  const timing = timingFacts(s, output.tokens.length);

  if (s.outOfOrder) anomalies.push('out_of_order_events');
  if (s.unknownEvents > 0) anomalies.push('unknown_events_skipped');

  const lines = reconcile({ request, output, usage, end: end ?? null });
  for (const line of lines) {
    if (line.status !== 'mismatch') continue;
    if (line.id === 'text_vs_final') anomalies.push('text_mismatch');
    if (line.id === 'relay_hash') anomalies.push('relay_hash_mismatch');
  }

  const closeCallInputs = output.tokens.map((t) => ({
    index: t.index,
    text: read(t.text),
    chosenPct: read(t.pct),
    topPcts: t.alternatives.map((a) => read(a.pct)),
    rank: read(t.chosenRank),
  }));
  const closeCalls = deriveAll(
    'close-call',
    output.tokens.map((t) => t.logprob),
    () => (output.source === 'provider' || output.source === 'provider_with_gaps' ? findCloseCalls(closeCallInputs) : { all: [], featured: [] }),
  );

  const relayOk = lines.find((l) => l.id === 'relay_hash')?.status === 'match';
  const signable = end !== undefined && (end.outcome === 'completed' || end.outcome === 'incomplete') && relayOk;

  return {
    turnId: log.turnId,
    userMessageId: log.userMessageId,
    outcome,
    stopReason,
    interruption,
    incompleteReason: end?.incompleteReason ? recordedWith(PROV.incompleteReason, end.incompleteReason) : null,
    error,
    request,
    model: s.created ? recordedWith(PROV.model, s.created.ev.model) : null,
    output,
    usage,
    timing,
    reasoningGate: usage ? derive('reasoning-gate', [usage.reasoningTokens], (r) => r === 0) : null,
    reconciliation: lines,
    closeCalls,
    cost: costFacts(request, usage, output, start),
    ledger: end ? recordedWith(PROV.ledger, end.ledger) : null,
    toolCallsReturned: derive(
      'count',
      [recordedWith(PROV.outputItemTypes, end?.outputItemTypes ?? [])],
      (types) => types.filter((t) => t !== 'message' && t !== 'reasoning').length,
    ),
    anomalies: [...new Set(anomalies)],
    assistant: { messageId: start?.assistantMessageId ?? null, sig: signable ? (end?.assistantSig ?? null) : null },
  };
}
