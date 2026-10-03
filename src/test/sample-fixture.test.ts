// The recorded sample conversation and the recorded "fluent but wrong" case (fixtures/sample/, written by
// scripts/record-sample.mts) must stay valid, complete, and free of session secrets.

import { describe, expect, it } from 'vitest';

import wrongCase from '../../fixtures/sample/fluent-case.json';
import sample from '../../fixtures/sample/conversation.json';
import { CONVERSATION_KEY, loadConversation } from '@/generation/persist';
import { compileScript } from '@/playback/compile/compile';
import { read } from '@/shared/provenance/read';
import { recordedWrongCase } from '@/stages/deep-dives';
import { finalizeTrace } from '@/trace/finalize';
import { traceLogSchema } from '@/trace/log';

const storage = (value: unknown) => ({ getItem: (k: string) => (k === CONVERSATION_KEY ? JSON.stringify(value) : null), setItem: () => undefined, removeItem: () => undefined });

describe('recorded sample conversation', () => {
  const restored = loadConversation(storage(sample.conversation));

  it('restores through the same validation as a tab’s own conversation', () => {
    expect(restored?.turns).toHaveLength(2);
  });

  it('is two complete replies, with the same single-response chapter sequence for the second', () => {
    const traces = (restored?.turns ?? []).map((t) => (t.log ? finalizeTrace(t.log) : null));
    for (const trace of traces) {
      expect(trace).not.toBeNull();
      if (!trace) continue;
      expect(read(trace.outcome)).toBe('completed');
      expect(trace.reasoningGate && read(trace.reasoningGate)).toBe(true);
      expect(trace.output.source).toMatch(/^provider/);
      expect(trace.anomalies).toEqual([]);
    }
    const second = traces[1];
    if (!second) throw new Error('missing second turn');
    const compiled = compileScript(second, { depth: 'simple' });
    expect(compiled.ok && compiled.script.chapters.map((c) => c.id)).toEqual(['context', 'input', 'generation', 'ending', 'review']);
    expect(second.request?.inputRuns.filter((run) => run.role !== 'instructions').length).toBeGreaterThan(1);
  });

  it('carries no reply signatures', () => {
    const text = JSON.stringify(sample);
    expect(text).not.toMatch(/"sig":"v1\./);
    expect(text).not.toMatch(/"assistantSig":"v1\./);
  });
});

describe('recorded wrong case', () => {
  it('shows a wrong count as the top option, with the right count computed from the question', () => {
    const log = traceLogSchema.parse(wrongCase.conversation.turns[0]?.log);
    const facts = recordedWrongCase(finalizeTrace(log));
    expect(facts).not.toBeNull();
    if (!facts) return;
    expect(read(facts.count)).toBe(wrongCase.check.count);
    expect(Number(read(facts.top).trim())).not.toBe(read(facts.count));
    expect(read(facts.topPct)).toBeGreaterThanOrEqual(50);
    expect(facts.count.p.kind).toBe('calculated');
    expect(facts.top.p.kind).toBe('recorded');
  });
});
