import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { chancesAt } from './what-if';

describe('temperature what-if', () => {
  it('at temperature 1 matches the listed chances, renormalized', () => {
    const pcts = [60, 30, 5];
    const got = chancesAt(pcts.map((p) => Math.log(p / 100)), 1);
    const total = pcts.reduce((a, b) => a + b, 0);
    got.forEach((g, i) => expect(g).toBeCloseTo(((pcts[i] ?? 0) / total) * 100, 9));
  });

  it('always sums to 100 and keeps the order; lower temperature sharpens, higher spreads', () => {
    fc.assert(
      fc.property(fc.array(fc.double({ min: -30, max: 0, noNaN: true }), { minLength: 2, maxLength: 20 }), (ls) => {
        const sorted = [...ls].sort((a, b) => b - a);
        for (const t of [0.2, 0.7, 1, 1.2]) {
          const c = chancesAt(sorted, t);
          expect(c.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
          for (let i = 1; i < c.length; i += 1) expect(c[i]).toBeLessThanOrEqual((c[i - 1] ?? 0) + 1e-9);
        }
        const [top1 = 0] = chancesAt(sorted, 1);
        const [topCold = 0] = chancesAt(sorted, 0.5);
        const [topWarm = 0] = chancesAt(sorted, 1.2);
        expect(topCold).toBeGreaterThanOrEqual(top1 - 1e-9);
        expect(topWarm).toBeLessThanOrEqual(top1 + 1e-9);
      }),
    );
  });
});

describe('simulated picks', () => {
  it('draws exactly n picks, only among options with a chance, following the weights', async () => {
    const { simulatePicks, pickChances } = await import('./what-if');
    let seed = 1;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const counts = simulatePicks([70, 20, 10, 0], 2_000, random);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(2_000);
    expect(counts[3]).toBe(0);
    expect(counts[0]).toBeGreaterThan(counts[1] ?? 0);
    expect(counts[1]).toBeGreaterThan(counts[2] ?? 0);
    // At temperature zero every pick is the top option.
    expect(simulatePicks(pickChances([-0.5, -1, -2], 0), 20, random)).toEqual([20, 0, 0]);
  });
});
