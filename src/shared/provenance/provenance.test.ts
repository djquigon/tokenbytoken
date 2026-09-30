import { describe, expect, it } from 'vitest';

import { asWhatIf, derive, deriveAll, illustrate } from './combine';
import { rootSources, sourceLine } from './describe';
import { recorded, reference } from './mint';
import { kindOf, read } from './read';

const logprob = recorded({ via: 'reported', by: 'openai', field: 'delta.logprobs[].logprob' }, -0.5);
const price = reference({ doc: { title: 'OpenAI pricing', url: 'https://example.test/pricing', retrieved: '2026-09-30' } }, 0.1);

describe('derive', () => {
  it('turns Recorded inputs into a Calculated value with its sources', () => {
    const pct = derive('pct-from-logprob', [logprob], (lp) => Math.exp(lp) * 100);
    expect(kindOf(pct)).toBe('calculated');
    expect(read(pct)).toBeCloseTo(60.65, 2);
    expect(rootSources(pct.p)).toEqual([logprob.p]);
  });

  it('makes Recorded plus Reference Calculated, citing both', () => {
    const tokens = recorded({ via: 'reported', by: 'openai', field: 'usage.output_tokens' }, 1000);
    const cost = derive('cost-from-usage', [tokens, price], (n, perM) => (n * perM) / 1e6);
    expect(kindOf(cost)).toBe('calculated');
    expect(rootSources(cost.p)).toHaveLength(2);
  });

  it('lets any Example input make the result an Example', () => {
    const example = illustrate('attention-previous-token', 'seed-1', [], () => 0.3);
    const mixed = derive('difference', [logprob, example], (a, b) => a - b);
    expect(kindOf(mixed)).toBe('example');
    const chained = derive('pct-from-logprob', [mixed], (x) => x * 2);
    expect(kindOf(chained)).toBe('example');
  });

  it('propagates What-if and never drops it', () => {
    const hypothetical = asWhatIf(logprob);
    expect(derive('pct-from-logprob', [hypothetical], (x) => x).whatIf).toBe(true);
    expect(derive('pct-from-logprob', [logprob], (x) => x).whatIf).toBeUndefined();
  });

  it('dedupes repeated sources in aggregates', () => {
    const p = { via: 'reported', by: 'openai', field: 'delta.logprobs[].logprob' } as const;
    const many = Array.from({ length: 200 }, (_, i) => recorded(p, -i / 100));
    const sum = deriveAll('count', many, (xs) => xs.length);
    expect(read(sum)).toBe(200);
    expect(sum.p.kind === 'calculated' && sum.p.from.length).toBe(1);
  });
});

describe('source lines', () => {
  it('uses the required wording for each label', () => {
    expect(sourceLine(logprob.p)).toBe('Reported by OpenAI');
    expect(sourceLine(recorded({ via: 'measured', clock: 'server', field: 't' }, 1).p)).toBe('Measured by this app (server)');
    expect(sourceLine(recorded({ via: 'sent', field: 'temperature' }, 1).p)).toBe('Sent by this app');
    expect(sourceLine(price.p)).toBe('OpenAI pricing, retrieved 2026-09-30');
    expect(sourceLine(reference({ general: true }, 'x').p)).toBe(
      'General: true of standard transformer models; not confirmed for this model',
    );
  });
});
