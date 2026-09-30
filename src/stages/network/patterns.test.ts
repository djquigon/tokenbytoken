import { describe, expect, it } from 'vitest';

import { SAMPLE_REPEAT, SAMPLE_SENTENCE } from '../common';
import { duplicateTokenArcs, hasRepeat, inductionArcs, previousTokenArcs } from './patterns';

describe('example attention patterns', () => {
  it('never point forward: every arc comes from the same or an earlier position', () => {
    for (const labels of [SAMPLE_SENTENCE, SAMPLE_REPEAT]) {
      for (const arcs of [previousTokenArcs(labels), duplicateTokenArcs(labels), inductionArcs(labels)]) {
        for (const a of arcs) expect(a.from).toBeLessThanOrEqual(a.to);
      }
    }
  });

  it('draws the documented patterns on the repeat sample', () => {
    // " red fox saw a red fox": the second " red" and " fox" draw on their earlier copies…
    expect(duplicateTokenArcs(SAMPLE_REPEAT)).toEqual([
      { to: 4, from: 0 },
      { to: 5, from: 1 },
    ]);
    // …and induction draws on what followed each earlier copy.
    expect(inductionArcs(SAMPLE_REPEAT)).toEqual([
      { to: 4, from: 1 },
      { to: 5, from: 2 },
    ]);
    expect(hasRepeat(SAMPLE_REPEAT)).toBe(true);
    expect(hasRepeat(SAMPLE_SENTENCE)).toBe(false);
  });
});
