// The close-call rule shown to viewers (CLAUDE.md A12): the chosen option scored under 50%, or the top two
// were within 15 points. Shared so the trace (which finds close calls) and the copy (which describes
// them) can't drift apart.

export const CLOSE_CALL_RULE = {
  chosenUnderPct: 50,
  topTwoWithinPts: 15,
  /** Featured moments are at least this many tokens apart. */
  minFeaturedGap: 8,
  maxFeatured: 2,
} as const;
