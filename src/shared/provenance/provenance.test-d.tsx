// Type-level tests (CLAUDE.md §11). `npm run typecheck` and `vitest` both fail if any line marked with
// an expect-error directive below stops being an error.

import { expectTypeOf, test } from 'vitest';

import { playbackMs, serverMs, type PlaybackMs } from '../units';
import { derive, illustrate } from './combine';
import { recorded } from './mint';
import type { Sourced } from './types';

const tokens = recorded({ via: 'reported', by: 'openai', field: 'usage.output_tokens' }, 42);
const example = illustrate('attention-previous-token', 'seed', [], () => 0.5);

test('a raw Sourced value cannot be rendered in JSX', () => {
  // @ts-expect-error Sourced is not a ReactNode; it must go through <Datum>.
  const bad = <span>{tokens}</span>;
  void bad;
});

test('a Sourced value cannot be used as a number', () => {
  // @ts-expect-error No arithmetic on labeled values; use derive().
  const bad: number = tokens + 1;
  void bad;
});

test('derive over an Example produces an Example', () => {
  const fromExample = derive('difference', [tokens, example], (a, b) => a - b);
  expectTypeOf(fromExample).toEqualTypeOf<Sourced<number, 'example'>>();
  const fromRecorded = derive('pct-from-logprob', [tokens], (n) => n * 2);
  expectTypeOf(fromRecorded).toEqualTypeOf<Sourced<number, 'calculated'>>();
  // @ts-expect-error An Example can never be passed off as Calculated.
  const bad: Sourced<number, 'calculated'> = fromExample;
  void bad;
});

test('derive rejects unknown methods', () => {
  // @ts-expect-error Methods come from a closed registry.
  derive('made-up-method', [tokens], (n) => n);
});

test('ServerMs cannot be used where PlaybackMs is expected', () => {
  const pace = (ms: PlaybackMs) => ms;
  pace(playbackMs(120));
  // @ts-expect-error Measured time never drives playback pacing (CLAUDE.md A6).
  pace(serverMs(120));
  // @ts-expect-error Plain numbers must be branded explicitly.
  pace(120);
});
