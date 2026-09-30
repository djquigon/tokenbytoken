// Phase 0 capability probe (docs/PLAN.md §4). Runs fixed prompts against each candidate model
// in cost order, records sanitized fixtures, and writes a capability report that names the
// cheapest candidate passing every automatic check.
//
//   npm run probe                                  # every candidate
//   npm run probe -- --models=gpt-6-luna           # a subset (comma-separated)
//   npm run probe -- --skip-quality --max-usd=0.10 # cheaper run
//   npm run probe -- --stop-at-first-pass
//
// Needs OPENAI_API_KEY (read from .env.local). Spends a few cents. Never run it in CI.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { encode } from 'gpt-tokenizer/encoding/o200k_base';

import {
  alternativesPerToken,
  analyzeFirstPosition,
  chosenOutsideAlternatives,
  costUsd,
  distribution,
  fitOverhead,
  histogram,
  logprobCoverage,
  roundTrip,
  type FinalLogprob,
  type FirstPositionRun,
  type OverheadSample,
} from './analysis.mts';
import {
  createCall,
  doneText,
  makeClient,
  streamCall,
  streamedLogprobs,
  textDeltas,
  tokensPerDelta,
  type ApiFailure,
  type CallSettings,
  type CreateRecord,
  type StreamRecord,
  type Usage,
} from './api.mts';
import { CANDIDATES, PRICE_SOURCE, PRICE_TABLE_DATE, type Candidate } from './candidates.mts';
import {
  APP_INSTRUCTIONS,
  CACHE_INSTRUCTIONS,
  CALIBRATION_SAMPLES,
  FIRST_POSITION_PROMPT,
  LONG_PROMPT,
  QUALITY_PROMPTS,
  STREAM_PROMPT,
  UNICODE_PROMPT,
  type CalibrationSample,
} from './prompts.mts';
import { renderQuality, renderReport, type CheckResult, type ModelResult, type RunMeta } from './report.mts';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const CONCURRENCY = 4;
const MIN_MEDIAN_ALTERNATIVES = 15;
const MIN_ROUND_TRIP = 0.99;
const MIN_DAYS_BEFORE_RETIREMENT = 180;

/** User text can contain special-token strings; always count them as ordinary text. */
const localTokens = (text: string) => encode(text, { disallowedSpecial: new Set() });
const countText = (text: string) => localTokens(text).length;

interface Budget {
  spent: number;
  max: number;
}

class FatalProbeError extends Error {}

