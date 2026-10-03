import fc from 'fast-check';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { CLAIMS } from '@/content/claims';
import { createChatHandler } from '@/server/chat/handler';
import { read } from '@/shared/provenance/read';
import { plainText, wordCount } from '@/shared/sourced-text';
import { body, fixtureUpstream, hello, KEYS, makeDeps, NOW, post, readStream, type Msg } from '@/test/chat-harness';
import { signReply } from '@/server/signing/signing';
import { finalizeTrace } from '@/trace/finalize';
import type { FinalizedTrace } from '@/trace/facts';
import type { TraceLogV1 } from '@/trace/log';

import { compileScript } from './compile/compile';
import { fitDurations, PACING, readingMs } from './compile/pacing';
import { createPlaybackController } from './controller';
import { initialState, reduce, STEP_ANIMATION_MS, type PlaybackState } from './machine';
import type { PlaybackScript } from './types';

let basic: FinalizedTrace;
let unicode: FinalizedTrace;
let followup: FinalizedTrace;

async function record(name: string, messages: Msg[] = hello): Promise<TraceLogV1> {
  const { upstream } = fixtureUpstream(name);
  const { deps, runAfter } = makeDeps(upstream);
  const res = await createChatHandler(deps)(post(body(messages)));
  const { log } = await readStream(res);
  await runAfter();
  return log;
}

beforeAll(async () => {
  basic = finalizeTrace(await record('stream-basic'));
  unicode = finalizeTrace(await record('stream-unicode'));
  const q = hello[0]?.content ?? '';
  const reply = 'Sunlight scatters.';
  const sig = signReply(KEYS, { conversationId: 'cnv_00000001', messageId: 'msg_00000002', previousUserText: q, text: reply }, NOW / 1000 - 60);
  followup = finalizeTrace(
    await record('stream-basic', [
      { role: 'user', id: 'msg_00000001', content: q },
      { role: 'assistant', id: 'msg_00000002', content: reply, sig },
      { role: 'user', id: 'msg_00000003', content: 'Why is it red at sunset?' },
    ]),
  );
});

const compiled = (trace: FinalizedTrace, depth: 'simple' | 'detailed' | 'technical' = 'simple'): PlaybackScript => {
  const r = compileScript(trace, { depth });
  if (!r.ok) throw new Error(`compile failed: ${r.reason}`);
  return r.script;
};

describe('pacing', () => {
  it('keeps every step at or above its minimum and the total within the cap when it can', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ baseMs: fc.integer({ min: 200, max: 20_000 }), compressible: fc.boolean() }), { minLength: 1, maxLength: 40 }),
        (raw) => {
          const steps = raw.map((s) => ({ ...s, minMs: Math.round(s.baseMs * 0.6) }));
          const out = fitDurations(steps);
          out.forEach((ms, i) => expect(ms).toBeGreaterThanOrEqual((steps[i]?.minMs ?? 0) - 1));
          const minTotal = steps.reduce((n, s) => n + s.minMs, 0);
          const total = out.reduce((a, b) => a + b, 0);
          expect(total).toBeLessThanOrEqual(Math.max(PACING.capMs, minTotal) + steps.length);
          if (steps.reduce((n, s) => n + s.baseMs, 0) <= PACING.targetMs) expect(out).toEqual(steps.map((s) => s.baseMs));
        },
      ),
    );
  });
});

