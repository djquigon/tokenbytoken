// Combining provenance (CLAUDE.md L1–L3). The weakest input wins: any Example input makes the result an
// Example, and everything else computed here is Calculated. Nothing here can produce Recorded or
// Reference values; those are minted only in src/trace/ (see mint.ts).

import type { MethodId, RuleId } from './registry';
import type { Carrier, Kind, KindOf, Prov, Sourced, ValueOf } from './types';

type AnySourced = Sourced<unknown, Kind>;

type IsExactlyExample<S> = [KindOf<S>] extends ['example'] ? true : false;

/** The label of derive()'s result, as precisely as the input types allow. */
export type DerivedKind<Ins extends readonly AnySourced[]> =
  [KindOf<Ins[number]>] extends [Exclude<Kind, 'example'>]
    ? 'calculated'
    : true extends { [I in keyof Ins]: IsExactlyExample<Ins[I]> }[number]
      ? 'example'
      : 'calculated' | 'example';

type Values<Ins extends readonly AnySourced[]> = { [I in keyof Ins]: ValueOf<Ins[I]> };

const carrier = <T>(s: Sourced<T, Kind>): Carrier<T> => s as unknown as Carrier<T>;

export const make = <T, K extends Kind>(p: Prov, v: T, whatIf?: true): Sourced<T, K> =>
  (whatIf ? { p, v, whatIf } : { p, v }) as unknown as Sourced<T, K>;

/** Unique provenance entries, compared by identity first, then by content. */
export function uniqueProvs(provs: readonly Prov[]): Prov[] {
  const seen = new Set<string>();
  const out: Prov[] = [];
  const byIdentity = new Set<Prov>();
  for (const p of provs) {
    if (byIdentity.has(p)) continue;
    byIdentity.add(p);
    const key = JSON.stringify(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export interface DeriveOptions {
  readonly assumptions?: string;
  readonly whatIf?: true;
}

/**
 * Computes a value from Sourced inputs. The result is Calculated unless any input is an Example, in
 * which case it is an Example too. What-if propagates from any input.
 */
export function derive<const Ins extends readonly AnySourced[], R>(
  method: MethodId,
  inputs: Ins,
  f: (...values: Values<Ins>) => R,
  options: DeriveOptions = {},
): Sourced<R, DerivedKind<Ins>> {
  const cs = inputs.map((i) => carrier(i));
  const value = f(...(cs.map((c) => c.v) as Values<Ins>));
  const from = uniqueProvs(cs.map((c) => c.p));
  const whatIf = options.whatIf ?? (cs.some((c) => c.whatIf) ? true : undefined);
  const p: Prov = cs.some((c) => c.p.kind === 'example')
    ? { kind: 'example', rule: 'derived', from }
    : { kind: 'calculated', method, from, ...(options.assumptions ? { assumptions: options.assumptions } : {}) };
  return make(p, value, whatIf);
}

/** Aggregates a list of Sourced values of one type (sums, counts, maxima). */
export function deriveAll<T, R, K extends Kind>(
  method: MethodId,
  inputs: readonly Sourced<T, K>[],
  f: (values: T[]) => R,
  options: DeriveOptions = {},
): Sourced<R, DerivedKind<readonly Sourced<T, K>[]>> {
  const cs = inputs.map((i) => carrier(i));
  const value = f(cs.map((c) => c.v));
  const from = uniqueProvs(cs.map((c) => c.p));
  const whatIf = options.whatIf ?? (cs.some((c) => c.whatIf) ? true : undefined);
  const p: Prov = cs.some((c) => c.p.kind === 'example')
    ? { kind: 'example', rule: 'derived', from }
    : { kind: 'calculated', method, from, ...(options.assumptions ? { assumptions: options.assumptions } : {}) };
  return make(p, value, whatIf);
}

/** Makes an Example. Seeded values are Examples however stable they look (L3). */
export function illustrate<const Ins extends readonly AnySourced[], R>(
  rule: RuleId,
  seed: string,
  inputs: Ins,
  f: (...values: Values<Ins>) => R,
): Sourced<R, 'example'> {
  const cs = inputs.map((i) => carrier(i));
  const value = f(...(cs.map((c) => c.v) as Values<Ins>));
  const whatIf = cs.some((c) => c.whatIf) ? true : undefined;
  return make({ kind: 'example', rule, seed, from: uniqueProvs(cs.map((c) => c.p)) }, value, whatIf);
}

/** Marks a value as a hypothetical. Labels only ever get weaker, so there is no inverse. */
export const asWhatIf = <T, K extends Kind>(s: Sourced<T, K>): Sourced<T, K> => {
  const c = carrier(s);
  return make(c.p, c.v, true);
};
