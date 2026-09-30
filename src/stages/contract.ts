// The stage module contract (CLAUDE.md §7). A stage's `build` is pure: it turns labeled facts into scenes,
// and every displayable leaf in a scene is Sourced. Views and text alternatives are separate modules, so
// the compiler never pulls in React.

import type { Depth } from '@/components/prefs/store';
import type { ClaimId } from '@/content/claims';
import type { Timing } from '@/playback/compile/pacing';
import type { ChapterId } from '@/playback/types';
import type { SourcedText } from '@/shared/sourced-text';
import type { FinalizedTrace } from '@/trace/facts';

export type StageId = 'context' | 'tokenize' | 'embed' | 'layers' | 'probs' | 'sample' | 'loop' | 'stop' | 'followup';

export interface SceneCopy {
  readonly title: SourcedText;
  /** Simple depth: about 40 words at most. */
  readonly body: SourcedText;
  /** Added at Detailed and Technical depth. */
  readonly detail?: SourcedText;
  /** The Technical drawer: mechanics, variants, and caveats. */
  readonly technical?: SourcedText;
  readonly claims: readonly ClaimId[];
}

export interface SceneMeta<S extends StageId, V extends string> {
  readonly stage: S;
  readonly view: V;
  /** Stable across recompiles (depth changes keep the viewer's place). */
  readonly key: string;
  readonly chapter: ChapterId;
  readonly timing: Timing;
  readonly autoPause?: boolean;
  readonly copy: SceneCopy;
  /** The step draws Example elements, so its panel says "Contains examples" (CLAUDE.md L2). */
  readonly examples: boolean;
}

export interface BuildContext {
  readonly trace: FinalizedTrace;
  readonly depth: Depth;
  /** Seeds example drawings, so they're stable for a turn (and still labeled Example, L3). */
  readonly seed: string;
}

export const timing = (baseMs: number, minMs = Math.round(baseMs * 0.6), compressible = true): Timing => ({ baseMs, minMs, compressible });