describe('compileScript', () => {
  it.each([null, 12, 'absent_usage'] as const)('requires confirmed zero hidden reasoning (reported count: %s)', async (count) => {
    const log = await record('stream-basic');
    const entries = log.entries.map((e) => e.k === 'server' && e.ev.type === 'end' && e.ev.usage
      ? { ...e, ev: { ...e.ev, usage: count === 'absent_usage' ? null : { ...e.ev.usage, reasoningTokens: count } } } : e);
    const trace = finalizeTrace({ ...log, entries });
    expect(trace.reasoningGate && read(trace.reasoningGate)).toBe(count === 12 ? false : null);
    const result = compileScript(trace, { depth: 'simple' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe(count === 12 ? 'hidden_reasoning' : 'unknown_reasoning');
  });

  it('builds the chapters in order, within the cap', () => {
    const script = compiled(basic);
    expect(script.chapters.map((c) => c.id)).toEqual(['hook', 'context', 'tokenize', 'network', 'options', 'pick', 'loop']);
    expect(script.totalMs).toBeLessThanOrEqual(PACING.capMs);
    expect(script.totalMs).toBeGreaterThan(60_000);
  });

  it('never plays a step faster than its caption can be read', () => {
    for (const depth of ['simple', 'detailed'] as const) {
      const script = compiled(basic, depth);
      for (const step of script.steps) {
        if (step.scene.view === 'montage' && step.scene.key !== 'loop:montage:0') continue;
        const words = wordCount(step.scene.copy.body) + (depth === 'detailed' && step.scene.copy.detail ? wordCount(step.scene.copy.detail) : 0);
        expect(step.durationMs, step.key).toBeGreaterThanOrEqual(readingMs(words) - 1);
      }
    }
  });

  it('keeps the montage within 8 seconds beyond the time to read its caption', () => {
    const script = compiled(basic);
    const montage = script.steps.filter((s) => s.scene.view === 'montage');
    const first = montage[0];
    const caption = first ? readingMs(wordCount(first.scene.copy.body)) : 0;
    const total = montage.reduce((n, s) => n + s.durationMs, 0);
    expect(total).toBeLessThanOrEqual(PACING.montageMaxMs + caption + 400 * montage.length);
  });

  it('adds the follow-up chapter from the second turn', () => {
    const script = compiled(followup);
    expect(script.chapters.at(-1)?.id).toBe('followup');
  });

  it('pauses at close calls, and never at more than two', () => {
    for (const trace of [basic, unicode, followup]) {
      const script = compiled(trace);
      const pauses = script.steps.filter((s) => s.autoPause);
      expect(pauses.length).toBeLessThanOrEqual(2);
      for (const p of pauses) expect(p.scene.view).toBe('moment');
    }
  });

  it('is pure: no randomness, clock, or network', () => {
    const spies = [
      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random called');
      }),
      vi.spyOn(Date, 'now').mockImplementation(() => {
        throw new Error('Date.now called');
      }),
      vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        throw new Error('fetch called');
      }),
    ];
    try {
      const a = compiled(basic, 'detailed');
      const b = compiled(basic, 'detailed');
      expect(a.steps.map((s) => [s.key, s.durationMs])).toEqual(b.steps.map((s) => [s.key, s.durationMs]));
    } finally {
      spies.forEach((s) => s.mockRestore());
    }
  });

  it('is deterministic (snapshot of steps and timings)', () => {
    const script = compiled(basic);
    expect(script.steps.map((s) => `${s.chapter} ${s.key} ${s.durationMs}${s.autoPause ? ' pause' : ''}`)).toMatchSnapshot();
  });

  it('cites registered claims for every step, and keeps Simple text short', () => {
    for (const trace of [basic, unicode, followup]) {
      for (const step of compiled(trace).steps) {
        expect(step.scene.copy.claims.length, step.key).toBeGreaterThan(0);
        for (const id of step.scene.copy.claims) expect(CLAIMS[id], `${step.key} ${id}`).toBeDefined();
        expect(wordCount(step.scene.copy.body), step.key).toBeLessThanOrEqual(48);
        // Simple depth avoids these terms (docs/PLAN.md §2, "Progressive disclosure").
        const simple = [...step.scene.copy.title, ...step.scene.copy.body].filter((p) => typeof p === 'string').join(' ');
        expect(simple, step.key).not.toMatch(/\b(prefill|decod\w*|logprobs?|autoregressive)\b/i);
      }
    }
  });

  it('marks every step that draws examples, and puts no Example values in the others', () => {
    for (const step of compiled(unicode).steps) {
      const slots = [...step.scene.copy.title, ...step.scene.copy.body].flatMap((p) => (typeof p !== 'string' && p.kind === 'datum' ? [p] : []));
      if (!step.scene.examples) for (const s of slots) expect(s.d.p.kind, step.key).not.toBe('example');
    }
  });

  it('says so, and invents nothing, when OpenAI returned no alternatives for any of the reply', async () => {
    const log = await record('stream-basic');
    const stripped: TraceLogV1 = {
      ...log,
      entries: log.entries.map((e) => (e.k === 'server' && e.ev.type === 'delta' ? { ...e, ev: { ...e.ev, logprobs: [] } } : e)),
    };
    const script = compileScript(finalizeTrace(stripped), { depth: 'simple' });
    expect(script.ok).toBe(true);
    if (!script.ok) return;
    const keys = script.script.steps.map((s) => s.key);
    expect(keys).toContain('options:unavailable');
    expect(keys.some((k) => k === 'hook' || k.startsWith('pick:') || k === 'options:bars')).toBe(false);
    const montage = script.script.steps.find((s) => s.scene.view === 'montage')?.scene;
    expect(montage?.view).toBe('montage');
    if (montage?.view === 'montage') {
      expect(read(montage.total)).toBe(0);
      expect(plainText(montage.copy.body, read as never)).toContain('no alternatives for some text');
    }
  });

  it('never presents segments or scored tokens as a full token count when only part of the reply has alternatives', async () => {
    const log = await record('stream-basic');
    let first = true;
    const entries = log.entries.map((e) => {
      if (e.k !== 'server' || e.ev.type !== 'delta' || !first) return e;
      first = false;
      return { ...e, ev: { ...e.ev, logprobs: [] } };
    });
    const trace = finalizeTrace({ ...log, entries });
    expect(trace.output.segments.some((s) => s.kind === 'gap')).toBe(true);
    const script = compiled(trace);
    const hook = script.steps.find((s) => s.key === 'hook');
    expect(hook && plainText(hook.scene.copy.body, read as never)).toContain('but not for all the text');
    for (const { scene } of script.steps) {
      if (scene.view === 'montage') expect(read(scene.total)).toBe(trace.output.tokens.length);
      expect(wordCount(scene.copy.body)).toBeLessThanOrEqual(48);
    }
  });

  it('keeps the viewer’s place when the depth changes: Detailed only adds steps', () => {
    const simple = compiled(basic, 'simple').steps.map((s) => s.key);
    const detailed = compiled(basic, 'detailed').steps.map((s) => s.key);
    // Every Simple step exists at Detailed depth, in the same order.
    expect(detailed.filter((k) => simple.includes(k))).toEqual(simple);
    expect(detailed).toEqual(expect.arrayContaining(['network:position', 'network:feedforward']));
  });

  it('shows the emoji reply’s gap-free first token and a real options list', () => {
    const script = compiled(unicode);
    const bars = script.steps.find((s) => s.key === 'options:bars');
    expect(bars?.scene.view).toBe('bars');
    if (bars?.scene.view === 'bars') expect(read(bars.scene.options.token.text)).toBe('Hi');
  });
});

