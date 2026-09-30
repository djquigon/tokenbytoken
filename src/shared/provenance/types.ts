// Provenance types (docs/PLAN.md §3.5, CLAUDE.md §3). Every data-bearing value in the UI is a Sourced<T>.
// The value is hidden from the type system, so it can't be dropped into JSX or arithmetic by accident;
// it goes through <Datum> for display or derive() for computation.

import type { MethodId, RuleId } from './registry';

export type Kind = 'recorded' | 'calculated' | 'reference' | 'example';

export type RecordedVia = 'sent' | 'done' | 'reported' | 'measured';

export interface RecordedSource {
  readonly via: RecordedVia;
  /** The field or event the value came from, e.g. "usage.output_tokens". */
  readonly field: string;
  /** Who reported it, for via "reported". */
  readonly by?: 'openai' | 'openai_moderation';
  /** Which clock measured it, for via "measured". */
  readonly clock?: 'server' | 'browser';
}

export interface ReferenceSource {
  /** A documented fact, with where and when it was checked. */
  readonly doc?: { readonly title: string; readonly url: string; readonly retrieved: string };
  /** A general principle: true of standard transformer models, not confirmed for this model. */
  readonly general?: true;
  /** A measurement this project made earlier (for example, the Phase 0 probe), with its date. */
  readonly measured?: { readonly what: string; readonly date: string };
}

export interface RecordedProv {
  readonly kind: 'recorded';
  readonly source: RecordedSource;
}

export interface CalculatedProv {
  readonly kind: 'calculated';
  readonly method: MethodId;
  readonly from: readonly Prov[];
  readonly assumptions?: string;
}

export interface ReferenceProv extends ReferenceSource {
  readonly kind: 'reference';
}

export interface ExampleProv {
  readonly kind: 'example';
  readonly rule: RuleId;
  readonly from: readonly Prov[];
  readonly seed?: string;
  /** Set when the example is real data from a different, named model. */
  readonly otherModel?: string;
}

/** Indexed (not conditional) so that Sourced is covariant in its kind. */
interface ProvByKind {
  readonly recorded: RecordedProv;
  readonly calculated: CalculatedProv;
  readonly reference: ReferenceProv;
  readonly example: ExampleProv;
}

export type ProvOf<K extends Kind> = ProvByKind[K];
export type Prov = ProvOf<Kind>;

declare const VALUE: unique symbol;

/**
 * A value with its provenance. At runtime the shape is `{ p, v, whatIf? }`; `v` is deliberately absent
 * from the type, so only `read()` (restricted by lint) can reach it.
 */
export interface Sourced<out T, out K extends Kind = Kind> {
  readonly p: ProvOf<K>;
  /** A hypothetical: "simulated on this page; the model wasn't asked again". */
  readonly whatIf?: true;
  readonly [VALUE]: T;
}

export type ValueOf<S> = S extends Sourced<infer T, Kind> ? T : never;
export type KindOf<S> = S extends Sourced<unknown, infer K> ? K : never;

/** The runtime carrier behind the opaque type. */
export interface Carrier<T> {
  readonly p: Prov;
  readonly v: T;
  readonly whatIf?: true;
}
