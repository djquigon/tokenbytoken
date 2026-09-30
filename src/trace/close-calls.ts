// Close calls (docs/PLAN.md §3.5, CLAUDE.md A12). A close call means several wordings were likely; it
// says nothing about whether the reply is right. Only computed from Recorded logprobs.
//
// Displayed rule: the chosen option scored under 50%, or the top two were within 15 points.
// Featured moments must meet the displayed rule, so the label is always honest; among those, uncertain
// and non-top picks rank higher and whitespace or punctuation ranks lower.

export const CLOSE_CALL_RULE = {
  chosenUnderPct: 50,
  topTwoWithinPts: 15,
  /** Featured moments are at least this many tokens apart. */
  minFeaturedGap: 8,
  maxFeatured: 2,
} as const;

export interface CloseCallInput {
  readonly index: number;
  readonly text: string;
  readonly chosenPct: number;
  /** Alternative percentages, highest first. */
  readonly topPcts: readonly number[];
  /** 1-based rank of the chosen token among the alternatives, or null when it wasn't listed. */
  readonly rank: number | null;
}

export function isCloseCall(chosenPct: number, topPcts: readonly number[]): boolean {
  if (chosenPct < CLOSE_CALL_RULE.chosenUnderPct) return true;
  const [first, second] = topPcts;
  return first !== undefined && second !== undefined && first - second < CLOSE_CALL_RULE.topTwoWithinPts;
}

const LOW_INTEREST = /^[\s\p{P}\p{S}]*$/u;

function score(t: CloseCallInput): number {
  const [first = t.chosenPct, second = 0] = t.topPcts;
  let s = 100 - t.chosenPct;
  if (t.rank !== 1) s += 25;
  s += Math.max(0, CLOSE_CALL_RULE.topTwoWithinPts - (first - second));
  if (LOW_INTEREST.test(t.text)) s -= 60;
  return s;
}

export function findCloseCalls(tokens: readonly CloseCallInput[]): { all: number[]; featured: number[] } {
  const all = tokens.filter((t) => isCloseCall(t.chosenPct, t.topPcts));
  const ranked = [...all].sort((a, b) => score(b) - score(a) || a.index - b.index);
  const featured: number[] = [];
  for (const t of ranked) {
    if (featured.length >= CLOSE_CALL_RULE.maxFeatured) break;
    if (featured.every((f) => Math.abs(f - t.index) >= CLOSE_CALL_RULE.minFeaturedGap)) featured.push(t.index);
  }
  return { all: all.map((t) => t.index), featured: featured.sort((a, b) => a - b) };
}
