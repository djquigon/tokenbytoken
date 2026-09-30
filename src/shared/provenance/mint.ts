// Minting Recorded and Reference values. Lint restricts this module to src/trace/ (CLAUDE.md §4): the
// trace is the only place that turns recorded events into facts, and it labels the reference values the
// server echoes as Reference, never Recorded.

import { make } from './combine';
import type { ProvOf, RecordedSource, ReferenceSource, Sourced } from './types';

export const recordedProv = (source: RecordedSource): ProvOf<'recorded'> => ({ kind: 'recorded', source });

export const referenceProv = (source: ReferenceSource): ProvOf<'reference'> => ({ kind: 'reference', ...source });

/** Wraps a value with an existing Recorded provenance. Sharing one prov object keeps traces small. */
export const recordedWith = <T>(p: ProvOf<'recorded'>, value: T): Sourced<T, 'recorded'> => make(p, value);

export const recorded = <T>(source: RecordedSource, value: T): Sourced<T, 'recorded'> =>
  make(recordedProv(source), value);

export const referenceWith = <T>(p: ProvOf<'reference'>, value: T): Sourced<T, 'reference'> => make(p, value);

export const reference = <T>(source: ReferenceSource, value: T): Sourced<T, 'reference'> =>
  make(referenceProv(source), value);
