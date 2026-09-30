// The walkthrough as data (docs/PLAN.md §3.5). A PlaybackScript is a pure function of a FinalizedTrace and
// the viewer's preferences. Durations are teaching time, never measured time (CLAUDE.md A6).

import type { Depth } from '@/components/prefs/store';
import type { SourcedText } from '@/shared/sourced-text';
import type { PlaybackMs } from '@/shared/units';
import type { Scene } from '@/stages/scenes';

export type ChapterId = 'hook' | 'context' | 'tokenize' | 'network' | 'options' | 'pick' | 'loop' | 'followup';

export interface ChapterInfo {
  readonly id: ChapterId;
  /** Shown at every depth. */
  readonly title: string;
  /** A word or two for the chapter bar; the full title stays in its accessible name. */
  readonly short: string;
  /** The technical name, shown at Detailed and Technical depth. */
  readonly subtitle: string | null;
}

export const CHAPTERS: Readonly<Record<ChapterId, ChapterInfo>> = {
  hook: { id: 'hook', title: 'At every token there were options', short: 'Start', subtitle: null },
  context: { id: 'context', title: 'What gets sent', short: 'Sent', subtitle: 'Context assembly' },
  tokenize: { id: 'tokenize', title: 'Text becomes tokens', short: 'Tokens', subtitle: 'Tokenization and token IDs' },
  network: {
    id: 'network',
    title: 'Inside the network (example view)',
    short: 'Network',
    subtitle: 'Embeddings, positions, transformer layers, prompt processing',
  },
  options: { id: 'options', title: 'The options for the next token', short: 'Options', subtitle: 'Scores to probabilities (logprobs)' },
  pick: { id: 'pick', title: 'A weighted random pick', short: 'Pick', subtitle: 'Sampling' },
  loop: { id: 'loop', title: 'Add it, repeat, until it ends', short: 'Repeat', subtitle: 'The generation loop, saved work, and stop conditions' },
  followup: {
    id: 'followup',
    title: 'Your next message: the chat so far is sent again',
    short: 'Next message',
    subtitle: 'History as context and the context budget',
  },
};

export interface Step {
  readonly index: number;
  readonly chapter: ChapterId;
  /** Stable across recompiles, so changing depth keeps the viewer's place. */
  readonly key: string;
  readonly scene: Scene;
  readonly startMs: PlaybackMs;
  readonly durationMs: PlaybackMs;
  /** Pause at the end of this step (close-call moments), so the viewer can take it in. */
  readonly autoPause: boolean;
  /** The text alternative for exactly this step. */
  readonly describe: SourcedText;
}

export interface ChapterSpan {
  readonly id: ChapterId;
  readonly first: number;
  readonly last: number;
}

export interface PlaybackScript {
  readonly turnId: string;
  readonly depth: Depth;
  readonly steps: readonly Step[];
  readonly chapters: readonly ChapterSpan[];
  readonly totalMs: PlaybackMs;
}