function writeJson(relativePath: string, data: unknown): void {
  const path = join(REPO_ROOT, relativePath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function writeText(relativePath: string, text: string): void {
  const path = join(REPO_ROOT, relativePath);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text.endsWith('\n') ? text : `${text}\n`);
}

function packageVersion(name: string): string {
  const raw: unknown = JSON.parse(readFileSync(join(REPO_ROOT, 'node_modules', name, 'package.json'), 'utf8'));
  return typeof raw === 'object' && raw !== null && 'version' in raw && typeof raw.version === 'string' ? raw.version : 'unknown';
}

async function mapLimit<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let next = 0;
  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const isNumber = (n: number | null): n is number => n !== null;

function isUnavailable(error: ApiFailure | undefined): boolean {
  if (!error) return false;
  return error.status === 404 || error.code === 'model_not_found' || (error.status === 403 && /model/i.test(error.message));
}

function assertNotFatal(error: ApiFailure | undefined): void {
  if (!error) return;
  if (error.status === 401) throw new FatalProbeError('Authentication failed. Check OPENAI_API_KEY in .env.local.');
  if (error.code === 'insufficient_quota' || /spend limit|quota/i.test(error.message)) {
    throw new FatalProbeError(`OpenAI refused on quota or spend limits: ${error.message}`);
  }
}

function retirementCheck(candidate: Candidate, today: string): CheckResult {
  if (candidate.shutdown === null) {
    return { pass: true, detail: `No shutdown date listed as of ${PRICE_TABLE_DATE}.` };
  }
  const days = Math.round((Date.parse(candidate.shutdown) - Date.parse(today)) / 86_400_000);
  return { pass: days >= MIN_DAYS_BEFORE_RETIREMENT, detail: `Shuts down ${candidate.shutdown} (${days} days away).` };
}

function fmtFailure(error: ApiFailure | undefined): string {
  return error ? `${error.status ?? ''} ${error.code ?? ''} ${error.message}`.trim() : 'no terminal response';
}

async function probeModel(
  client: ReturnType<typeof makeClient>,
  c: Candidate,
  opts: { date: string; skipQuality: boolean },
  budget: Budget,
): Promise<ModelResult> {
  const fixtureDir = `fixtures/probe/${c.id}`;
  const usages: Usage[] = [];
  let calls = 0;
  let spent = 0;
  let skippedForBudget = false;

  function track<T extends StreamRecord | CreateRecord>(record: T): T {
    calls += 1;
    const usage = record.final?.usage;
    if (usage) {
      usages.push(usage);
      const cost = costUsd(usage, c.price);
      spent += cost;
      budget.spent += cost;
    }
    assertNotFatal(record.error);
    return record;
  }
  const canSpend = (): boolean => {
    if (budget.spent < budget.max) return true;
    skippedForBudget = true;
    return false;
  };
  const log = (step: string, ok: boolean, extra = '') => console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${step}${extra ? ` (${extra})` : ''}`);

  // 1. Streamed logprobs at top_logprobs=20. On failure, retry at 5 and then without logprobs,
  //    to tell "20 is too many" apart from "no logprobs" and from "model unusable".
  const base: CallSettings = { instructions: APP_INSTRUCTIONS, input: STREAM_PROMPT, maxOutputTokens: 200, temperature: 1, topP: 1 };
  let topLogprobsUsed: number | null = 20;
  let basic = track(await streamCall(client, c, { ...base, topLogprobs: 20 }));
  log('stream with top_logprobs=20', basic.ok, basic.ok ? '' : fmtFailure(basic.error));
  if (!basic.ok && isUnavailable(basic.error)) {
    return unavailable(c, basic.error ?? null, calls);
  }
  if (!basic.ok) {
    const at5 = track(await streamCall(client, c, { ...base, topLogprobs: 5 }));
    log('stream with top_logprobs=5', at5.ok, at5.ok ? '' : fmtFailure(at5.error));
    if (at5.ok) {
      basic = at5;
      topLogprobsUsed = 5;
    } else {
      const plain = track(await streamCall(client, c, base));
      log('stream without logprobs', plain.ok, plain.ok ? '' : fmtFailure(plain.error));
      topLogprobsUsed = null;
      if (plain.ok) basic = plain;
    }
  }
  writeJson(`${fixtureDir}/stream-basic.json`, basic);
  const withLogprobs = (s: CallSettings): CallSettings => (topLogprobsUsed === null ? s : { ...s, topLogprobs: topLogprobsUsed });

  // 2. Emoji, ZWJ sequences, CJK, and RTL text in the output, for byte-level alignment fixtures.
  let unicode: StreamRecord | null = null;
  if (canSpend()) {
    unicode = track(await streamCall(client, c, withLogprobs({ input: UNICODE_PROMPT, maxOutputTokens: 60, temperature: 1, topP: 1 })));
    log('unicode stream', unicode.ok, unicode.ok ? '' : fmtFailure(unicode.error));
    writeJson(`${fixtureDir}/stream-unicode.json`, unicode);
  }

  // 3. Output position 1 under different sampling settings (identical context every time).
  const fpPlan = [
    { label: 'T=1', temperature: 1, topP: 1 },
    { label: 'T=1 (repeat)', temperature: 1, topP: 1 },
    { label: 'T=0', temperature: 0, topP: 1 },
    { label: 'T=0.7', temperature: 0.7, topP: 1 },
    { label: 'T=1.5', temperature: 1.5, topP: 1 },
    { label: 'T=1, top_p=0.1', temperature: 1, topP: 0.1 },
  ];
  const firstPosition: { label: string; temperature: number; topP: number; record: CreateRecord }[] = [];
  for (const step of fpPlan) {
    if (!canSpend()) break;
    const record = track(
      await createCall(client, c, withLogprobs({ input: FIRST_POSITION_PROMPT, maxOutputTokens: 16, temperature: step.temperature, topP: step.topP })),
    );
    firstPosition.push({ ...step, record });
    log(`first position ${step.label}`, record.ok, record.ok ? '' : fmtFailure(record.error));
  }
  writeJson(`${fixtureDir}/first-position.json`, firstPosition);

  // 4. A tiny output limit should end as `incomplete` / `max_output_tokens`.
  let incomplete: CreateRecord | null = null;
  if (canSpend()) {
    incomplete = track(await createCall(client, c, { input: LONG_PROMPT, maxOutputTokens: 16, temperature: 1, topP: 1 }));
    log('tiny output limit', incomplete.ok, incomplete.final ? `${incomplete.final.status}/${incomplete.final.incompleteReason}` : fmtFailure(incomplete.error));
    writeJson(`${fixtureDir}/incomplete.json`, incomplete);
  }

  // 5. The same long instructions twice: does the second call report cached tokens?
  const cacheRecords: CreateRecord[] = [];
  for (let i = 0; i < 2 && canSpend(); i += 1) {
    cacheRecords.push(track(await createCall(client, c, { instructions: CACHE_INSTRUCTIONS, input: 'Reply with OK.', maxOutputTokens: 16, temperature: 1, topP: 1 })));
  }
  log('prompt caching pair', cacheRecords.every((r) => r.ok));
  writeJson(`${fixtureDir}/cache.json`, cacheRecords);

  // 6. Local token counts vs. the count OpenAI reports, across message shapes and scripts.
  const calibration = await mapLimit(CALIBRATION_SAMPLES, CONCURRENCY, async (sample: CalibrationSample) => {
    if (!canSpend()) return { sample, record: null };
    const record = track(
      await createCall(client, c, {
        ...(sample.instructions !== undefined ? { instructions: sample.instructions } : {}),
        input: sample.messages,
        maxOutputTokens: 16,
        temperature: 1,
        topP: 1,
      }),
    );
    return { sample, record };
  });
  const overheadSamples: OverheadSample[] = calibration.flatMap(({ sample, record }) => {
    const usage = record?.ok ? record.final?.usage : null;
    if (!usage) return [];
    const local = sample.messages.reduce((n, m) => n + countText(m.content), 0) + (sample.instructions ? countText(sample.instructions) : 0);
    return [{ id: sample.id, units: sample.messages.length + (sample.instructions ? 1 : 0), local, reported: usage.input_tokens }];
  });
  log('input-count calibration', overheadSamples.length === CALIBRATION_SAMPLES.length, `${overheadSamples.length}/${CALIBRATION_SAMPLES.length}`);
  writeJson(`${fixtureDir}/calibration.json`, overheadSamples);

  // 7. Representative questions, streamed with logprobs: reply quality plus more token statistics.
  const quality = opts.skipQuality
    ? []
    : await mapLimit(QUALITY_PROMPTS, CONCURRENCY, async (prompt: string) => {
        if (!canSpend()) return { prompt, record: null };
        const record = track(
          await streamCall(client, c, withLogprobs({ instructions: APP_INSTRUCTIONS, input: prompt, maxOutputTokens: 300, temperature: 1, topP: 1 })),
        );
        return { prompt, record };
      });
  const qualityFailures = quality.filter((q) => !q.record?.ok).length;
  if (!opts.skipQuality) log('quality set', qualityFailures === 0, `${quality.length - qualityFailures}/${QUALITY_PROMPTS.length}`);
  writeJson(
    `${fixtureDir}/quality.json`,
    quality.map(({ prompt, record }) => ({
      prompt,
      ok: record?.ok ?? false,
      text: record?.final?.text ?? null,
      usage: record?.final?.usage ?? null,
      timing: record?.timing ?? null,
      error: record?.error ?? null,
    })),
  );
  const qualityFile = opts.skipQuality ? null : `docs/probe/${opts.date}-quality-${c.id}.md`;
  if (qualityFile) {
    writeText(
      qualityFile,
      renderQuality(
        opts.date,
        c.id,
        quality.map(({ prompt, record }) => ({
          prompt,
          text: record?.final?.text ?? null,
          outputTokens: record?.final?.usage?.output_tokens ?? null,
          error: record?.ok ? null : fmtFailure(record?.error),
        })),
      ),
    );
  }

  // Analysis.
  const streams = [basic, unicode, ...quality.map((q) => q.record)].filter(
    (r): r is StreamRecord => r !== null && r.ok,
  );
  const finalTokens: FinalLogprob[] = streams.flatMap((r) => r.final?.logprobs ?? []);
  const basicStreamed = streamedLogprobs(basic);
  const basicDeltas = tokensPerDelta(basic);
  const everyDeltaHasLogprobs = basicDeltas.length > 0 && basicDeltas.every((n) => n >= 1);
  const streamedAlternatives = alternativesPerToken(basicStreamed);
  const basicFinal = basic.final?.logprobs ?? [];
  const finalHasBytes = basicFinal.length > 0 && basicFinal.every((lp) => Array.isArray(lp.bytes) && lp.bytes.length > 0);

  const streamedLogprobsCheck: CheckResult = {
    pass:
      basic.ok &&
      topLogprobsUsed === 20 &&
      everyDeltaHasLogprobs &&
      finalHasBytes &&
      (streamedAlternatives?.median ?? 0) >= MIN_MEDIAN_ALTERNATIVES,
    detail: basic.ok
      ? `top_logprobs=${topLogprobsUsed ?? 'unsupported'}; every text delta carried logprobs: ${everyDeltaHasLogprobs}; final logprobs include bytes: ${finalHasBytes}; median alternatives ${streamedAlternatives?.median ?? 'n/a'} (needs ≥ ${MIN_MEDIAN_ALTERNATIVES}).`
      : `Streaming failed: ${fmtFailure(basic.error)}`,
  };

  const reasoning = usages.map((u) => u.output_tokens_details.reasoning_tokens);
  const reasoningZero: CheckResult = {
    pass: reasoning.length > 0 && reasoning.every((n) => n === 0),
    detail: reasoning.length > 0 ? `Largest reasoning_tokens across ${reasoning.length} calls: ${Math.max(...reasoning)}.` : 'No usage reported.',
  };

  const byLabel = new Map(firstPosition.map((r) => [r.label, r]));
  const samplingLabels = ['T=0.7', 'T=1.5', 'T=1, top_p=0.1'];
  const samplingFailures = samplingLabels.filter((label) => byLabel.get(label)?.record.ok !== true);
  const samplingControls: CheckResult = {
    pass: samplingFailures.length === 0,
    detail:
      samplingFailures.length === 0
        ? 'Requests at T=0.7, T=1.5, and top_p=0.1 all succeeded.'
        : `Failed or skipped: ${samplingFailures.map((label) => `${label} (${fmtFailure(byLabel.get(label)?.record.error)})`).join('; ')}.`,
  };

  const rt = finalTokens.length > 0 ? roundTrip(finalTokens, localTokens) : null;
  const roundTripCheck: CheckResult = {
    pass: rt !== null && rt.rate !== null && rt.rate >= MIN_ROUND_TRIP,
    detail: rt
      ? `${rt.single}/${rt.checkable} checkable output tokens encode to one o200k_base token (needs ≥ ${MIN_ROUND_TRIP * 100}%).`
      : 'No final logprobs to check.',
  };

  const toRun = (label: string): FirstPositionRun | null => {
    const entry = byLabel.get(label);
    const first = entry?.record.ok ? entry.record.final?.logprobs?.[0] : undefined;
    if (!entry || !first) return null;
    return {
      label,
      temperature: entry.temperature,
      topP: entry.topP,
      alternatives: first.top_logprobs.map((alt) => ({ token: alt.token, logprob: alt.logprob })),
    };
  };
  const baseline = toRun('T=1');
  const others = ['T=0', 'T=0.7', 'T=1.5', 'T=1, top_p=0.1'].map(toRun).filter((r): r is FirstPositionRun => r !== null);
  const semantics = baseline ? analyzeFirstPosition(baseline, toRun('T=1 (repeat)'), others) : null;

  const joined = basic.events
    .filter((e) => e.type === 'response.output_text.delta')
    .map((e) => e.delta ?? '')
    .join('');
  const done = doneText(basic);

  // Tokens OpenAI counts in usage.output_tokens but never returns as text (for example, the
  // marker that ends a reply). Only calls where every text delta carried logprobs can be used.
  const withStreamedLogprobs = streams.filter((r) => streamedLogprobs(r).length > 0);
  const fullyCovered = withStreamedLogprobs.filter((r) => logprobCoverage(textDeltas(r)).deltasWithoutLogprobs === 0);
  const hiddenOutputTokens = distribution([
    ...fullyCovered.flatMap((r) => {
      const u = r.final?.usage;
      return u ? [u.output_tokens - u.output_tokens_details.reasoning_tokens - streamedLogprobs(r).length] : [];
    }),
    ...firstPosition.flatMap(({ record }) => {
      const u = record.final?.usage;
      const visible = record.final?.logprobs?.length ?? 0;
      return record.ok && u && visible > 0 ? [u.output_tokens - u.output_tokens_details.reasoning_tokens - visible] : [];
    }),
  ]);
  const finalLogprobs = {
    streams: withStreamedLogprobs.length,
    empty: withStreamedLogprobs.filter((r) => (r.final?.logprobs?.length ?? 0) === 0).length,
    countMismatch: withStreamedLogprobs.filter((r) => (r.final?.logprobs?.length ?? 0) !== streamedLogprobs(r).length).length,
  };

  const checks = {
    streamedLogprobs: streamedLogprobsCheck,
    reasoningZero,
    samplingControls,
    roundTrip: roundTripCheck,
    retirement: retirementCheck(c, opts.date),
  };
  const result: ModelResult = {
    candidate: c,
    available: true,
    resolvedModel: basic.final?.model ?? null,
    error: basic.ok ? null : (basic.error ?? null),
    skippedForBudget,
    checks,
    quality: { file: qualityFile, replies: quality.length - qualityFailures, failures: qualityFailures },
    info: {
      topLogprobsUsed,
      streamedAlternatives,
      finalAlternatives: alternativesPerToken(basicFinal),
      chosenOutside: finalTokens.length > 0 ? chosenOutsideAlternatives(finalTokens) : null,
      tokensPerEvent: histogram(streams.flatMap(tokensPerDelta)),
      textMatchesDone: done === null ? null : joined === done && joined === (basic.final?.text ?? joined),
      hiddenOutputTokens,
      coverage: withStreamedLogprobs.length > 0 ? logprobCoverage(withStreamedLogprobs.flatMap(textDeltas)) : null,
      finalLogprobs,
      roundTrip: rt,
      semantics,
      timing: {
        createdMs: distribution(streams.map((r) => r.timing.createdMs).filter(isNumber)),
        firstTextMs: distribution(streams.map((r) => r.timing.firstTextMs).filter(isNumber)),
        createdToFirstTextMs: distribution(
          streams.flatMap((r) =>
            r.timing.createdMs !== null && r.timing.firstTextMs !== null ? [r.timing.firstTextMs - r.timing.createdMs] : [],
          ),
        ),
      },
      cache: { first: cacheRecords[0]?.final?.usage ?? null, second: cacheRecords[1]?.final?.usage ?? null },
      incomplete: incomplete?.final ? { status: incomplete.final.status, reason: incomplete.final.incompleteReason } : null,
      overhead: fitOverhead(overheadSamples),
      unicodeText: unicode?.final?.text ?? null,
    },
    calls,
    costUsd: spent,
    verdict: Object.values(checks).every((check) => check.pass) ? 'pass' : 'fail',
  };
  writeJson(`${fixtureDir}/result.json`, result);
  return result;
}

function unavailable(c: Candidate, error: ApiFailure | null, calls: number): ModelResult {
  const na: CheckResult = { pass: false, detail: 'Model unavailable to this API key.' };
  return {
    candidate: c,
    available: false,
    resolvedModel: null,
    error,
    skippedForBudget: false,
    checks: { streamedLogprobs: na, reasoningZero: na, samplingControls: na, roundTrip: na, retirement: na },
    quality: { file: null, replies: 0, failures: 0 },
    info: {
      topLogprobsUsed: null,
      streamedAlternatives: null,
      finalAlternatives: null,
      chosenOutside: null,
      tokensPerEvent: {},
      textMatchesDone: null,
      hiddenOutputTokens: null,
      coverage: null,
      finalLogprobs: { streams: 0, empty: 0, countMismatch: 0 },
      roundTrip: null,
      semantics: null,
      timing: { createdMs: null, firstTextMs: null, createdToFirstTextMs: null },
      cache: null,
      incomplete: null,
      overhead: null,
      unicodeText: null,
    },
    calls,
    costUsd: 0,
    verdict: 'unavailable',
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      models: { type: 'string' },
      'max-usd': { type: 'string', default: '0.50' },
      'skip-quality': { type: 'boolean', default: false },
      'stop-at-first-pass': { type: 'boolean', default: false },
    },
  });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set. Add it to .env.local (see .env.example), then run `npm run probe` again.');
    process.exitCode = 1;
    return;
  }
  const wanted = values.models?.split(',').map((m) => m.trim()).filter(Boolean);
  const selected = wanted ? CANDIDATES.filter((c) => wanted.includes(c.id)) : [...CANDIDATES];
  if (selected.length === 0) {
    console.error(`No known candidates in --models. Known: ${CANDIDATES.map((c) => c.id).join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const maxUsd = Number(values['max-usd']);
  const budget: Budget = { spent: 0, max: Number.isFinite(maxUsd) && maxUsd > 0 ? maxUsd : 0.5 };
  const startedAt = new Date().toISOString();
  const date = startedAt.slice(0, 10);
  const client = makeClient(apiKey);
  const results: ModelResult[] = [];

  for (const candidate of selected) {
    console.log(`\n▶ ${candidate.id}`);
    if (budget.spent >= budget.max) {
      console.log('  skipped: budget guard reached');
      break;
    }
    try {
      const result = await probeModel(client, candidate, { date, skipQuality: values['skip-quality'] }, budget);
      results.push(result);
      console.log(`  → ${result.verdict} · $${result.costUsd.toFixed(4)} (run total $${budget.spent.toFixed(4)})`);
      if (values['stop-at-first-pass'] && result.verdict === 'pass') break;
    } catch (err) {
      if (err instanceof FatalProbeError) {
        console.error(`\nStopping: ${err.message}`);
        process.exitCode = 1;
        break;
      }
      throw err;
    }
  }

  const meta: RunMeta = {
    date,
    startedAt,
    node: process.version,
    openaiSdk: packageVersion('openai'),
    gptTokenizer: packageVersion('gpt-tokenizer'),
    priceTableDate: PRICE_TABLE_DATE,
    priceSource: PRICE_SOURCE,
    totalCostUsd: budget.spent,
    maxUsd: budget.max,
  };
  const reportFile = `docs/probe/${date}-capability-report.md`;
  writeText(reportFile, renderReport(meta, results));
  const recommended = results.find((r) => r.verdict === 'pass');
  console.log(`\nReport: ${reportFile}`);
  console.log(recommended ? `Cheapest passing candidate: ${recommended.candidate.id}` : 'No candidate passed every automatic check.');
  console.log(`Estimated cost: $${budget.spent.toFixed(4)}`);
}

await main();
