// Reading a Sourced value. Lint restricts this module to pure logic (src/trace/, src/playback/,
// src/stages/*/build) and to the display components in src/components/provenance/, so UI code can't
// show a number without its label.

import type { Carrier, Kind, Prov, Sourced } from './types';

export const read = <T>(s: Sourced<T, Kind>): T => (s as unknown as Carrier<T>).v;

export const provOf = (s: Sourced<unknown, Kind>): Prov => s.p;

export const kindOf = (s: Sourced<unknown, Kind>): Kind => s.p.kind;

export const isSourced = (x: unknown): x is Sourced<unknown, Kind> =>
  typeof x === 'object' && x !== null && 'p' in x && 'v' in x && typeof (x as { p: unknown }).p === 'object';