describe('machine', () => {
  const script = () => compiled(basic);
  const run = (s: PlaybackState, events: Parameters<typeof reduce>[1][], sc: PlaybackScript) =>
    events.reduce((st, e) => reduce(st, e, sc).state, s);

  it('animates without advancing and ends only on explicit navigation', () => {
    const sc = script();
    let s = reduce(initialState(false), { type: 'animate' }, sc).state;
    expect(s.status).toBe('active');
    const firstDuration = STEP_ANIMATION_MS;
    s = reduce(s, { type: 'tick', dtMs: firstDuration / 2 }, sc).state;
    expect(s.step).toBe(0);
    expect(s.progress).toBeCloseTo(0.5, 5);
    let effects: string[] = [];
    s = reduce(s, { type: 'tick', dtMs: 600_000 }, sc).state;
    expect(s).toMatchObject({ step: 0, progress: 1, status: 'active' });
    for (let i = 0; i < sc.steps.length && s.status !== 'ended'; i += 1) {
      const t = reduce(s, { type: 'next' }, sc);
      s = t.state;
      effects = t.effects.map((e) => e.type);
    }
    expect(s.status).toBe('ended');
    expect(effects).toContain('ended');
  });

  it('holds a close-call moment until Next is pressed', () => {
    const sc = script();
    const moment = sc.steps.find((s) => s.autoPause);
    if (!moment) return;
    let s: PlaybackState = { ...initialState(false), step: moment.index, progress: 0.99 };
    const t = reduce(s, { type: 'tick', dtMs: moment.durationMs }, sc);
    expect(t.state).toMatchObject({ status: 'active', step: moment.index, progress: 1 });
    expect(t.effects).toEqual([{ type: 'stopClock' }]);
    s = reduce(t.state, { type: 'next' }, sc).state;
    expect(s).toMatchObject({ status: 'active', step: moment.index + 1, progress: 0 });
  });

  it('never runs the clock in step mode', () => {
    const sc = script();
    const t = reduce(initialState(true), { type: 'animate' }, sc);
    expect(t.effects).toEqual([{ type: 'stopClock' }]);
    expect(t.state.step).toBe(0);
    expect(t.state.progress).toBe(1);
  });

  it('automatically animates each newly selected step from its start', () => {
    const sc = script();
    let s = run(initialState(false), [{ type: 'next' }], sc);
    expect(s).toMatchObject({ status: 'active', step: 1, progress: 0 });
    const t = reduce(s, { type: 'next' }, sc);
    expect(t.state).toMatchObject({ status: 'active', step: 2, progress: 0 });
    expect(t.effects).toEqual([{ type: 'startClock' }]);
    // Previous also loads the animation from its beginning.
    s = run(t.state, [{ type: 'prev' }], sc);
    expect(s).toMatchObject({ status: 'active', step: 1, progress: 0 });
  });

  it('navigates sections and finishes the current animation when the tab is hidden', () => {
    const sc = script();
    const loop = sc.chapters.find((c) => c.id === 'loop');
    let s = run(initialState(false), [{ type: 'seekChapter', chapter: 'loop' }], sc);
    expect(s.step).toBe(loop?.first);
    s = run(s, [{ type: 'next' }, { type: 'prevChapter' }], sc);
    expect(s.step).toBe(loop?.first);
    s = run(s, [{ type: 'prevChapter' }], sc);
    expect(s.step).toBe(sc.chapters.find((c) => c.id === 'pick')?.first);
    const step = s.step;
    s = run(s, [{ type: 'hidden' }], sc);
    expect(s).toMatchObject({ status: 'active', step, progress: 1 });
  });
});

