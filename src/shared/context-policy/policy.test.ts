import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { applyContextPolicy, estimateInputTokens, type ContextBudget, type PolicyMessage } from './policy';

const budget: ContextBudget = { inputBudgetTokens: 100, maxTurns: 12, overhead: { perRequest: 1, perMessage: 5 } };

const conversation = (tokens: number[]): PolicyMessage[] =>
  tokens.map((t, i) => ({ id: `m${i}`, role: i % 2 === 0 ? 'user' : 'assistant', tokens: t }));

describe('applyContextPolicy', () => {
  it('sends everything when it fits', () => {
    const r = applyContextPolicy({ instructionsTokens: 10, messages: conversation([5, 5, 5]) }, budget);
    expect(r).toEqual({ ok: true, included: ['m0', 'm1', 'm2'], dropped: [], estimatedInputTokens: 1 + 15 + 3 * 10 });
  });

  it('drops the oldest whole turns first', () => {
    // base: 1 + (10+5) + (20+5) = 41; turn m2+m3 = 50 → 91; turn m0+m1 = 50 → over
    const r = applyContextPolicy({ instructionsTokens: 10, messages: conversation([20, 20, 20, 20, 20]) }, budget);
    expect(r).toMatchObject({ ok: true, included: ['m2', 'm3', 'm4'] });
    if (r.ok) expect(r.dropped).toEqual([{ id: 'm0', reason: 'over_budget' }, { id: 'm1', reason: 'over_budget' }]);
  });

  it('never keeps an older turn in place of a newer one that does not fit', () => {
    // The turn just before the newest is huge; the tiny oldest turn must still be dropped.
    const r = applyContextPolicy({ instructionsTokens: 0, messages: conversation([1, 1, 90, 90, 1]) }, budget);
    expect(r).toMatchObject({ ok: true, included: ['m4'] });
  });

  it('fails instead of cutting when the newest message alone does not fit', () => {
    const r = applyContextPolicy({ instructionsTokens: 10, messages: conversation([200]) }, budget);
    expect(r).toEqual({ ok: false, reason: 'context_too_long', estimatedInputTokens: 1 + 15 + 205 });
  });

  it('enforces the turn limit', () => {
    const r = applyContextPolicy(
      { instructionsTokens: null, messages: conversation([1, 1, 1, 1, 1]) },
      { ...budget, maxTurns: 2 },
    );
    expect(r).toMatchObject({ ok: true, included: ['m2', 'm3', 'm4'] });
    if (r.ok) expect(r.dropped.map((d) => d.reason)).toEqual(['turn_limit', 'turn_limit']);
  });

  it('groups consecutive user messages (stopped replies are not re-sent) as separate turns', () => {
    const messages: PolicyMessage[] = [
      { id: 'u1', role: 'user', tokens: 1 },
      { id: 'u2', role: 'user', tokens: 1 },
      { id: 'a2', role: 'assistant', tokens: 1 },
      { id: 'u3', role: 'user', tokens: 1 },
    ];
    const r = applyContextPolicy({ instructionsTokens: null, messages }, { ...budget, maxTurns: 2 });
    expect(r).toMatchObject({ ok: true, included: ['u2', 'a2', 'u3'] });
  });

  it('matches the Phase 0 calibration for a single message', () => {
    // gpt-6-luna: reported ≈ local + ~1 per request + ~5 per message ("en-question": 7 local → 13 reported).
    expect(estimateInputTokens(null, [7], { perRequest: 1, perMessage: 5 })).toBe(13);
  });

  it('holds its invariants for any conversation', () => {
    const arbConversation = fc
      .array(fc.record({ role: fc.constantFrom('user' as const, 'assistant' as const), tokens: fc.nat(60) }), {
        maxLength: 30,
      })
      .chain((earlier) =>
        fc.nat(80).map((last) =>
          [...earlier, { role: 'user' as const, tokens: last }].map((m, i) => ({ ...m, id: `m${i}` })),
        ),
      );
    fc.assert(
      fc.property(
        arbConversation,
        fc.option(fc.nat(40), { nil: null }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 20, max: 300 }),
        (messages, instructionsTokens, maxTurns, inputBudgetTokens) => {
          const b: ContextBudget = { ...budget, maxTurns, inputBudgetTokens };
          const r = applyContextPolicy({ instructionsTokens, messages }, b);
          const newest = messages.at(-1);
          if (!newest) return;
          if (!r.ok) {
            // Only when the instructions plus the newest message alone are over budget.
            expect(estimateInputTokens(instructionsTokens, [newest.tokens], b.overhead)).toBeGreaterThan(inputBudgetTokens);
            return;
          }
          // The newest message is always sent, and what is kept is a contiguous suffix.
          expect(r.included.at(-1)).toBe(newest.id);
          const ids = messages.map((m) => m.id);
          expect(r.included).toEqual(ids.slice(ids.length - r.included.length));
          expect([...r.dropped.map((d) => d.id), ...r.included]).toEqual(ids);
          // Within budget and turn limits, and the estimate is what was counted.
          const kept = messages.filter((m) => r.included.includes(m.id));
          expect(r.estimatedInputTokens).toBe(estimateInputTokens(instructionsTokens, kept.map((m) => m.tokens), b.overhead));
          expect(r.estimatedInputTokens).toBeLessThanOrEqual(inputBudgetTokens);
          expect(kept.filter((m) => m.role === 'user').length).toBeLessThanOrEqual(maxTurns);
          // A kept run never starts with a reply whose user message was dropped.
          if (r.dropped.length > 0) expect(kept[0]?.role).toBe('user');
        },
      ),
    );
  });
});
