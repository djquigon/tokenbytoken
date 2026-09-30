// Example attention patterns (CLAUDE.md A10): rule-based, uniform-weight arcs from published general
// phenomena, never measured values. Arrows point into the position that draws on the text.

import { illustrate, type RuleId, type Sourced } from '@/shared/provenance';

export interface Arc {
  /** The position doing the drawing-on (arrows point into it). */
  readonly to: number;
  readonly from: number;
}

export interface AttentionPattern {
  readonly rule: Extract<RuleId, 'attention-previous-token' | 'attention-duplicate-token' | 'attention-induction'>;
  /** Real tokens as labels don't make the arcs real (CLAUDE.md L1). */
  readonly labels: Sourced<readonly string[]>;
  readonly arcs: Sourced<readonly Arc[], 'example'>;
  readonly onSample: boolean;
}

/** Each position draws on itself and the token before it. */
export function previousTokenArcs(labels: readonly string[]): Arc[] {
  return labels.flatMap((_, to) => [{ to, from: to }, ...(to > 0 ? [{ to, from: to - 1 }] : [])]);
}

/** Each position draws on earlier copies of the same token. */
export function duplicateTokenArcs(labels: readonly string[]): Arc[] {
  return labels.flatMap((t, to) => labels.slice(0, to).flatMap((u, from) => (u === t ? [{ to, from }] : [])));
}

/** At a repeated token, a position draws on the token that followed its earlier copy ([A][B] … [A] → [B]). */
export function inductionArcs(labels: readonly string[]): Arc[] {
  return labels.flatMap((t, to) =>
    labels.slice(0, to).flatMap((u, j) => (u === t && j + 1 < to ? [{ to, from: j + 1 }] : [])),
  );
}

const GENERATORS = {
  'attention-previous-token': previousTokenArcs,
  'attention-duplicate-token': duplicateTokenArcs,
  'attention-induction': inductionArcs,
} as const;

export function pattern(rule: AttentionPattern['rule'], labels: Sourced<readonly string[]>, seed: string, onSample: boolean): AttentionPattern {
  return { rule, labels, onSample, arcs: illustrate(rule, seed, [labels], (ls) => GENERATORS[rule](ls)) };
}

/** Whether the tokens repeat, so the duplicate-token and induction patterns have something to show. */
export const hasRepeat = (labels: readonly string[]) => new Set(labels).size < labels.length;