describe('controller', () => {
  afterEach(() => vi.useRealTimers());

  it('notifies React once per step, never per frame', () => {
    const frames: ((t: number) => void)[] = [];
    let now = 0;
    const controller = createPlaybackController({
      script: compiled(basic),
      stepMode: false,
      clock: { requestFrame: (cb) => frames.push(cb), cancelFrame: () => undefined, now: () => now },
    });
    let renders = 0;
    let progressUpdates = 0;
    controller.subscribe(() => (renders += 1));
    controller.subscribeProgress(() => (progressUpdates += 1));
    controller.dispatch({ type: 'animate' });
    renders = 0;
    // Frames animate the first step, then stop; React never renders per frame.
    for (let i = 0; i < 180; i += 1) {
      now += 1000 / 60;
      frames.shift()?.(now);
    }
    expect(controller.getSnapshot().step).toBe(0);
    expect(renders).toBe(0);
    expect(progressUpdates).toBeGreaterThan(100);
    expect(controller.getProgress()).toBe(1);
    controller.destroy();
  });

  it('keeps the viewer’s step when the script is recompiled', () => {
    const controller = createPlaybackController({
      script: compiled(basic, 'simple'),
      stepMode: true,
      clock: { requestFrame: () => 0, cancelFrame: () => undefined, now: () => 0 },
    });
    controller.dispatch({ type: 'seekChapter', chapter: 'pick' });
    const key = controller.getSnapshot().script.steps[controller.getSnapshot().step]?.key;
    controller.replaceScript(compiled(basic, 'detailed'));
    const after = controller.getSnapshot();
    expect(after.script.steps[after.step]?.key).toBe(key);
    expect(after.script.depth).toBe('detailed');
  });

  it('animates the fallback step when changing depth removes the current step', () => {
    const detailed = compiled(basic, 'detailed');
    const requestFrame = vi.fn(() => 1);
    const controller = createPlaybackController({
      script: detailed,
      stepMode: false,
      clock: { requestFrame, cancelFrame: () => undefined, now: () => 0 },
    });
    controller.dispatch({ type: 'seek', step: detailed.steps.findIndex((s) => s.key === 'network:position') });
    controller.dispatch({ type: 'tick', dtMs: STEP_ANIMATION_MS });
    expect(controller.getProgress()).toBe(1);
    requestFrame.mockClear();
    controller.replaceScript(compiled(basic, 'simple'));
    const snapshot = controller.getSnapshot();
    expect(snapshot.script.steps[snapshot.step]?.chapter).toBe('network');
    expect(controller.getProgress()).toBe(0);
    expect(requestFrame).toHaveBeenCalledOnce();
    controller.destroy();
  });
});
